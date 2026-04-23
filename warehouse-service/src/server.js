import { connectDb, createDucksIndex, createCounters } from "./db/mongo.js";
import { createDuckRepo } from "./repos/duckRepo.js";
import { createDuckService } from "./services/duckService.js";
import { createApp } from "./app.js";

const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017";
const MONGO_DB = process.env.MONGO_DB || "duckstore";
const PORT = Number(process.env.PORT) || 4001;

const { client, db } = await connectDb(MONGO_URL, MONGO_DB);
await createDucksIndex(db);

const counters = createCounters(db);
const repo = createDuckRepo(db, counters);
const service = createDuckService(repo);
const app = createApp(service);

const server = app.listen(PORT, () => {
  console.log(`warehouse-service listening on :${PORT} (db: ${MONGO_DB})`);
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
