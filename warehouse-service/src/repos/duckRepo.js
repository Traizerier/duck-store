function toDuck(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

export function createDuckRepo(db) {
  const ducks = db.collection("ducks");
  const counters = db.collection("counters");

  async function nextId() {
    const result = await counters.findOneAndUpdate(
      { _id: "ducks" },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return result.seq;
  }

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
      const _id = await nextId();
      const doc = { _id, ...duck };
      await ducks.insertOne(doc);
      return toDuck(doc);
    },

    async update(id, fields) {
      return toDuck(
        await ducks.findOneAndUpdate(
          { _id: id },
          { $set: fields },
          { returnDocument: "after" },
        ),
      );
    },

    async incrementQuantity(id, delta) {
      return toDuck(
        await ducks.findOneAndUpdate(
          { _id: id },
          { $inc: { quantity: delta } },
          { returnDocument: "after" },
        ),
      );
    },

    async softDelete(id) {
      return toDuck(
        await ducks.findOneAndUpdate(
          { _id: id },
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
