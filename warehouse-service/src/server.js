import { MongoClient } from "mongodb";
import { createDuckRepo } from "./repos/duckRepo.js";
import { createDuckService } from "./services/duckService.js";
import { createApp } from "./app.js";

const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017";
const MONGO_DB = process.env.MONGO_DB || "duckstore";
const PORT = Number(process.env.PORT) || 4001;

const client = await MongoClient.connect(MONGO_URL);
const db = client.db(MONGO_DB);

// Index supporting findMatch(color, size, price, deleted). Idempotent.
await db
  .collection("ducks")
  .createIndex({ color: 1, size: 1, price: 1, deleted: 1 });

const repo = createDuckRepo(db);
const service = createDuckService(repo);
const app = createApp(service);

app.listen(PORT, () => {
  console.log(`warehouse-service listening on :${PORT} (db: ${MONGO_DB})`);
});
