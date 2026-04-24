import { isValidShippingMode, shippingModes } from "../packaging/packaging.js";

// Validates the fixed-shape order request: quantity / country /
// shippingMode. Color/size validation is delegated to the inventory
// service's findByAttributes (same enums, same shape, same error class) so
// this validator stays focused on the order-specific fields.
export function validateOrderInput(input) {
  const data = input ?? {};
  const errors = {};

  if (!Number.isInteger(data.quantity) || data.quantity <= 0) {
    errors.quantity = "must be a positive integer";
  }
  if (!isValidShippingMode(data.shippingMode)) {
    errors.shippingMode = `must be one of: ${shippingModes().join(", ")}`;
  }
  if (typeof data.country !== "string" || data.country.trim() === "") {
    errors.country = "required";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
