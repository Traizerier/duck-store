import { COLORS, SIZES } from "../constants/ducks.js";

function isValidPrice(v) {
  return Number.isFinite(v) && v > 0;
}

function isValidQuantity(v) {
  return Number.isInteger(v) && v >= 0;
}

export function validateDuckInput(input) {
  const data = input ?? {};
  const errors = {};

  if (!COLORS.includes(data.color)) {
    errors.color = `must be one of: ${COLORS.join(", ")}`;
  }
  if (!SIZES.includes(data.size)) {
    errors.size = `must be one of: ${SIZES.join(", ")}`;
  }
  if (!isValidPrice(data.price)) {
    errors.price = "must be a positive number";
  }
  if (!isValidQuantity(data.quantity)) {
    errors.quantity = "must be a non-negative integer";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

// Used by the /api/ducks/lookup route. Checks color + size against the
// shared enums so unknown/missing values surface as 400 ValidationError
// instead of tunneling through to "no duck found" 404s.
export function validateLookupQuery(query) {
  const data = query ?? {};
  const errors = {};

  if (!COLORS.includes(data.color)) {
    errors.color = `must be one of: ${COLORS.join(", ")}`;
  }
  if (!SIZES.includes(data.size)) {
    errors.size = `must be one of: ${SIZES.join(", ")}`;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateDuckUpdate(fields) {
  const data = fields ?? {};
  const errors = {};

  if ("price" in data && !isValidPrice(data.price)) {
    errors.price = "must be a positive number";
  }
  if ("quantity" in data && !isValidQuantity(data.quantity)) {
    errors.quantity = "must be a non-negative integer";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
