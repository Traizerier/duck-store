import { BaseService } from "../services/BaseService.js";
import { ValidationError, NotFoundError } from "../errors.js";
import { buildValidators } from "./validator.js";

// Picks only fields the schema marks as editable; anything else the caller
// sent is dropped silently (matches today's duckService.pickEditableFields).
function pickEditable(schema, fields) {
  const data = fields ?? {};
  const picked = {};
  for (const key of schema.editable) {
    if (key in data) picked[key] = data[key];
  }
  return picked;
}

// InventoryService is the schema-driven business-logic layer. Same 5 public
// methods the duck-specific service exposed, but the concrete behavior
// (what fields merge, what a lookup key looks like, what "valid" means)
// comes from the schema.
export class InventoryService extends BaseService {
  constructor(schema, repo) {
    super({ entityName: schema.name });
    this.schema = schema;
    this.repo = repo;
    const v = buildValidators(schema);
    this.validateInput = v.validateInput;
    this.validateUpdate = v.validateUpdate;
    this.validateLookupQuery = v.validateLookupQuery;
  }

  async create(input) {
    const { valid, errors } = this.validateInput(input);
    if (!valid) throw new ValidationError(errors);

    const match = await this.repo.findMatch(input);
    if (match) {
      // Merge-on-add: increment the schema's mergeField by the input's
      // value of that field. For ducks that's quantity += quantity.
      return this.repo.incrementMergeField(match.id, input[this.schema.mergeField]);
    }
    return this.repo.insert(input);
  }

  async update(id, fields) {
    const editable = pickEditable(this.schema, fields);

    const { valid, errors } = this.validateUpdate(editable);
    if (!valid) throw new ValidationError(errors);

    const updated = await this.repo.update(id, editable);
    if (!updated) throw new NotFoundError(`${this.entityName} ${id} not found`);
    return updated;
  }

  async delete(id) {
    const deleted = await this.repo.softDelete(id);
    if (!deleted) throw new NotFoundError(`${this.entityName} ${id} not found`);
    return deleted;
  }

  async list() {
    return this.repo.listActive();
  }

  async findByAttributes(query) {
    const { valid, errors } = this.validateLookupQuery(query);
    if (!valid) throw new ValidationError(errors);
    // Only pass lookupBy keys to the repo — extra query params are ignored.
    const attrs = {};
    for (const key of this.schema.lookupBy) {
      attrs[key] = query[key];
    }
    const row = await this.repo.findByAttributes(attrs);
    if (!row) {
      const desc = this.schema.lookupBy.map((k) => `${k}=${query[k]}`).join(", ");
      throw new NotFoundError(`No ${this.entityName} found for ${desc}`);
    }
    return row;
  }
}
