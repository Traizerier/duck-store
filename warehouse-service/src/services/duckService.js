import { validateDuckInput, validateDuckUpdate } from "../validation/duckValidator.js";
import { ValidationError, NotFoundError } from "../errors.js";

const EDITABLE_FIELDS = ["price", "quantity"];

function pickEditableFields(fields) {
  const data = fields ?? {};
  const picked = {};
  for (const key of EDITABLE_FIELDS) {
    if (key in data) picked[key] = data[key];
  }
  return picked;
}

export function createDuckService(repo) {
  async function requireActiveDuck(id) {
    const duck = await repo.findById(id);
    if (!duck) throw new NotFoundError(`Duck ${id} not found`);
    return duck;
  }

  return {
    async create(input) {
      const { valid, errors } = validateDuckInput(input);
      if (!valid) throw new ValidationError(errors);

      const { color, size, price, quantity } = input;
      const match = await repo.findMatch({ color, size, price });

      if (match) {
        return repo.incrementQuantity(match.id, quantity);
      }
      return repo.insert({ color, size, price, quantity, deleted: false });
    },

    async update(id, fields) {
      const editable = pickEditableFields(fields);

      const { valid, errors } = validateDuckUpdate(editable);
      if (!valid) throw new ValidationError(errors);

      await requireActiveDuck(id);
      return repo.update(id, editable);
    },

    async delete(id) {
      await requireActiveDuck(id);
      return repo.softDelete(id);
    },

    async list() {
      return repo.listActive();
    },

    async findByColorAndSize({ color, size }) {
      const duck = await repo.findActiveByColorAndSize({ color, size });
      if (!duck) {
        throw new NotFoundError(`No duck found for color=${color}, size=${size}`);
      }
      return duck;
    },
  };
}
