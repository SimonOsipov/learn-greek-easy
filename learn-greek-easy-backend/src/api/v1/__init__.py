"""API version 1 routers.

All v1 API endpoints are defined in this package.
"""

from src.api.v1.auth import router as auth_router

__all__ = ["auth_router"]
