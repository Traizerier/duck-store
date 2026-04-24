// Generic inventory repo. Given a schema + a Mongo database + a counters
// helper, returns the same 8 methods the duck-specific repo exposed
// today — but the collection name, id counter name, match keys,
// merge-field, and sort come from the schema.

function toRow(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

export function createInventoryRepo(db, schema, counters) {
  const coll = db.collection(schema.collection);
  const idCounterName = schema.name;
  const mergeField = schema.mergeField;
  const sort = schema.defaultSort ?? { field: "_id", direction: "asc" };
  const sortSpec = { [sort.field]: sort.direction === "desc" ? -1 : 1 };

  // Mutations all filter on { _id, deleted: false } so a tombstoned row
  // can't be updated / re-deleted / resurrected. Mirrors the invariant
  // duckRepo established.
  return {
    async findMatch(attrs) {
      const filter = { deleted: false };
      for (const key of schema.matchOnInsert) filter[key] = attrs[key];
      return toRow(await coll.findOne(filter));
    },

    async findById(id) {
      return toRow(await coll.findOne({ _id: id, deleted: false }));
    },

    async findByAttributes(attrs) {
      // Build the filter from the set of keys actually present in attrs
      // (callers expected to constrain via schema.lookupBy at the route
      // boundary; this method is the general form).
      const filter = { deleted: false };
      for (const [k, v] of Object.entries(attrs)) filter[k] = v;
      return toRow(await coll.findOne(filter));
    },

    async insert(data) {
      const _id = await counters.nextId(idCounterName);
      const doc = { _id, ...data, deleted: false };
      await coll.insertOne(doc);
      return toRow(doc);
    },

    async update(id, fields) {
      return toRow(
        await coll.findOneAndUpdate(
          { _id: id, deleted: false },
          { $set: fields },
          { returnDocument: "after" },
        ),
      );
    },

    async incrementMergeField(id, delta) {
      return toRow(
        await coll.findOneAndUpdate(
          { _id: id, deleted: false },
          { $inc: { [mergeField]: delta } },
          { returnDocument: "after" },
        ),
      );
    },

    async softDelete(id) {
      return toRow(
        await coll.findOneAndUpdate(
          { _id: id, deleted: false },
          { $set: { deleted: true } },
          { returnDocument: "after" },
        ),
      );
    },

    async listActive() {
      const docs = await coll.find({ deleted: false }).sort(sortSpec).toArray();
      return docs.map(toRow);
    },
  };
}

// Build the compound index the repo relies on for findMatch performance:
// matchOnInsert fields + deleted. Idempotent — safe on every boot.
export async function createInventoryIndex(db, schema) {
  const key = {};
  for (const field of schema.matchOnInsert) key[field] = 1;
  key.deleted = 1;
  await db.collection(schema.collection).createIndex(key);
}
