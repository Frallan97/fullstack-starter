package middleware

import (
	"context"
	"crypto/rsa"
	"log"
	"net/http"
	"strings"

	customJWT "github.com/frallan97/nordic-options-hub/backend/pkg/jwt"
	"github.com/frallan97/nordic-options-hub/backend/services"
	"github.com/google/uuid"
)

type contextKey string

const (
	UserIDKey contextKey = "userID"
	EmailKey  contextKey = "email"
	NameKey   contextKey = "name"
)

// Auth is a middleware that validates JWT tokens and adds user info to context
func Auth(publicKey *rsa.PublicKey) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, "Missing authorization header", http.StatusUnauthorized)
				return
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || parts[0] != "Bearer" {
				http.Error(w, "Invalid authorization header format", http.StatusUnauthorized)
				return
			}

			tokenString := parts[1]
			claims, err := customJWT.ValidateAccessToken(tokenString, publicKey)
			if err != nil {
				http.Error(w, "Invalid or expired token", http.StatusUnauthorized)
				return
			}

			// Sync user to local database (create or update)
			user, err := services.CreateOrUpdateUser(r.Context(), claims.UserID, claims.Email, claims.Name)
			if err != nil {
				// Log error but don't fail - user data in JWT is sufficient
				// This provides graceful degradation if DB has issues
				log.Printf("[AUTH] Failed to sync user %s: %v", claims.UserID, err)
			}

			// Check if user is active (only if sync succeeded)
			if user != nil && !user.IsActive {
				http.Error(w, "User account is inactive", http.StatusForbidden)
				return
			}

			ctx := context.WithValue(r.Context(), UserIDKey, claims.UserID)
			ctx = context.WithValue(ctx, EmailKey, claims.Email)
			ctx = context.WithValue(ctx, NameKey, claims.Name)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetUserID extracts user ID from request context
func GetUserID(ctx context.Context) (uuid.UUID, bool) {
	userID, ok := ctx.Value(UserIDKey).(uuid.UUID)
	return userID, ok
}

// GetEmail extracts email from request context
func GetEmail(ctx context.Context) (string, bool) {
	email, ok := ctx.Value(EmailKey).(string)
	return email, ok
}

// GetName extracts name from request context
func GetName(ctx context.Context) (string, bool) {
	name, ok := ctx.Value(NameKey).(string)
	return name, ok
}
