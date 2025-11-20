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
