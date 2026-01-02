package models

import (
	"time"

	"github.com/google/uuid"
)

// Item represents a generic item resource for demonstrating CRUD operations
type Item struct {
	ID          int       `json:"id"`
	UserID      uuid.UUID `json:"user_id"`
	Title       string    `json:"title"`
	Description *string   `json:"description,omitempty"`
	Status      string    `json:"status"` // 'active', 'archived'
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
