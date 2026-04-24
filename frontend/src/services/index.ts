import { ServiceContainer } from "./ServiceContainer";
import { DuckService } from "./DuckService";

// Singleton service accessor. Each frontend instance in this codebase
// talks to exactly one backend (its own stack's), so there's one
// DuckService registered. The typed registry (see ServiceContainer.ts)
// means no casts at call sites.
//
// Adding a new service is a one-liner here plus a new key in the
// ServiceRegistry interface — that's what makes the pattern extensible.
export const services = new ServiceContainer();
services.register("duck", new DuckService("/api/ducks"));

export { ApiError } from "./BaseService";
export { ServiceContainer } from "./ServiceContainer";
export type { ServiceRegistry } from "./ServiceContainer";
