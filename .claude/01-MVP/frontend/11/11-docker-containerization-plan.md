# Task 11: Docker Containerization Plan for Learn Greek Easy Frontend

**Project:** Learn Greek Easy - Greek Language Learning Application
**Phase:** MVP - Phase 1 (Frontend Only)
**Task ID:** 11
**Created:** 2025-11-20
**Status:** Planning Complete - Ready for Implementation

---

## Executive Summary

This plan outlines the complete dockerization strategy for the Learn Greek Easy frontend application. The solution uses a multi-stage Docker build to create an optimized production image using nginx as the web server. The containerized application will be deployable via Docker Compose, with clear separation between build and runtime stages to minimize final image size.

**Target Image Size:** <40MB
**Deployment Method:** Docker Compose
**Production Server:** Nginx
**Base Images:** Alpine Linux

---

## Current State Analysis

### Application Details
- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite 7.1.7
- **Package Manager:** npm (requires >=9.0.0)
- **Node Version:** Requires >=18.0.0
- **Build Output:** Approximately 6.0MB in `/dist` directory
- **Development Port:** 5173 (Vite default)
- **Preview Port:** 4173

### Build Configuration
- **Output Directory:** `dist/`
- **Build Command:** `npm run build` (runs TypeScript check + Vite build)
- **Sourcemaps:** Enabled in production
- **Code Splitting:** Optimized with manual chunks for:
  - react-vendor (React core)
  - ui-vendor (Radix UI components)
  - utils (utility libraries)
- **Asset Organization:** Organized by type (js, img, etc.)

### Environment Variables
Based on `.env.example`, the application uses:
- `VITE_API_URL` - Backend API URL (critical for production)
- `VITE_API_TIMEOUT` - API request timeout
- `VITE_GOOGLE_CLIENT_ID` - OAuth configuration
- `VITE_APP_NAME` - Application name
- `VITE_APP_VERSION` - Version info
- `VITE_APP_ENV` - Environment type
- Feature flags for mock data, devtools, debug mode, analytics

---

## Docker Strategy

### Multi-Stage Build Architecture

The Docker strategy uses a 3-stage build process:

1. **Stage 1: Builder (Node.js Alpine)**
   - Install all dependencies
   - Run TypeScript compilation
   - Execute Vite build
   - Generate optimized production assets

2. **Stage 2: Production (Nginx Alpine)**
   - Copy built static assets from builder
   - Configure nginx for SPA routing
   - Minimal runtime footprint
   - Production-ready web server

### Image Size Optimization Goals
- **Unoptimized:** ~500-800MB (with Node.js runtime)
- **Optimized target:** ~20-40MB (nginx + static assets only)
- **Compression:** Enable gzip/brotli in nginx

---

## Implementation Plan

### Phase 1: Dockerfile Creation

#### Multi-Stage Dockerfile

**Location:** `learn-greek-easy-frontend/Dockerfile`

```dockerfile
# Stage 1: Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application
RUN npm run build

# Stage 2: Production stage
FROM nginx:alpine

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

---

### Phase 2: Nginx Configuration

#### Custom nginx.conf

**Location:** `learn-greek-easy-frontend/nginx.conf`

```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    access_log /var/log/nginx/access.log main;

    # Performance
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript
               application/json application/javascript application/xml+rss
               application/rss+xml font/truetype font/opentype
               application/vnd.ms-fontobject image/svg+xml;

    server {
        listen 80;
        server_name _;
        root /usr/share/nginx/html;
        index index.html;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "no-referrer-when-downgrade" always;

        # Health check endpoint
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }

        # Static assets with caching
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # SPA fallback - must be last
        location / {
            try_files $uri $uri/ /index.html;
        }
    }
}
```

---

### Phase 3: .dockerignore Configuration

**Location:** `learn-greek-easy-frontend/.dockerignore`

```
# Dependencies
node_modules
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Build outputs
dist
dist-ssr
*.local

# Testing
coverage
test-results
playwright-report
playwright/.cache
.nyc_output

# Environment files
.env
.env.local
.env.*.local
!.env.example

# Version control
.git
.gitignore
.gitattributes

# IDE and editors
.vscode
.idea
*.swp
*.swo
*~
.DS_Store

# Documentation (optional)
docs
*.md
!README.md

# CI/CD
.github
.gitlab-ci.yml
.travis.yml

# Docker files
Dockerfile*
docker-compose*.yml
.dockerignore

# Logs
logs
*.log

# Temporary files
tmp
temp
*.tmp
```

---

### Phase 4: Docker Compose Configuration

#### Production docker-compose.yml

**Location:** `docker-compose.yml` (root directory)

```yaml
version: '3.8'

services:
  frontend:
    build:
      context: ./learn-greek-easy-frontend
      dockerfile: Dockerfile
    image: learn-greek-easy-frontend:latest
    container_name: learn-greek-easy-frontend
    ports:
      - "80:80"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    networks:
      - learn-greek-network
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

networks:
  learn-greek-network:
    driver: bridge
    name: learn-greek-network

# Placeholder for future services
# volumes:
#   postgres_data:
#     name: learn-greek-easy-postgres-data
```

#### Development Override

**Location:** `docker-compose.dev.yml`

```yaml
version: '3.8'

services:
  frontend:
    build:
      context: ./learn-greek-easy-frontend
      dockerfile: Dockerfile
      target: builder
    volumes:
      - ./learn-greek-easy-frontend/src:/app/src:cached
      - ./learn-greek-easy-frontend/public:/app/public:cached
    command: npm run dev
    ports:
      - "5173:5173"
    environment:
      - NODE_ENV=development
```

---

### Phase 5: Build and Deployment Scripts

#### Build Script

**Location:** `scripts/build-frontend.sh`

```bash
#!/bin/bash
set -e

echo "Building Learn Greek Easy Frontend Docker image..."

IMAGE_NAME="learn-greek-easy-frontend"
TAG="${1:-latest}"

docker build \
  --tag "${IMAGE_NAME}:${TAG}" \
  --file ./learn-greek-easy-frontend/Dockerfile \
  ./learn-greek-easy-frontend

echo "✓ Successfully built ${IMAGE_NAME}:${TAG}"
docker images "${IMAGE_NAME}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
```

#### Deployment Script

**Location:** `scripts/deploy-frontend.sh`

```bash
#!/bin/bash
set -e

echo "Deploying Learn Greek Easy Frontend..."

# Stop existing containers
docker-compose down

# Build and start services
docker-compose up -d --build

# Wait for health check
echo "Waiting for frontend to be healthy..."
timeout 60 bash -c 'until docker exec learn-greek-easy-frontend wget -q -O /dev/null http://localhost/health; do sleep 2; done'

echo "✓ Frontend deployed successfully at http://localhost"
docker-compose ps
```

---

## Testing Strategy

### Pre-Deployment Testing

```bash
# 1. Build the image
docker build -t learn-greek-easy-frontend:test ./learn-greek-easy-frontend

# 2. Check image size (should be <40MB)
docker images learn-greek-easy-frontend:test

# 3. Run container
docker run -d -p 8080:80 --name test-frontend learn-greek-easy-frontend:test

# 4. Health check
curl http://localhost:8080/health

# 5. Access application
open http://localhost:8080

# 6. Run E2E tests
npm run test:e2e -- --base-url=http://localhost:8080

# 7. Cleanup
docker stop test-frontend && docker rm test-frontend
```

### Validation Checklist

- [ ] Image builds successfully
- [ ] Image size under 40MB
- [ ] Container starts without errors
- [ ] Health endpoint responds
- [ ] All routes work (SPA routing)
- [ ] Static assets load correctly
- [ ] Gzip compression enabled
- [ ] Cache headers present
- [ ] No console errors
- [ ] Responsive design works

---

## Security Considerations

### Image Security
- Use official Alpine base images
- Run as non-root user (nginx default)
- Don't include secrets in image
- Multi-stage build excludes build tools
- Regular security scans with Trivy/Snyk

### Nginx Security Headers
- X-Frame-Options: SAMEORIGIN
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: no-referrer-when-downgrade

### Secrets Management
- Never commit secrets to repository
- Use environment variables
- Use .env files (not committed)
- Consider Docker secrets for production

---

## Performance Optimization

### Build Optimization
- Layer caching (copy package.json first)
- npm ci for reproducible builds
- .dockerignore to reduce build context
- Multi-stage build to minimize final size

### Runtime Optimization
- Gzip compression (6x level)
- Cache headers (1 year for immutable assets)
- Worker processes: auto
- Keep-alive connections enabled

---

## Monitoring and Logging

### Health Checks
- Endpoint: `/health`
- Docker health check interval: 30s
- Timeout: 3s
- Retries: 3

### Logging
```bash
# View logs
docker logs -f learn-greek-easy-frontend

# Using docker-compose
docker-compose logs -f frontend
```

---

## Implementation Checklist

### Phase 1: Initial Setup
- [ ] Create Dockerfile with multi-stage build
- [ ] Create nginx.conf with SPA routing
- [ ] Create .dockerignore file
- [ ] Test local Docker build
- [ ] Verify image size (<40MB)

### Phase 2: Compose Setup
- [ ] Create docker-compose.yml
- [ ] Create docker-compose.dev.yml
- [ ] Test docker-compose up
- [ ] Verify health check works

### Phase 3: Scripts
- [ ] Create build script
- [ ] Create deployment script
- [ ] Make scripts executable
- [ ] Test scripts end-to-end

### Phase 4: Testing
- [ ] Run build tests
- [ ] Test SPA routing
- [ ] Verify static asset caching
- [ ] Check gzip compression
- [ ] Run E2E tests against container

### Phase 5: Documentation
- [ ] Update README.md
- [ ] Document environment variables
- [ ] Add troubleshooting section

---

## Quick Reference Commands

```bash
# Build image
docker build -t learn-greek-easy-frontend ./learn-greek-easy-frontend

# Run container
docker run -d -p 80:80 --name frontend learn-greek-easy-frontend

# Health check
curl http://localhost/health

# Docker Compose
docker-compose up -d          # Start
docker-compose down           # Stop
docker-compose logs -f        # Logs
docker-compose ps             # Status
docker-compose restart        # Restart

# Build and deploy
docker-compose up -d --build

# Clean up
docker system prune -a
```

---

## Troubleshooting

### Image build fails
```bash
# Clean Docker cache
docker builder prune -a

# Build with no cache
docker build --no-cache -t learn-greek-easy-frontend ./learn-greek-easy-frontend
```

### Container won't start
```bash
# Check port usage
lsof -i :80

# Use different port
docker run -p 8080:80 learn-greek-easy-frontend

# Inspect logs
docker logs frontend
```

### SPA routes return 404
- Verify nginx.conf has `try_files $uri $uri/ /index.html;`
- Rebuild image after fixing config

---

## Success Criteria

### Technical Requirements
✓ Docker image builds successfully
✓ Image size under 40MB
✓ Application runs on port 80
✓ Health check endpoint responds
✓ All routes work (SPA routing)
✓ Static assets served with caching
✓ Gzip compression enabled
✓ Security headers present
✓ Container starts in <10 seconds

### Operational Requirements
✓ docker-compose up works without errors
✓ Clear deployment documentation
✓ Logging accessible
✓ Health monitoring functional

---

## Timeline Estimate

**Total: 4-6 hours**

- Dockerfile creation: 1-1.5 hours
- Nginx configuration: 1 hour
- Docker Compose setup: 0.5-1 hour
- Testing: 1-1.5 hours
- Documentation: 1 hour
- Validation: 0.5-1 hour

---

## Next Steps

1. Review plan
2. Execute in executor mode
3. Test thoroughly
4. Document deployment
5. Monitor in production

---

**Document Version:** 1.0
**Last Updated:** 2025-11-20
**Status:** Ready for Execution
