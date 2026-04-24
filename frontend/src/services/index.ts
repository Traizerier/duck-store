import { DuckService } from "./DuckService";

// Singleton service accessor. Components import `services` and reach
// individual services as `services.duck`, `services.order`, etc.
//
// Extensible: adding a new service is a one-line addition here plus the
// service's own file. No provider, no context, no wrapper to unwind.
export const services = {
  duck: new DuckService(),
} as const;

export type Services = typeof services;

export { ApiError } from "./BaseService";
