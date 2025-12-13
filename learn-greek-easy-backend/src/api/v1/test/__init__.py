"""Test API endpoints for E2E testing.

This module provides endpoints for database seeding and other test utilities.
These endpoints should NEVER be available in production environments.
"""

from src.api.v1.test.seed import router

__all__ = ["router"]
