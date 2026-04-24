// Package service holds the common scaffolding that domain-specific services
// embed. Today that's a tiny BaseService with just a name for identification
// in logs and diagnostics — kept minimal on purpose so each domain service
// stays its own clear thing and the shared surface doesn't grow by accident.
package service

type BaseService struct {
	name string
}

func New(name string) BaseService {
	return BaseService{name: name}
}

// Name is the service's identifier (e.g. "packaging", "pricing", "order").
// Useful for log lines that need to tag which service produced them.
func (b BaseService) Name() string { return b.name }
