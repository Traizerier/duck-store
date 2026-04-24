import { assertValidStackName } from "./validateStackName.js";
import { UnknownStackError, ComposeError } from "./errors.js";
import { discoverStackNames, readStackEnv } from "./discoverStacks.js";
import { runCompose as defaultRunCompose } from "./runCompose.js";

// Orchestrates docker compose across the discovered stacks. Two layers
// of safety keep it from touching unrelated containers:
//
//   1. Every operation takes a `name` which is checked against the
//      allowlist built at init-time (discoverStackNames + assertKnown).
//   2. Every compose invocation is scoped to a specific project
//      (`-p duckstore-<name>`), so there's no bare `docker compose`
//      call that could pick up a different compose file or project.
//
// All external side effects are injected (runCompose, fetch, env reader)
// so tests can run without docker or a network.
export class StackManager {
  constructor({
    repoRoot,
    composeFiles = ["docker-compose.yml", "docker-compose.dev.yml"],
    runCompose = defaultRunCompose,
    envReader = readStackEnv,
    stackLister = discoverStackNames,
    httpClient = fetch,
    backendHost = "localhost",
  }) {
    if (!repoRoot) throw new Error("StackManager: repoRoot is required");
    this.repoRoot = repoRoot;
    this.composeFiles = composeFiles;
    this.runCompose = runCompose;
    this.envReader = envReader;
    this.stackLister = stackLister;
    this.httpClient = httpClient;
    this.backendHost = backendHost;
    this.allowlist = null; // populated by refresh()
  }

  // Rediscover stacks from the filesystem. Called at boot and before
  // any allowlist check so a freshly-added .env.<name> file is picked
  // up without a restart.
  async refresh() {
    const names = await this.stackLister(this.repoRoot);
    this.allowlist = new Set(names);
    return names;
  }

  // Every lifecycle op refreshes the allowlist before checking it, so a
  // freshly-added `.env.<name>` file is picked up without restarting the
  // control plane. One readdir per operation is cheap.
  async _assertKnown(name) {
    assertValidStackName(name);
    await this.refresh();
    if (!this.allowlist.has(name)) throw new UnknownStackError(name);
  }

  _composeArgs(name) {
    const fileFlags = this.composeFiles.flatMap((f) => ["-f", f]);
    return [
      "-p",
      `duckstore-${name}`,
      "--env-file",
      `.env.${name}`,
      ...fileFlags,
    ];
  }

  async list() {
    await this.refresh();
    const names = [...this.allowlist].sort();
    return Promise.all(
      names.map(async (name) => {
        const env = await this.envReader(this.repoRoot, name);
        return {
          name,
          projectName: `duckstore-${name}`,
          envFile: `.env.${name}`,
          instance: env.INSTANCE_NAME ?? name,
          title: env.FRONTEND_TITLE ?? null,
          backendHostPort: env.BACKEND_HOST_PORT ? Number(env.BACKEND_HOST_PORT) : null,
          frontendHostPort: env.FRONTEND_HOST_PORT ? Number(env.FRONTEND_HOST_PORT) : null,
          mongoDbName: env.MONGO_DB_NAME ?? null,
        };
      }),
    );
  }

  async status(name) {
    await this._assertKnown(name);
    // `ps --format json` emits one JSON object per line (newline-delimited).
    // Non-zero exit from ps when nothing is running is not an error for us.
    const { stdout } = await this.runCompose(
      [...this._composeArgs(name), "ps", "--all", "--format", "json"],
      { cwd: this.repoRoot, allowFail: true },
    );
    const services = stdout
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter((v) => v !== null)
      .map((raw) => ({
        service: raw.Service ?? raw.service ?? null,
        name: raw.Name ?? raw.name ?? null,
        state: raw.State ?? raw.state ?? null,
        status: raw.Status ?? raw.status ?? null,
        ports: raw.Publishers ?? raw.publishers ?? [],
      }));
    return { name, services };
  }

  async up(name) {
    await this._assertKnown(name);
    await this.runCompose(
      [...this._composeArgs(name), "up", "-d", "--remove-orphans"],
      { cwd: this.repoRoot },
    );
    return { name, action: "up" };
  }

  async down(name) {
    await this._assertKnown(name);
    await this.runCompose(
      [...this._composeArgs(name), "down", "--remove-orphans"],
      { cwd: this.repoRoot },
    );
    return { name, action: "down" };
  }

  async restart(name) {
    await this._assertKnown(name);
    await this.runCompose([...this._composeArgs(name), "restart"], {
      cwd: this.repoRoot,
    });
    return { name, action: "restart" };
  }

  async logs(name, { tail = 200 } = {}) {
    await this._assertKnown(name);
    const n = Number(tail);
    if (!Number.isFinite(n) || n < 0 || n > 5000) {
      throw new Error(`logs: tail must be a number in [0, 5000], got ${tail}`);
    }
    const { stdout } = await this.runCompose(
      [...this._composeArgs(name), "logs", "--no-color", `--tail=${n}`],
      { cwd: this.repoRoot, allowFail: true },
    );
    const lines = stdout.split(/\r?\n/);
    // Drop trailing empty line from the terminal newline.
    if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
    return { name, tail: n, lines };
  }

  // Calls the stack's backend /health endpoint via the host port exposed
  // in its .env file. Returns reachability + the backend's own payload.
  async health(name) {
    await this._assertKnown(name);
    const env = await this.envReader(this.repoRoot, name);
    const port = env.BACKEND_HOST_PORT;
    if (!port) {
      return { name, backend: { reachable: false, error: "no BACKEND_HOST_PORT in env" } };
    }
    const url = `http://${this.backendHost}:${port}/health`;
    try {
      const res = await this.httpClient(url);
      const payload = await res.json().catch(() => null);
      return {
        name,
        backend: {
          reachable: true,
          status: res.status,
          ok: res.ok,
          body: payload,
        },
      };
    } catch (err) {
      return {
        name,
        backend: { reachable: false, error: err.message },
      };
    }
  }
}

export { ComposeError, UnknownStackError };
