.PHONY: help install dev backend frontend electron build run test lint clean docker-build docker-up docker-down deploy release

# Colors
GREEN  := \033[0;32m
YELLOW := \033[0;33m
NC     := \033[0m

# Default target
help:
	@echo "$(GREEN)Writer - 自动化写作软件$(NC)"
	@echo ""
	@echo "$(YELLOW)Usage:${NC}"
	@echo "  make install       # 安装所有依赖"
	@echo "  make dev           # 启动开发模式"
	@echo "  make backend       # 启动后端开发服务器"
	@echo "  make frontend      # 启动前端开发服务器"
	@echo "  make electron      # 启动 Electron 开发模式"
	@echo "  make build         # 构建生产版本"
	@echo "  make test          # 运行测试"
	@echo "  make lint          # 代码检查"
	@echo "  make docker-build  # 构建 Docker 镜像"
	@echo "  make docker-up     # 启动 Docker 服务"
	@echo "  make docker-down   # 停止 Docker 服务"
	@echo "  make release       # 创建发布版本"
	@echo "  make clean         # 清理构建产物"

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
dev: backend frontend

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
# Build
# ============================================================
build:
	@echo "$(GREEN)Building production...$(NC)"
	cd src/frontend && npm run build
	cd electron && npm run build:electron && npm run dist

# ============================================================
# Testing
# ============================================================
test:
	@echo "$(GREEN)Running tests...$(NC)"
	cd src/backend && pytest -v

lint:
	@echo "$(GREEN)Linting code...$(NC)"
	cd src/frontend && npm run lint

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
# Release
# ============================================================
release:
	@echo "$(GREEN)Creating release...$(NC)"
	@if [ -z "$$TAG" ]; then \
		read -p "Enter version tag (e.g., v1.0.0): " TAG; \
	fi
	git tag -a $$TAG -m "Release $$TAG"
	git push origin $$TAG

# ============================================================
# Cleanup
# ============================================================
clean:
	@echo "$(GREEN)Cleaning build artifacts...$(NC)"
	cd src/frontend && rm -rf dist node_modules
	cd electron && rm -rf dist dist-electron release node_modules
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true

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
