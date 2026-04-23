import { MongoClient } from "mongodb";

// Infrastructure for the Mongo boundary: connection bootstrap, index
// creation, and the auto-increment counters helper. Lives here (not in
// server.js or repos/) so the plan's layering rule is visible in the tree —
// `routes/` → `services/` → `repos/` → `db/`.

export async function connectDb(url, dbName) {
  const client = await MongoClient.connect(url);
  return { client, db: client.db(dbName) };
}

// Compound index supporting findMatch(color, size, price, deleted:false).
// createIndex is idempotent — safe to call on every boot.
export async function createDucksIndex(db) {
  await db
    .collection("ducks")
    .createIndex({ color: 1, size: 1, price: 1, deleted: 1 });
}

// Auto-increment ids via a `counters` collection. Each caller picks a name
// (e.g. "ducks") so sequences are independent.
export function createCounters(db) {
  const counters = db.collection("counters");
  return {
    async nextId(name) {
      const result = await counters.findOneAndUpdate(
        { _id: name },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: "after" },
      );
      return result.seq;
    },
  };
}
