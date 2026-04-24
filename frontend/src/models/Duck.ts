import type { DuckService, DuckData, DuckUpdate } from "../services/DuckService";

// Duck is an active-record model: components get Duck instances from the
// service (list/create) and mutate them via update/delete directly on the
// instance, without threading ids and field bags through the UI layer.
//
// The service reference is held privately and omitted from toJSON so React
// devtools / JSON.stringify don't walk it.
export class Duck implements DuckData {
  id!: number;
  color!: string;
  size!: string;
  price!: number;
  quantity!: number;
  deleted!: boolean;

  constructor(
    private readonly service: DuckService,
    data: DuckData,
  ) {
    Object.assign(this, data);
  }

  // Apply a partial update: mutate the given fields locally, then persist
  // just those fields.
  async update(fields: DuckUpdate): Promise<void> {
    const updated = await this.service._patch(this.id, fields);
    Object.assign(this, updated);
  }

  async delete(): Promise<void> {
    await this.service._delete(this.id);
    this.deleted = true;
  }

  // Strip the private service reference from serialized output so
  // JSON.stringify(duck) yields a plain data shape.
  toJSON(): DuckData {
    return {
      id: this.id,
      color: this.color,
      size: this.size,
      price: this.price,
      quantity: this.quantity,
      deleted: this.deleted,
    };
  }
}
