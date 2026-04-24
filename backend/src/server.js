import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { connectDb, createCounters } from "./db/mongo.js";
import { Schema } from "./schemas/Schema.js";
import { createInventoryRepo, createInventoryIndex } from "./inventory/repo.js";
import { InventoryService } from "./inventory/service.js";
import { PackagingService } from "./packaging/service.js";
import { PricingService } from "./pricing/service.js";
import { OrderService } from "./order/orderService.js";
import { ServiceContainer } from "./container.js";
import { createApp } from "./app.js";

const here = dirname(fileURLToPath(import.meta.url));

const MONGO_URL   = process.env.MONGO_URL   || "mongodb://localhost:27017";
const MONGO_DB    = process.env.MONGO_DB    || "duckstore";
const PORT        = Number(process.env.PORT) || 4001;
const INSTANCE    = process.env.INSTANCE    || "default";
const SCHEMA_PATH = process.env.SCHEMA_PATH || resolve(here, "./schemas/duck.json");
const ENUMS_PATH  = process.env.ENUMS_PATH  || resolve(here, "../../shared/enums.json");

// Load the schema first so a typo fails fast, before we've opened a Mongo
// connection we'd just have to close again.
const schema = await Schema.load(SCHEMA_PATH, ENUMS_PATH);

const { client, db } = await connectDb(MONGO_URL, MONGO_DB);
await createInventoryIndex(db, schema);

const counters = createCounters(db);
const inventoryRepo = createInventoryRepo(db, schema, counters);

// Build the service container. Inventory is always present; the order
// pipeline (packaging + pricing + order) mounts only when the schema
// declares orders.enabled — other entity types can opt out.
const container = new ServiceContainer();
const registered = [];
const register = (name, svc) => { container.register(name, svc); registered.push(name); };

register("inventory", new InventoryService(schema, inventoryRepo));
if (schema.hasOrders) {
  register("packaging", new PackagingService());
  register("pricing",   new PricingService());
  register("order",     new OrderService(
    container.get("inventory"),
    container.get("packaging"),
    container.get("pricing"),
    schema,
  ));
}

// Init-log for every registered service so the boot output tells the
// operator which subsystems came online for this instance.
for (const name of registered) {
  console.log(`service initialized: ${name}`);
}

const app = createApp(container, schema);

const server = app.listen(PORT, () => {
  console.log(
    `backend [${INSTANCE}] listening on :${PORT} (schema: ${schema.name}, db: ${MONGO_DB})`,
  );
});

// Graceful shutdown: stop accepting new connections, then close the Mongo
// client. Guards against double-invocation if SIGINT follows SIGTERM closely.
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`received ${signal}, shutting down`);
  server.close();
  await client.close();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
