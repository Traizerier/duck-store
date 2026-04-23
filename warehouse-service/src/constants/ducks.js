import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Single source of truth for color + size enums. Read at module load time
// from the repo-root shared/enums.json. If warehouse and store disagree
// with this list, they'll produce inconsistent validation — so this file
// is the point that binds them all together.
const here = dirname(fileURLToPath(import.meta.url));
const sharedEnumsPath = resolve(here, "../../../shared/enums.json");
const shared = JSON.parse(readFileSync(sharedEnumsPath, "utf8"));

export const COLORS = Object.freeze(shared.colors);
export const SIZES = Object.freeze(shared.sizes);
