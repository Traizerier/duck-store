package packaging

import "duckstore/store-service/internal/service"

// PackagingService is the service-shaped adapter over Build. The underlying
// pure function stays exported (for internal reuse) — the service just gives
// us an injection seam for consumers that prefer a method receiver.
type PackagingService struct {
	service.BaseService
}

func NewService() *PackagingService {
	return &PackagingService{BaseService: service.New("packaging")}
}

func (s *PackagingService) Build(size Size, mode ShippingMode) (Package, error) {
	return Build(size, mode)
}
