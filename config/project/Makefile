.PHONY: help install dev backend frontend electron build test lint clean docker-build docker-up docker-down version version-sync bump-patch bump-minor bump-major package package-win release db-init db-migrate db-rollback

# Colors
GREEN  := \033[0;32m
YELLOW := \033[0;33m
CYAN   := \033[0;36m
NC     := \033[0m

# Version (source of truth: electron/package.json)
VERSION := $(shell node -p "require('./electron/package.json').version" 2>/dev/null || echo "1.0.0")

# Default target
help:
	@echo "$(GREEN)Writer - 自动化写作软件$(NC)"
	@echo "$(CYAN)Version: $(VERSION)$(NC)"
	@echo ""
	@echo "$(YELLOW)Development:$(NC)"
	@echo "  make install       Install all dependencies"
	@echo "  make dev           Start full development mode (backend + frontend)"
	@echo "  make backend       Start backend dev server (uvicorn reload)"
	@echo "  make frontend      Start frontend dev server (Vite)"
	@echo "  make electron      Start Electron dev mode"
	@echo ""
	@echo "$(YELLOW)Build & Package:$(NC)"
	@echo "  make build         Build production (frontend + electron)"
	@echo "  make package       Full package with version sync (Windows installer)"
	@echo "  make package-win   Build Windows installer"
	@echo "  make package-all   Build for all platforms (requires macOS/Linux runners)"
	@echo ""
	@echo "$(YELLOW)Version Management:$(NC)"
	@echo "  make version       Show current version"
	@echo "  make version-sync  Sync version to all modules"
	@echo "  make bump-patch    Bump patch version (1.0.0 -> 1.0.1)"
	@echo "  make bump-minor    Bump minor version (1.0.0 -> 1.1.0)"
	@echo "  make bump-major    Bump major version (1.0.0 -> 2.0.0)"
	@echo ""
	@echo "$(YELLOW)Quality:$(NC)"
	@echo "  make test          Run backend tests"
	@echo "  make lint          Run frontend lint"
	@echo "  make typecheck     Run frontend TypeScript check"
	@echo ""
	@echo "$(YELLOW)Docker:$(NC)"
	@echo "  make docker-build  Build Docker images"
	@echo "  make docker-up     Start Docker services"
	@echo "  make docker-down   Stop Docker services"
	@echo ""
	@echo "$(YELLOW)Database:$(NC)"
	@echo "  make db-init       Initialize database"
	@echo "  make db-migrate    Run migrations"
	@echo "  make db-rollback   Rollback last migration"
	@echo ""
	@echo "$(YELLOW)Release:$(NC)"
	@echo "  make release       Create git tag and push"
	@echo ""
	@echo "$(YELLOW)Maintenance:$(NC)"
	@echo "  make clean         Clean all build artifacts"
	@echo "  make deps-update   Update all dependencies"

# ============================================================
# Installation
# ============================================================
install:
	@echo "$(GREEN)Installing dependencies...$(NC)"
	cd src/backend && pip install -r requirements.txt
	cd src/frontend && npm install
	cd electron && npm install

# ============================================================
# Development
# ============================================================
dev:
	@echo "$(GREEN)Starting development mode...$(NC)"
	@echo "$(YELLOW)Backend: http://localhost:8000$(NC)"
	@echo "$(YELLOW)Frontend: http://localhost:5173$(NC)"
	@trap 'kill %1 %2 2>/dev/null' EXIT; \
		cd src/backend && uvicorn main:app --reload --port 8000 & \
		cd src/frontend && npm run dev & \
		wait

backend:
	@echo "$(GREEN)Starting backend...$(NC)"
	cd src/backend && uvicorn main:app --reload --port 8000

frontend:
	@echo "$(GREEN)Starting frontend...$(NC)"
	cd src/frontend && npm run dev

electron:
	@echo "$(GREEN)Starting Electron...$(NC)"
	cd electron && npm run electron:dev

# ============================================================
# Version Management
# ============================================================
version:
	@echo "$(CYAN)Writer $(VERSION)$(NC)"
	@echo "Electron: $(shell node -p "require('./electron/package.json').version" 2>/dev/null)"
	@echo "Frontend: $(shell node -p "require('./src/frontend/package.json').version" 2>/dev/null)"
	@echo "Backend:  $(shell grep -oP 'app_version: str = "\K[^"]+' src/backend/config.py 2>/dev/null || echo "unknown")"
	@echo "Git:      $(shell git describe --tags --always 2>/dev/null || echo "no tags")"

version-sync:
	@echo "$(GREEN)Syncing version $(VERSION)...$(NC)"
	@node scripts/version-sync.js $(VERSION)

bump-patch:
	@node scripts/version-bump.js patch

bump-minor:
	@node scripts/version-bump.js minor

bump-major:
	@node scripts/version-bump.js major

# ============================================================
# Build & Package
# ============================================================
build: version-sync
	@echo "$(GREEN)Building production v$(VERSION)...$(NC)"
	cd src/frontend && npm run build
	cd electron && npm run build:electron && npm run dist

package: clean version-sync
	@echo "$(GREEN)Packaging v$(VERSION) for Windows...$(NC)"
	cd src/frontend && npm run build
	cd electron && npm run build:electron && npm run dist:win
	@echo "$(GREEN)Package created!$(NC)"
	@echo "Location: electron/release/"
	@ls -la electron/release/ 2>/dev/null || true

package-win: package

package-all: clean version-sync
	@echo "$(GREEN)Packaging v$(VERSION) for all platforms...$(NC)"
	cd src/frontend && npm run build
	cd electron && npm run build:electron && npm run dist
	@echo "$(GREEN)Packages created!$(NC)"
	@ls -la electron/release/ 2>/dev/null || true

# ============================================================
# Quality Assurance
# ============================================================
test:
	@echo "$(GREEN)Running tests...$(NC)"
	cd src/backend && pytest -v

test-cov:
	@echo "$(GREEN)Running tests with coverage...$(NC)"
	cd src/backend && pytest --cov=src/backend --cov-report=html --cov-report=term

lint:
	@echo "$(GREEN)Linting frontend code...$(NC)"
	cd src/frontend && npm run lint

typecheck:
	@echo "$(GREEN)Running TypeScript check...$(NC)"
	cd src/frontend && npx tsc --noEmit

# ============================================================
# Docker
# ============================================================
docker-build:
	@echo "$(GREEN)Building Docker images...$(NC)"
	docker compose build

docker-up:
	@echo "$(GREEN)Starting Docker services...$(NC)"
	docker compose up -d
	@echo "$(GREEN)Services started!$(NC)"
	@echo "  Backend:  http://localhost:8000"
	@echo "  Frontend: http://localhost:5173"

docker-down:
	@echo "$(GREEN)Stopping Docker services...$(NC)"
	docker compose down

docker-logs:
	docker compose logs -f

# ============================================================
# Database
# ============================================================
db-init:
	@echo "$(GREEN)Initializing database...$(NC)"
	cd src/backend && python init_db.py

db-migrate:
	@echo "$(GREEN)Running migrations...$(NC)"
	cd src/backend && python cli.py db upgrade

db-rollback:
	@echo "$(YELLOW)Rolling back migration...$(NC)"
	cd src/backend && python cli.py db downgrade

db-status:
	@echo "$(GREEN)Migration status...$(NC)"
	cd src/backend && python cli.py db current

# ============================================================
# Release
# ============================================================
release:
	@if [ -z "$(TAG)" ]; then \
		echo "$(YELLOW)Usage: make release TAG=v1.0.0$(NC)"; \
		read -p "Enter version tag (e.g., v1.0.0): " TAG; \
	fi; \
	TAG=$${TAG:-v$(VERSION)}; \
	echo "$(GREEN)Creating release $$TAG...$(NC)"; \
	git add -A; \
	git commit -m "release: $$TAG" || true; \
	git tag -a $$TAG -m "Release $$TAG"; \
	echo "$(GREEN)Tagged $$TAG. Run 'git push origin $$TAG' to publish.$(NC)"

# ============================================================
# Cleanup
# ============================================================
clean:
	@echo "$(GREEN)Cleaning build artifacts...$(NC)"
	cd src/frontend && rm -rf dist node_modules/.cache
	cd electron && rm -rf dist dist-electron release
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	@echo "$(GREEN)Clean complete.$(NC)"

deps-update:
	@echo "$(GREEN)Updating dependencies...$(NC)"
	cd src/backend && pip install -r requirements.txt --upgrade
	cd src/frontend && npm update
	cd electron && npm update
