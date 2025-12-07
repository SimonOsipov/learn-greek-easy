"""API version 2 routers (placeholder).

This package is a placeholder for future API v2 endpoints.
When breaking changes are needed, implement them here while
maintaining backward compatibility with v1.

Migration Strategy:
------------------
1. Create v2 versions of affected routers in this package
2. Create v2/router.py following the same pattern as v1/router.py
3. Mount v2_router in main.py with prefix settings.api_v2_prefix
4. Deprecate affected v1 endpoints with sunset headers
5. Document migration path for API consumers

Example structure when v2 is needed:
    src/api/v2/
    ├── __init__.py      (this file)
    ├── router.py        (aggregates v2 routers)
    ├── auth.py          (if auth changes needed)
    └── decks.py         (if deck changes needed)

Example mounting in main.py:
    from src.api.v2.router import v2_router
    app.include_router(v2_router, prefix="/api/v2")
"""

# When v2 is implemented, exports will be added here:
# from src.api.v2.router import v2_router
# __all__ = ["v2_router"]
