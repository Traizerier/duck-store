function toDuck(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

// Takes a counters helper (from db/mongo.js) so ID generation lives in the
// db layer, not here. The repo only speaks in ducks.
export function createDuckRepo(db, counters) {
  const ducks = db.collection("ducks");

  return {
    async findMatch({ color, size, price }) {
      return toDuck(await ducks.findOne({ color, size, price, deleted: false }));
    },

    async findById(id) {
      return toDuck(await ducks.findOne({ _id: id, deleted: false }));
    },

    async findActiveByColorAndSize({ color, size }) {
      return toDuck(await ducks.findOne({ color, size, deleted: false }));
    },

    async insert(duck) {
      const _id = await counters.nextId("ducks");
      const doc = { _id, ...duck };
      await ducks.insertOne(doc);
      return toDuck(doc);
    },

    // Mutations below all include `deleted: false` in the filter so the
    // repo enforces the logical-deletion rule at its own boundary — a
    // caller that skips the service layer can't mutate, resurrect, or
    // re-delete a tombstoned duck. Returns null if no active row matches;
    // the service layer maps that to NotFoundError.

    async update(id, fields) {
      return toDuck(
        await ducks.findOneAndUpdate(
          { _id: id, deleted: false },
          { $set: fields },
          { returnDocument: "after" },
        ),
      );
    },

    async incrementQuantity(id, delta) {
      return toDuck(
        await ducks.findOneAndUpdate(
          { _id: id, deleted: false },
          { $inc: { quantity: delta } },
          { returnDocument: "after" },
        ),
      );
    },

    async softDelete(id) {
      return toDuck(
        await ducks.findOneAndUpdate(
          { _id: id, deleted: false },
          { $set: { deleted: true } },
          { returnDocument: "after" },
        ),
      );
    },

    async listActive() {
      const docs = await ducks.find({ deleted: false }).sort({ quantity: 1 }).toArray();
      return docs.map(toDuck);
    },
  };
}
