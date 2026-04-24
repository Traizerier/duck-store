import { InvalidStackNameError } from "./errors.js";

// Whitelist: lowercase letters, digits, and internal hyphens. Must start
// with a letter or digit. Max 32 chars. This is the one-and-only gate
// between HTTP input (or file-system input) and the docker compose
// invocation — a bad name here could inject into `-p duckstore-<name>`.
// Keep it strict.
const NAME_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;

export function isValidStackName(name) {
  return typeof name === "string" && NAME_RE.test(name);
}

export function assertValidStackName(name) {
  if (!isValidStackName(name)) {
    throw new InvalidStackNameError(name);
  }
}
