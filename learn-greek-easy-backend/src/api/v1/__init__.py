"""API version 1 routers.

All v1 API endpoints are defined in this package.
The main entry point is v1_router which aggregates all v1 endpoints.
"""

from src.api.v1.auth import router as auth_router
from src.api.v1.router import v1_router

__all__ = ["v1_router", "auth_router"]
