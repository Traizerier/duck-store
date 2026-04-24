import { describe, it, expect } from "vitest";
import { discoverStackNames, readStackEnv } from "./discoverStacks.js";

function fakeDir(entries) {
  return async () => entries;
}

describe("discoverStackNames", () => {
  it("returns names parsed from .env.<name> files, sorted", async () => {
    const names = await discoverStackNames("/repo", {
      listDir: fakeDir([".env.store", ".env.warehouse"]),
    });
    expect(names).toEqual(["store", "warehouse"]);
  });

  it("excludes the denylist (.env, .env.example, .env.control-plane)", async () => {
    const names = await discoverStackNames("/repo", {
      listDir: fakeDir([
        ".env",
        ".env.example",
        ".env.control-plane",
        ".env.warehouse",
      ]),
    });
    expect(names).toEqual(["warehouse"]);
  });

  it("excludes *.local overrides", async () => {
    const names = await discoverStackNames("/repo", {
      listDir: fakeDir([
        ".env.warehouse",
        ".env.warehouse.local",
        ".env.store.local",
      ]),
    });
    expect(names).toEqual(["warehouse"]);
  });

  it("ignores non-env files", async () => {
    const names = await discoverStackNames("/repo", {
      listDir: fakeDir([
        "README.md",
        "run.sh",
        "docker-compose.yml",
        ".env.warehouse",
      ]),
    });
    expect(names).toEqual(["warehouse"]);
  });

  it("rejects names that wouldn't pass the whitelist regex", async () => {
    const names = await discoverStackNames("/repo", {
      listDir: fakeDir([
        ".env.warehouse",
        ".env.Warehouse",
        ".env.bad/name",
        ".env.../etc",
      ]),
    });
    expect(names).toEqual(["warehouse"]);
  });

  it("deduplicates", async () => {
    const names = await discoverStackNames("/repo", {
      listDir: fakeDir([".env.warehouse", ".env.warehouse"]),
    });
    expect(names).toEqual(["warehouse"]);
  });

  it("returns [] for an empty repo", async () => {
    const names = await discoverStackNames("/repo", { listDir: fakeDir([]) });
    expect(names).toEqual([]);
  });
});

describe("readStackEnv", () => {
  const file = (text) => async () => text;

  it("parses KEY=VALUE lines", async () => {
    const env = await readStackEnv("/repo", "warehouse", {
      readText: file(
        "INSTANCE_NAME=warehouse\nBACKEND_HOST_PORT=4001\nMONGO_DB_NAME=warehouse\n",
      ),
    });
    expect(env).toEqual({
      INSTANCE_NAME: "warehouse",
      BACKEND_HOST_PORT: "4001",
      MONGO_DB_NAME: "warehouse",
    });
  });

  it("strips surrounding single or double quotes", async () => {
    const env = await readStackEnv("/repo", "warehouse", {
      readText: file('FRONTEND_TITLE="Duck Warehouse"\nOTHER=\'Quoted\'\n'),
    });
    expect(env.FRONTEND_TITLE).toBe("Duck Warehouse");
    expect(env.OTHER).toBe("Quoted");
  });

  it("ignores blank lines and # comments", async () => {
    const env = await readStackEnv("/repo", "warehouse", {
      readText: file("# header\n\nINSTANCE_NAME=warehouse\n# trailing\n"),
    });
    expect(env).toEqual({ INSTANCE_NAME: "warehouse" });
  });
});
