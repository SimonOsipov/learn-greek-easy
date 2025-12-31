#!/bin/bash
# Railway PR Preview Environment Management Script
# Usage: ./scripts/railway-preview.sh <PR_NUMBER> <ACTION>
# Actions: create, deploy, destroy

set -e

PR_NUMBER=$1
ACTION=$2

if [ -z "$PR_NUMBER" ] || [ -z "$ACTION" ]; then
    echo "Usage: $0 <PR_NUMBER> <ACTION>"
    echo "Actions: create, deploy, destroy"
    exit 1
fi

ENV_NAME="pr-${PR_NUMBER}"

case $ACTION in
  create)
    echo "Creating preview environment: ${ENV_NAME}"
    railway environment create "${ENV_NAME}"

    echo "Setting up preview environment variables..."
    railway variables set ENVIRONMENT=preview --environment "${ENV_NAME}"
    railway variables set DEBUG=false --environment "${ENV_NAME}"
    railway variables set LOG_LEVEL=INFO --environment "${ENV_NAME}"
    railway variables set JWT_ALGORITHM=HS256 --environment "${ENV_NAME}"
    railway variables set ACCESS_TOKEN_EXPIRE_MINUTES=720 --environment "${ENV_NAME}"
    railway variables set API_V1_PREFIX=/api/v1 --environment "${ENV_NAME}"

    echo "Preview environment ${ENV_NAME} created successfully!"
    ;;

  deploy)
    echo "Deploying to preview environment: ${ENV_NAME}"
    railway link --environment "${ENV_NAME}"
    railway up --service backend --detach
    railway up --service frontend --detach
    echo "Deployment initiated for ${ENV_NAME}"
    ;;

  destroy)
    echo "Destroying preview environment: ${ENV_NAME}"
    railway environment delete "${ENV_NAME}" --yes
    echo "Preview environment ${ENV_NAME} destroyed successfully!"
    ;;

  *)
    echo "Unknown action: $ACTION"
    echo "Valid actions: create, deploy, destroy"
    exit 1
    ;;
esac
