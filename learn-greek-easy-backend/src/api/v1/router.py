"""API Version 1 Router.

This module provides a centralized router that aggregates all v1 API endpoints.
The router is mounted with the /api/v1 prefix in main.py using settings.api_v1_prefix.

Versioning Strategy:
--------------------
- All v1 endpoints are grouped under this router
- Individual feature routers (auth, decks, cards, etc.) are included with their
  respective prefixes
- When v2 is needed, create src/api/v2/router.py following the same pattern
- Both versions can coexist, mounted at /api/v1 and /api/v2 respectively

Example of mounting in main.py:
    from src.api.v1.router import v1_router
    app.include_router(v1_router, prefix=settings.api_v1_prefix)

Adding new feature routers:
    from src.api.v1.feature import router as feature_router
    v1_router.include_router(feature_router, prefix="/feature", tags=["Feature"])
"""

from fastapi import APIRouter

from src.api.v1.auth import router as auth_router
from src.api.v1.cards import router as card_router
from src.api.v1.decks import router as deck_router

# Create the main v1 router
v1_router = APIRouter()

# =============================================================================
# Authentication Routes
# =============================================================================
v1_router.include_router(
    auth_router,
    prefix="/auth",
    tags=["Authentication"],
)

# =============================================================================
# Deck Routes
# =============================================================================
v1_router.include_router(
    deck_router,
    prefix="/decks",
    tags=["Decks"],
)

# =============================================================================
# Card Routes
# =============================================================================
v1_router.include_router(
    card_router,
    prefix="/cards",
    tags=["Cards"],
)

# =============================================================================
# Future Route Placeholders
# =============================================================================
# When implementing new features, add routers here:
#
# from src.api.v1.reviews import router as review_router
# v1_router.include_router(review_router, prefix="/reviews", tags=["Reviews"])
#
# from src.api.v1.progress import router as progress_router
# v1_router.include_router(progress_router, prefix="/progress", tags=["Progress"])
