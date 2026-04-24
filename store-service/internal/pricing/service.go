package pricing

import "duckstore/store-service/internal/service"

// PricingService is the service-shaped adapter over Calculate. The rules
// pipeline stays in the package-level Calculate — the service just exposes
// it as a method for consumers that want to accept a Pricer interface.
type PricingService struct {
	service.BaseService
}

func NewService() *PricingService {
	return &PricingService{BaseService: service.New("pricing")}
}

func (s *PricingService) Calculate(req Request) Result {
	return Calculate(req)
}
