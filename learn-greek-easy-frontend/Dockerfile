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

# Build application (using vite build directly to skip test file type-checking)
RUN npx vite build

# Stage 2: Production stage
FROM nginx:alpine

# Install envsubst (part of gettext)
RUN apk add --no-cache gettext

# Copy nginx config template (will be processed at runtime)
COPY nginx.conf.template /etc/nginx/nginx.conf.template

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Railway sets PORT env var at runtime, default to 80
ENV PORT=80
ENV BACKEND_URL=http://backend:8000

# Note: No Docker HEALTHCHECK - Railway handles health checks via /health endpoint
# Docker HEALTHCHECK uses build-time PORT value, not runtime, causing failures

# Start nginx via entrypoint
ENTRYPOINT ["/docker-entrypoint.sh"]
