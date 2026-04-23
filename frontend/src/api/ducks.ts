export interface Duck {
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

export type DuckUpdate = Partial<Pick<Duck, "price" | "quantity">>;

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`API error: ${status}`);
    this.name = "ApiError";
  }
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body);
  }
  return res;
}

function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export async function listDucks(): Promise<Duck[]> {
  const res = await apiFetch("/api/ducks");
  return res.json();
}

export async function createDuck(input: DuckInput): Promise<Duck> {
  const res = await apiFetch("/api/ducks", jsonRequest("POST", input));
  return res.json();
}

export async function updateDuck(id: number, fields: DuckUpdate): Promise<Duck> {
  const res = await apiFetch(`/api/ducks/${id}`, jsonRequest("PATCH", fields));
  return res.json();
}

export async function deleteDuck(id: number): Promise<void> {
  await apiFetch(`/api/ducks/${id}`, { method: "DELETE" });
}
