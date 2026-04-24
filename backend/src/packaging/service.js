import { BaseService } from "../services/BaseService.js";
import { build } from "./packaging.js";

// PackagingService is the service-shaped adapter over `build`. The factory
// stays as the implementation — the service wrapper gives us an injection
// seam for consumers that prefer a method receiver (and keeps the
// cross-stack service-symmetry story intact).
export class PackagingService extends BaseService {
  constructor() {
    super({ entityName: "packaging" });
  }

  build(size, mode) {
    return build(size, mode);
  }
}
