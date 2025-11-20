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
