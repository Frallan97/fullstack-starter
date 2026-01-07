package handlers

import (
	"net/http"

	"github.com/casbin/casbin/v2"
	"github.com/frallan97/fullstack-starter/backend/config"
	"github.com/frallan97/fullstack-starter/backend/controllers"
	"github.com/frallan97/fullstack-starter/backend/middleware"
	"github.com/gorilla/mux"
)

// SetupRouter configures all routes
// IMPORTANT: All routes include OPTIONS method for CORS preflight requests
func SetupRouter(cfg *config.Config, enforcer *casbin.Enforcer) http.Handler {
	r := mux.NewRouter()

	// Global middleware - CORS must be first!
	r.Use(middleware.CORS)
	r.Use(middleware.Logger)
	r.Use(middleware.Recovery)

	// API v1 routes
	api := r.PathPrefix("/api/v1").Subrouter()

	// Public health check
	api.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}).Methods("GET", "OPTIONS")

	// Auth endpoints (public except /me)
	api.HandleFunc("/auth/refresh", controllers.RefreshToken).Methods("POST", "OPTIONS")
	api.HandleFunc("/auth/logout", controllers.Logout).Methods("POST", "OPTIONS")

	// Protected routes requiring authentication
	protected := api.PathPrefix("").Subrouter()
	protected.Use(middleware.Auth(cfg.JWTPublicKey))

	// Auth /me endpoint (authenticated)
	protected.HandleFunc("/auth/me", controllers.GetCurrentUser).Methods("GET", "OPTIONS")

	// Protected + Authorized routes
	authorized := protected.PathPrefix("").Subrouter()
	authorized.Use(middleware.Authorize(enforcer))

	// TODO: Add your application routes here
	// Example:
	// authorized.HandleFunc("/resource", controllers.GetResource).Methods("GET", "OPTIONS")
	// authorized.HandleFunc("/resource", controllers.CreateResource).Methods("POST", "OPTIONS")

	return r
}
