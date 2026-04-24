import { readFile } from "node:fs/promises";

// Schema is the entity definition the backend reads at boot. Every
// schema-driven subsystem (inventory repo/service/validator/routes)
// consumes an instance of this class.
//
// The raw shape is JSON:
//   { name, plural, collection, fields, editable, matchOnInsert,
//     mergeField, lookupBy, defaultSort, softDelete, orders? }
//
// At construction time we validate the minimum required shape so later
// subsystems can assume accessors are populated. Enum references are
// resolved eagerly via enumValues() so the first bad reference surfaces
// here, not mid-request.
export class Schema {
  static async load(schemaPath, enumsPath) {
    const [schemaRaw, enumsRaw] = await Promise.all([
      readFile(schemaPath, "utf-8"),
      readFile(enumsPath, "utf-8"),
    ]);
    return new Schema(JSON.parse(schemaRaw), JSON.parse(enumsRaw));
  }

  constructor(raw, enums) {
    for (const key of ["name", "plural", "collection", "fields", "editable", "matchOnInsert", "lookupBy"]) {
      if (raw[key] === undefined) {
        throw new Error(`Schema: missing required key "${key}"`);
      }
    }
    if (typeof raw.fields !== "object" || Object.keys(raw.fields).length === 0) {
      throw new Error("Schema: fields must be a non-empty object");
    }
    // Resolve enum references up front so a typo is caught at boot.
    for (const [fieldName, spec] of Object.entries(raw.fields)) {
      if (spec.type === "enum") {
        if (!spec.enumRef) {
          throw new Error(`Schema: field "${fieldName}" has type=enum but no enumRef`);
        }
        if (!enums[spec.enumRef]) {
          throw new Error(`Schema: field "${fieldName}" references unknown enum "${spec.enumRef}"`);
        }
      }
    }
    this._raw = raw;
    this._enums = enums;
  }

  get name()          { return this._raw.name; }
  get plural()        { return this._raw.plural; }
  get collection()    { return this._raw.collection; }
  get fields()        { return this._raw.fields; }
  get editable()      { return this._raw.editable; }
  get matchOnInsert() { return this._raw.matchOnInsert; }
  get mergeField()    { return this._raw.mergeField; }
  get lookupBy()      { return this._raw.lookupBy; }
  get defaultSort()   { return this._raw.defaultSort ?? { field: "_id", direction: "asc" }; }
  get softDelete()    { return this._raw.softDelete !== false; }
  get hasOrders()     { return !!this._raw.orders?.enabled; }
  get ordersConfig()  { return this._raw.orders; }

  // Enum values for a referenced enum name. Throws if the name isn't
  // known — catches typos in field specs and in handler code.
  enumValues(enumRef) {
    const values = this._enums[enumRef];
    if (!values) {
      throw new Error(`Schema: unknown enum "${enumRef}"`);
    }
    return values;
  }
}
