// Canonical color + size enums imported from the repo-root shared/enums.json.
// Vite inlines the JSON at transform time, so the compiled bundle contains
// the exact same list the backend loads via Schema.load at boot.
import enums from "../../../shared/enums.json";

export const COLORS: readonly string[] = enums.colors;
export const SIZES: readonly string[] = enums.sizes;
