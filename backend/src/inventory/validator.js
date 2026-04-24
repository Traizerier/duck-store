// Schema-driven validators. Each returns { valid, errors } with the same
// shape the rest of the codebase's error middleware expects, so a call site
// that used to reach for duckValidator doesn't care that the checks are now
// generated from a schema.
//
// Rule set is intentionally minimal — exactly what the duck schema needs
// today (enum / number-positive / integer-non-negative). Adding a new rule
// or field type is a branch here plus the matching schema spec.

function checkField(fieldName, spec, value, errors, schema) {
  const provided = value !== undefined && value !== null && value !== "";

  if (!provided) {
    if (spec.required) errors[fieldName] = "required";
    return;
  }

  switch (spec.type) {
    case "enum": {
      const values = schema.enumValues(spec.enumRef);
      if (!values.includes(value)) {
        errors[fieldName] = `must be one of: ${values.join(", ")}`;
      }
      break;
    }
    case "number": {
      if (!Number.isFinite(value)) {
        errors[fieldName] = "must be a number";
      } else if (spec.rule === "positive" && !(value > 0)) {
        errors[fieldName] = "must be a positive number";
      } else if (spec.rule === "non-negative" && !(value >= 0)) {
        errors[fieldName] = "must be a non-negative number";
      }
      break;
    }
    case "integer": {
      if (!Number.isInteger(value)) {
        errors[fieldName] = "must be an integer";
      } else if (spec.rule === "positive" && !(value > 0)) {
        errors[fieldName] = "must be a positive integer";
      } else if (spec.rule === "non-negative" && !(value >= 0)) {
        errors[fieldName] = "must be a non-negative integer";
      }
      break;
    }
    case "string": {
      if (typeof value !== "string") {
        errors[fieldName] = "must be a string";
      }
      break;
    }
    default:
      throw new Error(`validator: unsupported field type "${spec.type}"`);
  }
}

export function buildValidators(schema) {
  return {
    validateInput(input) {
      const data = input ?? {};
      const errors = {};
      for (const [name, spec] of Object.entries(schema.fields)) {
        checkField(name, spec, data[name], errors, schema);
      }
      return { valid: Object.keys(errors).length === 0, errors };
    },

    // PATCH semantics: only editable fields considered; absence is fine
    // (partial updates). Fields not in `editable` are silently ignored at
    // the route layer; we don't flag them here.
    validateUpdate(fields) {
      const data = fields ?? {};
      const errors = {};
      for (const name of schema.editable) {
        if (!(name in data)) continue;
        const spec = schema.fields[name];
        // Treat as required for the purposes of "non-empty when provided."
        checkField(name, { ...spec, required: true }, data[name], errors, schema);
      }
      return { valid: Object.keys(errors).length === 0, errors };
    },

    validateLookupQuery(query) {
      const data = query ?? {};
      const errors = {};
      for (const name of schema.lookupBy) {
        const spec = schema.fields[name];
        checkField(name, { ...spec, required: true }, data[name], errors, schema);
      }
      return { valid: Object.keys(errors).length === 0, errors };
    },
  };
}
