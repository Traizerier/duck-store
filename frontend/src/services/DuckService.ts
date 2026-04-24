import { BaseService } from "./BaseService";
import { Duck } from "../models/Duck";

// DuckData is the raw JSON shape the warehouse returns. Keep this as an
// interface (not the model class) so places that only need to read fields
// don't pull in the model's behavior.
export interface DuckData {
  id: number;
  color: string;
  size: string;
  price: number;
  quantity: number;
  deleted: boolean;
}

export interface DuckInput {
  color: string;
  size: string;
  price: number;
  quantity: number;
}

export type DuckUpdate = Partial<Pick<DuckData, "price" | "quantity">>;

// DuckService owns the HTTP calls. list() and create() are the public API
// that components use; _patch / _delete are package-private helpers the
// Duck model uses to persist itself.
export class DuckService extends BaseService {
  constructor() {
    super("/api/ducks");
  }

  async list(): Promise<Duck[]> {
    const rows = await this.request<DuckData[]>("");
    return rows.map((row) => new Duck(this, row));
  }

  async create(input: DuckInput): Promise<Duck> {
    const row = await this.request<DuckData>("", this.jsonInit("POST", input));
    return new Duck(this, row);
  }

  // Internal — called by Duck.update(). Returns the raw row; the model
  // is responsible for mutating itself in place.
  async _patch(id: number, fields: DuckUpdate): Promise<DuckData> {
    return this.request<DuckData>(`/${id}`, this.jsonInit("PATCH", fields));
  }

  // Internal — called by Duck.delete().
  async _delete(id: number): Promise<void> {
    await this.requestVoid(`/${id}`, { method: "DELETE" });
  }
}
