import { describe, it, expect, vi } from "vitest";
import { StackManager } from "./StackManager.js";
import { UnknownStackError, InvalidStackNameError } from "./errors.js";

// Small helper: a runCompose stub that records calls and returns a
// preset stdout/stderr/exitCode.
function stubRunCompose(responses = {}) {
  const fn = vi.fn(async (args) => {
    const key = args.find((a) => ["ps", "up", "down", "restart", "logs"].includes(a));
    const response = responses[key] ?? { stdout: "", stderr: "", exitCode: 0 };
    return response;
  });
  return fn;
}

function makeManager(overrides = {}) {
  return new StackManager({
    repoRoot: "/repo",
    stackLister: async () => ["warehouse", "store"],
    envReader: async (_root, name) => ({
      INSTANCE_NAME: name,
      FRONTEND_TITLE: `Duck ${name}`,
      BACKEND_HOST_PORT: name === "warehouse" ? "4001" : "4002",
      FRONTEND_HOST_PORT: name === "warehouse" ? "5173" : "5174",
      MONGO_DB_NAME: name,
    }),
    runCompose: stubRunCompose(),
    httpClient: async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }),
    ...overrides,
  });
}

describe("StackManager.list", () => {
  it("returns metadata for every discovered stack, sorted", async () => {
    const mgr = makeManager();
    const list = await mgr.list();
    expect(list.map((s) => s.name)).toEqual(["store", "warehouse"]);
    const warehouse = list.find((s) => s.name === "warehouse");
    expect(warehouse).toMatchObject({
      name: "warehouse",
      projectName: "duckstore-warehouse",
      envFile: ".env.warehouse",
      instance: "warehouse",
      title: "Duck warehouse",
      backendHostPort: 4001,
      frontendHostPort: 5173,
      mongoDbName: "warehouse",
    });
  });
});

describe("StackManager allowlist enforcement", () => {
  it("rejects an unknown stack name with UnknownStackError", async () => {
    const mgr = makeManager();
    await expect(mgr.up("frogs")).rejects.toBeInstanceOf(UnknownStackError);
  });

  it("rejects an invalid stack name (regex) with InvalidStackNameError", async () => {
    const mgr = makeManager();
    await expect(mgr.up("../../etc")).rejects.toBeInstanceOf(
      InvalidStackNameError,
    );
  });

  it("rejects names with shell metacharacters before hitting compose", async () => {
    const run = stubRunCompose();
    const mgr = makeManager({ runCompose: run });
    await expect(mgr.up("warehouse; rm -rf /")).rejects.toBeInstanceOf(
      InvalidStackNameError,
    );
    expect(run).not.toHaveBeenCalled();
  });

  it("picks up new .env files on refresh without a restart", async () => {
    let names = ["warehouse"];
    const mgr = makeManager({ stackLister: async () => [...names] });
    await expect(mgr.up("store")).rejects.toBeInstanceOf(UnknownStackError);
    names = ["warehouse", "store"];
    await expect(mgr.up("store")).resolves.toEqual({ name: "store", action: "up" });
  });
});

describe("StackManager compose invocation shape", () => {
  it("scopes every command to `-p duckstore-<name> --env-file .env.<name> -f <file>...`", async () => {
    const run = stubRunCompose();
    const mgr = makeManager({ runCompose: run });
    await mgr.up("warehouse");
    const [args, opts] = run.mock.calls[0];
    expect(args.slice(0, 7)).toEqual([
      "-p",
      "duckstore-warehouse",
      "--env-file",
      ".env.warehouse",
      "-f",
      "docker-compose.yml",
      "-f",
    ]);
    expect(opts.cwd).toBe("/repo");
  });

  it("up passes `up -d --remove-orphans`", async () => {
    const run = stubRunCompose();
    const mgr = makeManager({ runCompose: run });
    await mgr.up("warehouse");
    const args = run.mock.calls[0][0];
    expect(args.slice(-3)).toEqual(["up", "-d", "--remove-orphans"]);
  });

  it("down passes `down --remove-orphans`", async () => {
    const run = stubRunCompose();
    const mgr = makeManager({ runCompose: run });
    await mgr.down("warehouse");
    const args = run.mock.calls[0][0];
    expect(args.slice(-2)).toEqual(["down", "--remove-orphans"]);
  });

  it("restart passes `restart`", async () => {
    const run = stubRunCompose();
    const mgr = makeManager({ runCompose: run });
    await mgr.restart("warehouse");
    const args = run.mock.calls[0][0];
    expect(args[args.length - 1]).toBe("restart");
  });
});

describe("StackManager.status", () => {
  it("parses NDJSON from `ps --format json` into service entries", async () => {
    const ndjson =
      '{"Service":"backend","Name":"duckstore-warehouse-backend-1","State":"running","Status":"Up 5 minutes","Publishers":[{"PublishedPort":4001,"TargetPort":4001}]}\n' +
      '{"Service":"mongo","Name":"duckstore-warehouse-mongo-1","State":"running","Status":"Up 5 minutes","Publishers":[]}\n';
    const mgr = makeManager({
      runCompose: stubRunCompose({ ps: { stdout: ndjson, stderr: "", exitCode: 0 } }),
    });
    const status = await mgr.status("warehouse");
    expect(status.name).toBe("warehouse");
    expect(status.services).toHaveLength(2);
    expect(status.services[0]).toMatchObject({
      service: "backend",
      state: "running",
      status: "Up 5 minutes",
    });
  });

  it("returns empty services when the stack has never been started", async () => {
    const mgr = makeManager({
      runCompose: stubRunCompose({ ps: { stdout: "", stderr: "", exitCode: 0 } }),
    });
    const status = await mgr.status("warehouse");
    expect(status.services).toEqual([]);
  });

  it("skips malformed JSON lines", async () => {
    const mgr = makeManager({
      runCompose: stubRunCompose({
        ps: {
          stdout: '{"Service":"backend","State":"running"}\nnot-json\n',
          stderr: "",
          exitCode: 0,
        },
      }),
    });
    const status = await mgr.status("warehouse");
    expect(status.services).toHaveLength(1);
    expect(status.services[0].service).toBe("backend");
  });
});

describe("StackManager.logs", () => {
  it("returns lines[] with the trailing blank trimmed", async () => {
    const mgr = makeManager({
      runCompose: stubRunCompose({
        logs: { stdout: "a\nb\nc\n", stderr: "", exitCode: 0 },
      }),
    });
    const result = await mgr.logs("warehouse", { tail: 3 });
    expect(result).toEqual({ name: "warehouse", tail: 3, lines: ["a", "b", "c"] });
  });

  it("passes --tail=<N> through to compose", async () => {
    const run = stubRunCompose();
    const mgr = makeManager({ runCompose: run });
    await mgr.logs("warehouse", { tail: 50 });
    const args = run.mock.calls[0][0];
    expect(args).toContain("--tail=50");
  });

  it.each([
    [-1, "negative"],
    [5001, "too large"],
    ["abc", "not a number"],
    [Number.POSITIVE_INFINITY, "infinite"],
  ])("rejects tail=%s (%s)", async (tail) => {
    const mgr = makeManager();
    await expect(mgr.logs("warehouse", { tail })).rejects.toThrow(/tail/);
  });
});

describe("StackManager.health", () => {
  it("returns reachable:true + backend payload on 2xx", async () => {
    const mgr = makeManager({
      httpClient: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, instance: "warehouse", type: "duck" }),
      }),
    });
    const health = await mgr.health("warehouse");
    expect(health.backend.reachable).toBe(true);
    expect(health.backend.ok).toBe(true);
    expect(health.backend.body.instance).toBe("warehouse");
  });

  it("returns reachable:false on network error", async () => {
    const mgr = makeManager({
      httpClient: async () => {
        throw new Error("ECONNREFUSED");
      },
    });
    const health = await mgr.health("warehouse");
    expect(health.backend.reachable).toBe(false);
    expect(health.backend.error).toBe("ECONNREFUSED");
  });

  it("calls the URL derived from BACKEND_HOST_PORT", async () => {
    const client = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    }));
    const mgr = makeManager({ httpClient: client });
    await mgr.health("warehouse");
    expect(client).toHaveBeenCalledWith("http://localhost:4001/health");
  });
});
