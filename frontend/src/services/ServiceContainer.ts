import type { DuckService } from "./DuckService";

// The registry maps each name to its concrete service type so
// `get("duck")` returns a `DuckService` without callers specifying it.
// Adding a new service is a new key here + a `services.register(...)`
// call in `services/index.ts` — no call-site casts.
export interface ServiceRegistry {
  duck: DuckService;
}

export class ServiceContainer {
  private services = new Map<keyof ServiceRegistry, unknown>();

  register<K extends keyof ServiceRegistry>(name: K, service: ServiceRegistry[K]): void {
    if (!name || typeof name !== "string") {
      throw new Error("ServiceContainer.register: name must be a non-empty string");
    }
    if (this.services.has(name)) {
      throw new Error(`ServiceContainer: "${name}" already registered`);
    }
    this.services.set(name, service);
  }

  get<K extends keyof ServiceRegistry>(name: K): ServiceRegistry[K] {
    const svc = this.services.get(name);
    if (!svc) {
      throw new Error(`ServiceContainer: "${name}" not registered`);
    }
    return svc as ServiceRegistry[K];
  }
}
