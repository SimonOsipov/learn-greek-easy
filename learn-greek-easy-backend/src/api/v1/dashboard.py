"""Dashboard summary endpoint (PERF-15-04).

GET /api/v1/dashboard/summary replaces eight separate dashboard calls with a
single composed, cached payload (see src/schemas/dashboard.py for the DTO
and src/services/dashboard_summary_service.py for the composition, both
already implemented in PERF-15-01..03).

# STUB — PERF-15-04 executor replaces this.
This file only wires the route + auth/db dependencies so the RED tests in
tests/integration/api/test_dashboard_summary.py and
tests/unit/api/test_dashboard_summary_cache.py can resolve the endpoint
(401 without auth, route exists) and patch `get_cache` at
`src.api.v1.dashboard.get_cache`. It deliberately does NOT call
DashboardSummaryService.build() and does NOT wire the Redis cache-aside —
it returns a hardcoded placeholder dict instead of a DashboardSummaryResponse,
so:
  - direct-call unit tests observe zero cache/build activity (RED), and
  - HTTP-level integration tests get a 500 (FastAPI response_model
    validation fails on the placeholder) instead of the real 200 payload.

The executor replaces the body with:
    cache = get_cache()
    key = f"progress:user:{current_user.id}:dashboard_summary"
    cached = await cache.get_or_set(
        key,
        lambda: DashboardSummaryService(db).build(current_user.id),
        ttl=settings.cache_user_progress_ttl,
    )
    if cached is None:
        return await DashboardSummaryService(db).build(current_user.id)
    return DashboardSummaryResponse.model_validate(cached)
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.cache import get_cache  # noqa: F401 -- imported so RED tests can patch this name
from src.core.dependencies import get_current_user
from src.db.dependencies import get_db
from src.db.models import User
from src.schemas.dashboard import DashboardSummaryResponse

router = APIRouter()


@router.get("/summary", response_model=DashboardSummaryResponse)
async def get_dashboard_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """STUB — PERF-15-04 executor replaces this with the cached one-txn compose.

    Does not call DashboardSummaryService.build() and does not touch the
    cache. Returns a placeholder dict that fails DashboardSummaryResponse
    validation on purpose (see module docstring).
    """
    return {"stub": "PERF-15-04 not implemented yet"}


__all__ = ["router"]
