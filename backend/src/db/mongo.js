import { MongoClient } from "mongodb";

// Mongo boundary: connection bootstrap + the auto-increment counters
// helper. Schema-specific work (index creation for a given entity) lives
// in `inventory/repo.js` where the schema is in scope.

export async function connectDb(url, dbName) {
  const client = await MongoClient.connect(url);
  return { client, db: client.db(dbName) };
}

// Auto-increment ids via a `counters` collection. Each caller picks a name
// (e.g. "duck") so sequences are independent across entity types.
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
