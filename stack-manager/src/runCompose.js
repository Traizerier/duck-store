import { spawn } from "node:child_process";
import { ComposeError } from "./errors.js";

// Runs `docker compose <args...>` and returns `{ stdout, stderr, exitCode }`.
// Never accepts a shell string — args are passed as an array so stack names
// (already regex-whitelisted by the caller) can't inject into the command.
//
// Options:
//   cwd         - working directory; compose resolves relative file paths from here
//   allowFail   - if true, non-zero exits resolve instead of reject; useful for
//                 calls where a non-zero exit is informational (e.g. `ps` when
//                 no containers exist for the project)
export function runCompose(args, { cwd, allowFail = false, runner = spawn } = {}) {
  return new Promise((resolve, reject) => {
    const child = runner("docker", ["compose", ...args], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      reject(
        new ComposeError(`failed to launch docker compose: ${err.message}`, {
          stderr: err.message,
        }),
      );
    });

    child.on("close", (exitCode) => {
      const result = { stdout, stderr, exitCode };
      if (exitCode === 0 || allowFail) {
        resolve(result);
      } else {
        reject(
          new ComposeError(
            `docker compose ${args.join(" ")} exited with ${exitCode}`,
            { exitCode, stderr },
          ),
        );
      }
    });
  });
}
