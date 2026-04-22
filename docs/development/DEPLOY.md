# Server Deployment Guide

## Prerequisites

1. A Linux server with Docker and Docker Compose installed
2. SSH access to the server
3. Domain name pointed to the server (optional)

## Required Secrets

Configure these in GitHub repository Settings → Secrets:

| Secret Name | Description |
|-------------|-------------|
| `SERVER_HOST` | Your server hostname or IP |
| `SERVER_USER` | SSH user for deployment |
| `SERVER_SSH_KEY` | Private SSH key with server access |
| `MINIMAX_API_KEY` | Your MiniMax API key |

## Deployment Flow

### Automatic Deployment (Recommended)

1. **For releases**: Create a git tag to trigger automatic deployment
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. **For staging**: Use workflow_dispatch with staging environment

### Manual Deployment

1. Run the CD workflow manually from GitHub Actions
2. Select `staging` or `production` environment

## Server Setup

### Initial Server Setup Script

```bash
#!/bin/bash
set -e

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Create deployment directory
mkdir -p ~/writer-deploy
cd ~/writer-deploy

# Create docker-compose.yml (copy from repository)
# Create .env file with your secrets

# Start services
docker compose up -d
```

### docker-compose.prod.yml

```yaml
version: '3.8'

services:
  backend:
    image: ghcr.io/YOUR_USERNAME/writer-backend:${VERSION:-latest}
    container_name: writer-backend
    ports:
      - "8000:8000"
    volumes:
      - ./data:/app/data
    environment:
      - DATABASE_URL=sqlite+aiosqlite:///data/writer.db
      - MINIMAX_API_KEY=${MINIMAX_API_KEY}
      - CORS_ORIGINS=https://your-domain.com
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    image: ghcr.io/YOUR_USERNAME/writer-frontend:${VERSION:-latest}
    container_name: writer-frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    environment:
      - VITE_API_BASE_URL=https://api.your-domain.com/api/v1
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    container_name: writer-nginx
    ports:
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - frontend
      - backend
    restart: unless-stopped

networks:
  default:
    name: writer-network
```

## SSL/HTTPS Setup

For production, use Let's Encrypt:

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Generate certificate
sudo certbot --nginx -d your-domain.com -d api.your-domain.com
```

## Monitoring

### Health Check Endpoints

- Backend: `http://localhost:8000/health`
- Frontend: `http://localhost:80`

### Logs

```bash
# View all logs
docker compose logs -f

# View specific service
docker compose logs -f backend
docker compose logs -f frontend
```

### Backup

```bash
# Backup database
cp data/writer.db data/writer.db.backup.$(date +%Y%m%d)

# Backup entire data directory
tar -czf writer-backup.$(date +%Y%m%d).tar.gz data/
```
