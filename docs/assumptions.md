# Assumptions

The spec leaves a number of details open. Each decision below is a pragmatic read of the spec — happy to flip any of them if the reviewer has a different interpretation.

## Warehouse

### Data validation
- **Price** must be **strictly > 0**. A duck sold for $0 makes no sense in inventory.
- **Quantity** must be **≥ 0** (integer). Zero is valid — lets an admin register a SKU that's temporarily out of stock.
- **Color / size enums are case-sensitive**. The spec gives them capitalized (`"Red"`, `"XLarge"`); the frontend's `<select>` emits those exact values.

### Merge-on-add
- `findMatch({color, size, price})` filters by `deleted: false`. A logically-deleted duck with the same attributes does **not** match — adding creates a new row instead of resurrecting the deleted one. Old row stays deleted for audit.

### List
- Sorted by **quantity ascending** (low to high). Spec says "sort by quantity" without direction; ascending is more useful for an inventory view where low-stock items deserve attention.

### Update
- Only `price` and `quantity` are editable. Color / size are enforced as read-only **structurally** — `pickEditableFields` drops them from the payload before validation or persistence, rather than rejecting the request with 400. A client that sends `{color: "Blue", price: 15}` gets price updated and color silently ignored.

### Deletion
- Terminal. A deleted duck can't be updated, can't be re-deleted, and doesn't match on re-add. All these return `404 Not Found`.

### IDs
- Integer, auto-incremented via a Mongo `counters` collection (`findOneAndUpdate` with `$inc` and `upsert: true`). The repo maps Mongo's `_id` field to `id` in all outputs so nothing upstream knows we're using Mongo.

### HTTP status codes
- `POST /api/ducks` always returns **201** — whether a new row was inserted or an existing row's quantity was merged. From the client's POV, "add to inventory" is always a create semantically.
- `DELETE /api/ducks/:id` returns **204 No Content** on success.
- `GET /api/ducks/lookup?color&size` returns the first matching active duck or 404. Assumes a single active duck per `{color, size}`; if multiple exist (same `color+size` but different prices), the lookup returns whichever Mongo finds first. If this becomes a real product concern, the lookup should probably return all matches and let the caller pick.

## Store

### Pricing rule order
- `base → volume discount → material adjustment → country tax → shipping surcharge`, in that order.
- Percentages **compound on the running total**, not on the base. The spec's wording ("apply X% discount to the total cost") reads naturally as the running total.
- Shipping is additive (flat for sea, per-unit for land/air), so its position relative to the percentage rules changes the final figure. The ordering above was chosen because percentages logically apply to the goods themselves; shipping is a downstream surcharge on top of the final goods cost.

### Input
- Color / size / shipping mode must match spec enums exactly (case-sensitive).
- Shipping mode values are lowercase (`"air"`, `"land"`, `"sea"`) matching the packaging package's constants. Spec text uses capitalized names; treating those as display strings only.

### Error mapping
- Validation failures → `400`.
- Warehouse lookup failure → `502 Bad Gateway` (upstream service fault, not client's fault).
- Any unexpected error → `500`.

## Cross-cutting

### Color palette source of truth
- Warehouse owns the canonical color list (`src/constants/ducks.js`). Store's order validator hardcodes the same list because there's no shared schema between services. If a mismatch emerges, the warehouse is authoritative — update the store and redeploy.

### Frontend
- UI targets the warehouse module only. Store's `/api/orders` has no UI per spec.
- Color / size labels in the table are bilingual to match the mockup (`Red / Rojo`, `XLarge`, etc.).
