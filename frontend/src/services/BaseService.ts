// ApiError carries the HTTP status + parsed body so route-level callers can
// branch on 400 validation payloads vs. other failures. Thrown by
// BaseService.request on any non-2xx response.
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`API error: ${status}`);
    this.name = "ApiError";
  }
}

// BaseService is the shared HTTP scaffold that domain services extend.
// Holds the base path for the service and a small handful of fetch helpers.
// Subclasses call this.request / this.requestVoid / this.jsonInit; they
// don't interact with fetch directly.
export abstract class BaseService {
  protected constructor(protected readonly basePath: string) {}

  // One place for the non-ok handling so additions (auth headers,
  // timeouts, etc.) don't have to land in two copies. Reads the body as
  // text first, then tries to parse as JSON — a non-JSON error body (HTML
  // from a misconfigured proxy, truncated response) is preserved as
  // `{error: "NonJsonResponse", raw}` instead of silently collapsed to
  // `{}`, which would drop the only debug breadcrumb on the floor.
  private async fetchOrThrow(path: string, init?: RequestInit): Promise<Response> {
    const res = await fetch(this.basePath + path, init);
    if (!res.ok) {
      const raw = await res.text();
      let body: unknown;
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        if (import.meta.env?.DEV) {
          console.warn(`[api] non-JSON error body from ${path}:`, raw);
        }
        body = { error: "NonJsonResponse", raw };
      }
      throw new ApiError(res.status, body);
    }
    return res;
  }

  protected async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await this.fetchOrThrow(path, init);
    return res.json() as Promise<T>;
  }

  protected async requestVoid(path: string, init?: RequestInit): Promise<void> {
    await this.fetchOrThrow(path, init);
  }

  protected jsonInit(method: string, body: unknown): RequestInit {
    return {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    };
  }
}
