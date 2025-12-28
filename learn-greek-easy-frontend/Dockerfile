# Stage 1: Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Build arguments for Vite environment variables (must be available at build time)
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_API_URL
ARG RAILWAY_GIT_COMMIT_SHA
ARG VITE_POSTHOG_KEY
ARG VITE_POSTHOG_HOST
ARG VITE_ENVIRONMENT

# Set them as environment variables for the build
ENV VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}
ENV VITE_API_URL=${VITE_API_URL}
# Expose Railway's commit SHA as VITE_COMMIT_SHA for the frontend build
ENV RAILWAY_GIT_COMMIT_SHA=${RAILWAY_GIT_COMMIT_SHA}
# PostHog analytics configuration
ENV VITE_POSTHOG_KEY=${VITE_POSTHOG_KEY}
ENV VITE_POSTHOG_HOST=${VITE_POSTHOG_HOST}
ENV VITE_ENVIRONMENT=${VITE_ENVIRONMENT}

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application (using vite build directly to skip test file type-checking)
RUN npx vite build

# Stage 2: Production stage
FROM caddy:alpine

# Copy built assets to Caddy's default path
COPY --from=builder /app/dist /srv

# Copy Caddyfile
COPY Caddyfile /etc/caddy/Caddyfile

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Railway sets PORT env var at runtime, default to 80
# Default for local Docker Compose; Railway overrides via environment variable
ENV PORT=80
# Dynamic DNS resolution for backend (Railway uses backend.railway.internal:8080)
# For local development, override with BACKEND_HOST=backend BACKEND_PORT=8000
ENV BACKEND_HOST=backend.railway.internal
ENV BACKEND_PORT=8080

# Note: No Docker HEALTHCHECK - Railway handles health checks via /health endpoint
# Docker HEALTHCHECK uses build-time PORT value, not runtime, causing failures

# Start caddy via entrypoint
ENTRYPOINT ["/docker-entrypoint.sh"]
