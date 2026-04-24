package service

import "testing"

func TestBaseService_Name(t *testing.T) {
	s := New("packaging")
	if s.Name() != "packaging" {
		t.Errorf("Name() = %q, want %q", s.Name(), "packaging")
	}
}
