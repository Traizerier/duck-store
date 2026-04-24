import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { isValidStackName } from "./validateStackName.js";

// Files at the repo root that look like per-stack env files but aren't.
// The control-plane sits alongside the managed stacks in the filesystem,
// so the denylist is how we make sure it can't manage itself.
const DENYLIST = new Set([
  ".env",
  ".env.example",
  ".env.control-plane",
  ".env.control-plane.local",
]);

function extractStackName(filename) {
  if (!filename.startsWith(".env.")) return null;
  if (filename.endsWith(".local")) return null;
  if (DENYLIST.has(filename)) return null;
  const name = filename.slice(".env.".length);
  return isValidStackName(name) ? name : null;
}

// Parse a trivial KEY=VALUE .env file. Handles quoted values and inline
// comments. Good enough for our non-secret config; intentionally simple.
function parseEnvFile(text) {
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

// List valid stack names present at repoRoot. Names are sorted so the
// external API is deterministic. Injected fs (listDir) so tests don't
// need a real filesystem.
export async function discoverStackNames(repoRoot, { listDir = readdir } = {}) {
  const entries = await listDir(repoRoot);
  const names = entries.map(extractStackName).filter((n) => n !== null);
  return [...new Set(names)].sort();
}

// Read and parse a single stack's env file.
export async function readStackEnv(
  repoRoot,
  name,
  { readText = (p) => readFile(p, "utf-8") } = {},
) {
  const text = await readText(join(repoRoot, `.env.${name}`));
  return parseEnvFile(text);
}
