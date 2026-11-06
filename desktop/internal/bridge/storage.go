package bridge

import (
	"context"

	"omnimail/desktop/internal/service"
)

type StorageBridge struct{ storage *service.Storage }

func NewStorageBridge(storage *service.Storage) *StorageBridge {
	return &StorageBridge{storage: storage}
}

func (b *StorageBridge) Usage(ctx context.Context) (service.StorageUsage, error) {
	return b.storage.Usage(ctx)
}
