import { BaseService } from "../services/BaseService.js";
import { ValidationError } from "../errors.js";
import { validateOrderInput } from "./validateOrderInput.js";

// OrderService orchestrates the order-processing pipeline:
// validate → lookup item via inventory → build package → calculate total.
// Dependencies are injected so tests can swap inventory for a fake.
//
// Schema-aware: the schema's `orders.lookupItemBy` list tells us which
// request fields to use as the lookup key. For ducks that's ["color","size"].
export class OrderService extends BaseService {
  constructor(inventory, packaging, pricing, schema) {
    super({ entityName: "order" });
    this.inventory = inventory;
    this.packaging = packaging;
    this.pricing = pricing;
    this.schema = schema;
  }

  async process(req) {
    // Normalize before validation so downstream pricing sees the same
    // value — otherwise "  USA  " passes the non-empty check but falls
    // through to the default (+15%) tax in pricing.
    const country = typeof req?.country === "string" ? req.country.trim() : req?.country;
    const normalized = { ...req, country };

    const { valid, errors } = validateOrderInput(normalized);
    if (!valid) throw new ValidationError(errors);

    // Delegate color/size validation to the inventory service — if the
    // caller passed bad enum values, findByAttributes throws
    // ValidationError with the same shape. If the item doesn't exist it
    // throws NotFoundError. Either way the HTTP error middleware
    // formats the response consistently.
    const lookupKeys = this.schema.ordersConfig?.lookupItemBy ?? [];
    const lookup = {};
    for (const key of lookupKeys) lookup[key] = normalized[key];
    const item = await this.inventory.findByAttributes(lookup);

    const pkg = this.packaging.build(normalized.size, normalized.shippingMode);
    const result = this.pricing.calculate({
      quantity: normalized.quantity,
      unitPrice: item.price,
      material: pkg.material,
      country: normalized.country,
      shippingMode: normalized.shippingMode,
    });

    return {
      packageType: pkg.material,
      protections: pkg.protections,
      total: result.total,
      details: result.details,
    };
  }
}
