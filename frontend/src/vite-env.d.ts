// Declare the Vite-injected import.meta.env shape locally so both the host
// IDE (which has no node_modules — deps live in the container volume) and
// tsc-in-container resolve it the same way. We only use .DEV today; add
// more fields here as needed rather than pulling in vite/client.
interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
