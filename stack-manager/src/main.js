import { StackManager } from "./StackManager.js";
import { createApp } from "./server.js";

const PORT = Number(process.env.PORT) || 4000;
const REPO_ROOT = process.env.REPO_ROOT || process.cwd();
const TOKEN = process.env.CONTROL_PLANE_TOKEN;
const BACKEND_HOST = process.env.BACKEND_HOST || "localhost";

if (!TOKEN) {
  console.error(
    "[stack-manager] CONTROL_PLANE_TOKEN is not set. Refusing to start an unauthenticated control plane.",
  );
  process.exit(1);
}

const manager = new StackManager({ repoRoot: REPO_ROOT, backendHost: BACKEND_HOST });

try {
  const names = await manager.refresh();
  console.log(`[stack-manager] discovered stacks at boot: ${names.join(", ") || "(none)"}`);
} catch (err) {
  console.error(`[stack-manager] boot: failed to discover stacks under ${REPO_ROOT}`, err);
  process.exit(1);
}

const app = createApp({ manager, token: TOKEN });

const server = app.listen(PORT, () => {
  console.log(`[stack-manager] listening on :${PORT} (repoRoot=${REPO_ROOT})`);
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[stack-manager] received ${signal}, shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
