/**
 * ServiceContainer is a tiny service registry — one central place to register
 * and look up services by name. Today only "duck" is registered; the container
 * exists so adding the next service (e.g. "order") is a one-line change in
 * server.js instead of a cascade through app.js/routes/tests.
 *
 * Mutable at runtime. Tests are expected to register fake services here.
 */
export class ServiceContainer {
  #services = new Map();

  register(name, service) {
    if (!name || typeof name !== "string") {
      throw new Error("ServiceContainer.register: name must be a non-empty string");
    }
    if (this.#services.has(name)) {
      throw new Error(`ServiceContainer: "${name}" already registered`);
    }
    this.#services.set(name, service);
  }

  get(name) {
    if (!this.#services.has(name)) {
      throw new Error(`ServiceContainer: "${name}" not registered`);
    }
    return this.#services.get(name);
  }
}
