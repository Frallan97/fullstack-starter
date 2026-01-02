# Fullstack Starter Template

A production-ready full-stack application template with enterprise authentication, authorization, and complete deployment infrastructure.

## 🎯 Overview

This template provides everything you need to quickly bootstrap a new full-stack application:

- **Authentication**: Google OAuth 2.0 via separate microservice with JWT (RS256) tokens
- **Authorization**: Casbin RBAC/ABAC for fine-grained access control
- **Backend**: Go 1.24 with Gorilla Mux, PostgreSQL, and Clean Architecture
- **Frontend**: React 18 + TypeScript + Vite + shadcn/ui + Tailwind CSS
- **DevOps**: Docker Compose, Kubernetes/Helm charts, GitHub Actions CI/CD
- **Example**: Complete "items" CRUD to demonstrate patterns

## 📁 Project Structure

```
fullstack-starter/
├── backend/                   # Go REST API
│   ├── config/               # Configuration + Casbin model
│   ├── controllers/          # HTTP handlers (TODO: create auth_controller, item_controller)
│   ├── database/             # DB connection + migrations
│   ├── handlers/             # Router setup (TODO: create router.go)
│   ├── middleware/           # Auth, Casbin, CORS, logging
│   ├── migrations/           # SQL migrations (TODO: create 6 files)
│   ├── models/               # Data structures (user, item)
│   ├── pkg/jwt/              # JWT utilities
│   └── services/             # Business logic
│
├── frontend/                 # React TypeScript app
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/        # ProtectedRoute, UserMenu
│   │   │   ├── items/       # TODO: create ItemsList, ItemForm, ItemCard
│   │   │   ├── layout/      # TODO: create MainLayout, Sidebar
│   │   │   └── ui/          # shadcn/ui components
│   │   ├── context/         # AuthContext
│   │   ├── lib/             # API client, utilities
│   │   └── pages/           # TODO: create Dashboard, Items, update App.tsx
│   └── [config files]       # package.json, vite.config.ts, etc.
│
├── charts/fullstack-starter/ # Helm chart (TODO: copy and customize)
├── .github/workflows/        # GitHub Actions (TODO: copy and update)
├── scripts/                  # Setup scripts
├── docker-compose.yml        # Local development environment
└── .env.example              # Environment variables template
```

## 🚀 Quick Start

### Prerequisites

- **Docker & Docker Compose** - for local development
- **Bun** (NOT Node.js) - `curl -fsSL https://bun.sh/install | bash`
- **Go 1.24+** - for native backend development (optional)
- **Google OAuth Credentials** - from [Google Cloud Console](https://console.cloud.google.com/apis/credentials)

### Setup Steps

1. **Clone and configure environment**:
   ```bash
   cd fullstack-starter
   cp .env.example .env
   # Edit .env and add your Google OAuth credentials
   ```

2. **Ensure auth-service exists**:
   This template requires the separate auth-service at `../auth-service/`.
   If you don't have it, clone it first:
   ```bash
   cd ../
   git clone <auth-service-repo> auth-service
   cd auth-service/backend
   # Generate RSA keys for JWT signing
   mkdir -p keys
   openssl genrsa -out keys/private.pem 4096
   openssl rsa -in keys/private.pem -pubout -out keys/public.pem
   ```

3. **Start all services**:
   ```bash
   docker compose up -d
   ```

4. **Access the application**:
   - **Frontend**: http://localhost:5173
   - **Backend API**: http://localhost:8080
   - **Auth Service**: http://localhost:8081

### Native Development (without Docker)

For faster iteration with hot reload:

```bash
# Terminal 1: Start databases and auth-service
docker compose up auth-db auth-service db -d

# Terminal 2: Run backend with Air hot reload
cd backend
DEBUG=true air

# Terminal 3: Run frontend with Vite
cd frontend
bun dev
```

## 🔧 Configuration

### Environment Variables

See `.env.example` for all available configuration options. Key variables:

**Database:**
- `DATABASE_URL` - PostgreSQL connection string
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`

**Backend:**
- `PORT` - Server port (default: 8080)
- `ENVIRONMENT` - development/production
- `DEBUG` - Enable verbose logging
- `AUTH_SERVICE_URL` - URL of auth microservice
- `ALLOWED_ORIGINS` - CORS origins (comma-separated)

**Frontend:**
- `VITE_API_URL` - Backend API URL
- `VITE_AUTH_SERVICE_URL` - Auth service URL for OAuth flow

**Google OAuth:**
- `GOOGLE_CLIENT_ID` - From Google Cloud Console
- `GOOGLE_CLIENT_SECRET` - From Google Cloud Console

## 🏗️ Architecture

### Authentication Flow

```
┌─────────┐   1. Click Login    ┌──────────────┐
│ Browser │ ───────────────────▶│ Auth Service │
│         │   2. Redirect to    │ (OAuth 2.0)  │
│         │◀─────Google OAuth───│              │
└─────────┘   3. Access Token   └──────────────┘
     │             (JWT)                │
     │ 4. API Request                  │
     │    Authorization: Bearer <JWT>  │
     ▼                                 ▼
┌─────────────────────────────────────────┐
│ Backend API                             │
│ ┌─────────────────────────────────────┐ │
│ │ Middleware Chain                    │ │
│ │ 1. Auth: Validate JWT with RSA key  │ │
│ │ 2. Sync user to local DB            │ │
│ │ 3. Casbin: Check permissions        │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ Controllers (Business Logic)        │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### Key Design Decisions

1. **Microservices Authentication**: Centralized auth-service can be shared across multiple applications
2. **JWT with RS256**: Asymmetric signing allows backend to verify tokens using only public key
3. **Casbin RBAC**: Database-backed policies for flexible, runtime-configurable authorization
4. **User Sync**: JWT claims automatically synced to local user table for relational integrity
5. **Resource Ownership**: All data models include `user_id` foreign key for multi-tenancy

## 📝 Remaining Implementation

This template is **partially complete**. The following files need to be created:

### Backend (3 files to create)

1. **`backend/controllers/auth_controller.go`** - Auth endpoints
   - `GetCurrentUser(w, r)` - Return user info from JWT context
   - `RefreshToken(w, r)` - Proxy refresh request to auth-service
   - `Logout(w, r)` - Proxy logout request to auth-service

   **Pattern**: Extract from nordic-options-hub `/backend/controllers/auth_controller.go`

2. **`backend/controllers/item_controller.go`** - Items CRUD
   - `GetItems(w, r)` - List user's items
   - `GetItemByID(w, r)` - Get single item
   - `CreateItem(w, r)` - Create new item
   - `UpdateItem(w, r)` - Update item
   - `DeleteItem(w, r)` - Delete item

   **Pattern**: Use nordic-options-hub `/backend/controllers/alert_controller.go` as template

3. **`backend/handlers/router.go`** - Route definitions
   ```go
   // Public routes
   api.HandleFunc("/health", healthCheck).Methods("GET")

   // Auth endpoints
   authRouter := api.PathPrefix("/auth").Subrouter()
   authRouter.Use(middleware.Auth(cfg.JWTPublicKey))
   authRouter.HandleFunc("/me", controllers.GetCurrentUser).Methods("GET")
   api.HandleFunc("/auth/refresh", controllers.RefreshToken).Methods("POST")
   api.HandleFunc("/auth/logout", controllers.Logout).Methods("POST")

   // Protected CRUD endpoints
   protected := api.PathPrefix("").Subrouter()
   protected.Use(middleware.Auth(cfg.JWTPublicKey))
   protected.Use(middleware.Authorize(enforcer))
   protected.HandleFunc("/items", controllers.GetItems).Methods("GET")
   protected.HandleFunc("/items", controllers.CreateItem).Methods("POST")
   protected.HandleFunc("/items/{id}", controllers.GetItemByID).Methods("GET")
   protected.HandleFunc("/items/{id}", controllers.UpdateItem).Methods("PATCH")
   protected.HandleFunc("/items/{id}", controllers.DeleteItem).Methods("DELETE")
   ```

   **Pattern**: Simplify nordic-options-hub `/backend/handlers/router.go`

4. **Database Migrations (6 files)** - see Migration Files section below

### Frontend (7 files to create)

1. **`frontend/src/App.tsx`** - React Router setup
2. **`frontend/src/lib/api-client.ts`** - API wrapper with items endpoints
3. **`frontend/src/components/layout/MainLayout.tsx`** - App wrapper with sidebar
4. **`frontend/src/components/layout/Sidebar.tsx`** - Navigation menu
5. **`frontend/src/components/items/ItemsList.tsx`** - Items table/grid
6. **`frontend/src/components/items/ItemForm.tsx`** - Create/edit dialog
7. **`frontend/src/components/items/ItemCard.tsx`** - Item display
8. **`frontend/src/pages/Dashboard.tsx`** - Welcome page
9. **`frontend/src/pages/Items.tsx`** - Items management page

**Pattern**: Use nordic-options-hub components as reference

### Infrastructure (2 tasks)

1. **Helm Chart**: Copy from `nordic-options-hub/charts/options/` and update:
   - `Chart.yaml`: Change name to `fullstack-starter`
   - `values.yaml`: Update image names to `ghcr.io/frallan97/fullstack-starter-{backend,frontend}`
   - `values.yaml`: Update ingress host to your domain

2. **GitHub Actions**: Copy `.github/workflows/build-push.yml` and update image names

## 🗄️ Database Migrations

Create these 6 migration files in `backend/migrations/`:

### 000001_init_schema.up.sql
```sql
-- Users table (synced from auth-service JWT)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    google_id VARCHAR(255),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Items table (example CRUD resource)
CREATE TABLE IF NOT EXISTS items (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_items_user_id ON items(user_id);
CREATE INDEX idx_items_status ON items(status);

-- Auto-update timestamps trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER items_updated_at BEFORE UPDATE ON items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 000001_init_schema.down.sql
```sql
DROP TRIGGER IF EXISTS items_updated_at ON items;
DROP TRIGGER IF EXISTS users_updated_at ON users;
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP TABLE IF EXISTS items CASCADE;
DROP TABLE IF EXISTS users CASCADE;
```

### 000002_add_casbin.up.sql
```sql
-- Casbin policy storage
CREATE TABLE IF NOT EXISTS casbin_rule (
    id SERIAL PRIMARY KEY,
    ptype VARCHAR(100) NOT NULL,
    v0 VARCHAR(100),
    v1 VARCHAR(100),
    v2 VARCHAR(100),
    v3 VARCHAR(100),
    v4 VARCHAR(100),
    v5 VARCHAR(100),
    CONSTRAINT unique_key UNIQUE(ptype, v0, v1, v2, v3, v4, v5)
);

CREATE INDEX idx_casbin_ptype ON casbin_rule(ptype);

-- Default policies: authenticated users can access items
INSERT INTO casbin_rule (ptype, v0, v1, v2) VALUES
    ('p', 'user', '/api/v1/auth/me', 'GET'),
    ('p', 'user', '/api/v1/items', '(GET)|(POST)'),
    ('p', 'user', '/api/v1/items/*', '(GET)|(PATCH)|(DELETE)')
ON CONFLICT DO NOTHING;
```

### 000002_add_casbin.down.sql
```sql
DROP TABLE IF EXISTS casbin_rule CASCADE;
```

### 000003_seed_data.up.sql
```sql
-- Optional: Add seed data for development
-- Note: Items require valid user_id, so this might be empty
-- or populated after first user logs in
```

### 000003_seed_data.down.sql
```sql
-- DELETE FROM items WHERE id < 100; -- example
```

## 🎨 Customizing for Your Project

### 1. Rename Project

Find and replace these strings throughout the codebase:

- `fullstack-starter` → `your-project-name`
- `Fullstack Starter` → `Your Project Name`
- `appuser` → `yourprojectuser`
- `appdb` → `yourprojectdb`
- `github.com/frallan97/fullstack-starter` → `github.com/your-username/your-project`
- `ghcr.io/frallan97/fullstack-starter-*` → `ghcr.io/your-username/your-project-*`

### 2. Modify the Example Model

Replace "items" with your domain model:

1. Rename `backend/models/item.go` → `backend/models/your_resource.go`
2. Update struct fields
3. Update migrations
4. Update controller
5. Update router
6. Update frontend components and API client

### 3. Add Additional Models

For each new resource:
1. Create model in `backend/models/`
2. Create migration with table schema
3. Create controller with CRUD handlers
4. Add routes to router
5. Update Casbin policies
6. Create frontend components

## 🐳 Docker Compose Services

- **auth-db** (port 5433): PostgreSQL for auth-service
- **auth-service** (port 8081): Centralized authentication microservice
- **db** (port 5432): PostgreSQL for application
- **backend** (port 8080): Go API with Air hot reload
- **frontend** (port 5173): React dev server with Vite

## ☸️ Kubernetes Deployment

### Prerequisites
- k3s cluster or similar
- ArgoCD installed
- kubectl access
- GitHub Container Registry access

### Deployment Steps

1. **Build and push images**:
   ```bash
   # GitHub Actions will do this automatically on push to main
   ```

2. **Create image pull secret**:
   ```bash
   kubectl create secret docker-registry ghcr-pull-secret \
     --docker-server=ghcr.io \
     --docker-username=your-github-username \
     --docker-password=<GITHUB_PAT> \
     --namespace=your-app-namespace
   ```

3. **Deploy with Helm**:
   ```bash
   helm install fullstack-starter ./charts/fullstack-starter -n your-namespace
   ```

4. **Or use ArgoCD**:
   Add to ArgoCD ApplicationSet in k3s-infra repo

## 🔐 Security Best Practices

- ✅ JWT tokens with asymmetric RS256 signing
- ✅ HTTP-only cookies for refresh tokens
- ✅ Short-lived access tokens (15 min)
- ✅ Automatic token refresh (2 min before expiry)
- ✅ User can be deactivated via `is_active` flag
- ✅ SQL injection protection (parameterized queries)
- ✅ CORS protection (configurable origins)
- ✅ Authorization on every protected endpoint
- ✅ User data isolation (foreign key constraints)

## 🧪 Testing

```bash
# Backend tests
cd backend
go test ./...

# Frontend tests
cd frontend
bun test
```

## 📚 API Documentation

### Authentication

- `GET /api/v1/auth/me` - Get current user (requires JWT)
- `POST /api/v1/auth/refresh` - Refresh access token (requires refresh token cookie)
- `POST /api/v1/auth/logout` - Logout and revoke tokens

### Items CRUD (requires authentication + authorization)

- `GET /api/v1/items` - List user's items
- `POST /api/v1/items` - Create item
- `GET /api/v1/items/:id` - Get single item
- `PATCH /api/v1/items/:id` - Update item
- `DELETE /api/v1/items/:id` - Delete item

## 🐛 Troubleshooting

### "auth-service not found"
Ensure auth-service exists at `../auth-service/` relative to this project

### "Permission denied" on startup
Check Casbin policies in database: `SELECT * FROM casbin_rule;`

### Frontend can't connect to backend
Check CORS configuration in `backend/config/config.go`

### Google OAuth not working
- Verify GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env
- Check redirect URL matches Google Cloud Console config
- Ensure auth-service is running

## 📖 Further Reading

- [Casbin Documentation](https://casbin.org/docs/overview)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Vite Guide](https://vitejs.dev/guide/)
- [GORM Documentation](https://gorm.io/docs/)

## 📄 License

MIT License - feel free to use this template for any purpose.

## 🤝 Contributing

This is a template repository. Feel free to fork and adapt to your needs!

---

**Created from nordic-options-hub** - A production options trading platform with advanced Black-Scholes pricing.
