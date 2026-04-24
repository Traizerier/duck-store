import { describe, it, expect } from "vitest";
import { EventEmitter } from "node:events";
import { runCompose } from "./runCompose.js";
import { ComposeError } from "./errors.js";

// Fake child that the caller can drive: emit stdout/stderr chunks, then
// close with an exit code.
function makeChild() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  return child;
}

// Build a spawn stub that records the args it saw and returns the given
// child. Exposed as `runner.calls` for assertions.
function stubSpawn(child) {
  const runner = (cmd, args, opts) => {
    runner.calls.push({ cmd, args, opts });
    return child;
  };
  runner.calls = [];
  return runner;
}

describe("runCompose", () => {
  it("invokes `docker compose <args...>` with forwarded args and cwd", async () => {
    const child = makeChild();
    const runner = stubSpawn(child);
    const promise = runCompose(["ps", "-a"], { cwd: "/repo", runner });
    setImmediate(() => child.emit("close", 0));
    await promise;
    expect(runner.calls).toHaveLength(1);
    expect(runner.calls[0].cmd).toBe("docker");
    expect(runner.calls[0].args).toEqual(["compose", "ps", "-a"]);
    expect(runner.calls[0].opts.cwd).toBe("/repo");
  });

  it("resolves with stdout + stderr + exitCode on success", async () => {
    const child = makeChild();
    const runner = stubSpawn(child);
    const promise = runCompose(["ps"], { runner });
    setImmediate(() => {
      child.stdout.emit("data", "line one\n");
      child.stdout.emit("data", "line two\n");
      child.stderr.emit("data", "a warning\n");
      child.emit("close", 0);
    });
    const result = await promise;
    expect(result.stdout).toBe("line one\nline two\n");
    expect(result.stderr).toBe("a warning\n");
    expect(result.exitCode).toBe(0);
  });

  it("rejects with ComposeError carrying exitCode + stderr on non-zero exit", async () => {
    const child = makeChild();
    const runner = stubSpawn(child);
    const promise = runCompose(["up"], { runner });
    setImmediate(() => {
      child.stderr.emit("data", "boom\n");
      child.emit("close", 2);
    });
    try {
      await promise;
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ComposeError);
      expect(err.exitCode).toBe(2);
      expect(err.stderr).toBe("boom\n");
    }
  });

  it("resolves on non-zero exit when allowFail is true", async () => {
    const child = makeChild();
    const runner = stubSpawn(child);
    const promise = runCompose(["ps"], { runner, allowFail: true });
    setImmediate(() => child.emit("close", 1));
    const result = await promise;
    expect(result.exitCode).toBe(1);
  });

  it("rejects with ComposeError on spawn failure", async () => {
    const child = makeChild();
    const runner = stubSpawn(child);
    const promise = runCompose(["ps"], { runner });
    setImmediate(() => child.emit("error", new Error("ENOENT")));
    try {
      await promise;
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ComposeError);
      expect(err.message).toContain("ENOENT");
    }
  });
});
