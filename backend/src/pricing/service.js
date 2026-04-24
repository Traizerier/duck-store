import { BaseService } from "../services/BaseService.js";
import { calculate } from "./pricing.js";

// PricingService wraps the Chain-of-Responsibility calculator as a
// service. The rules pipeline stays in `pricing.js`; the service just
// exposes it as a method for consumers that want to inject it.
export class PricingService extends BaseService {
  constructor() {
    super({ entityName: "pricing" });
  }

  calculate(req) {
    return calculate(req);
  }
}
