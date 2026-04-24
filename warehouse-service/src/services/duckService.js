import { validateDuckInput, validateDuckUpdate } from "../validation/duckValidator.js";
import { ValidationError, NotFoundError } from "../errors.js";
import { BaseService } from "./BaseService.js";

const EDITABLE_FIELDS = ["price", "quantity"];

function pickEditableFields(fields) {
  const data = fields ?? {};
  const picked = {};
  for (const key of EDITABLE_FIELDS) {
    if (key in data) picked[key] = data[key];
  }
  return picked;
}

export class DuckService extends BaseService {
  constructor(repo) {
    super({ entityName: "Duck" });
    this.repo = repo;
  }

  async create(input) {
    const { valid, errors } = validateDuckInput(input);
    if (!valid) throw new ValidationError(errors);

    const { color, size, price, quantity } = input;
    const match = await this.repo.findMatch({ color, size, price });

    if (match) {
      return this.repo.incrementQuantity(match.id, quantity);
    }
    return this.repo.insert({ color, size, price, quantity, deleted: false });
  }

  async update(id, fields) {
    const editable = pickEditableFields(fields);

    const { valid, errors } = validateDuckUpdate(editable);
    if (!valid) throw new ValidationError(errors);

    // Trust the repo's `{ _id: id, deleted: false }` filter as the single
    // source of truth: a null return means "no active duck matched", which
    // is NotFound. Skipping the previous requireActive pre-check also
    // closes the concurrent-delete TOCTOU where a row could be tombstoned
    // between the check and the mutation.
    const updated = await this.repo.update(id, editable);
    if (!updated) throw new NotFoundError(`Duck ${id} not found`);
    return updated;
  }

  async delete(id) {
    const deleted = await this.repo.softDelete(id);
    if (!deleted) throw new NotFoundError(`Duck ${id} not found`);
    return deleted;
  }

  async list() {
    return this.repo.listActive();
  }

  async findByColorAndSize({ color, size }) {
    const duck = await this.repo.findActiveByColorAndSize({ color, size });
    if (!duck) {
      // Direct NotFoundError (not the generic requireActive) because this
      // is a lookup-by-attributes, not by id.
      throw new NotFoundError(`No duck found for color=${color}, size=${size}`);
    }
    return duck;
  }
}
