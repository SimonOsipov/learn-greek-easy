"""Dashboard summary endpoint (PERF-15-04).

GET /api/v1/dashboard/summary replaces eight separate dashboard calls with a
single composed, cached payload (see src/schemas/dashboard.py for the DTO
and src/services/dashboard_summary_service.py for the composition, both
already implemented in PERF-15-01..03).

Read-through cache-aside, mirroring ProgressService.get_dashboard_stats
(src/services/progress_service.py) and the deck-list endpoint cache
(src/api/v1/decks.py): the composed DashboardSummaryResponse is cached at
``progress:user:{uid}:dashboard_summary`` (namespaced under the same
``progress:user:{uid}:*`` prefix ProgressService uses, so
``invalidate_user_progress`` sweeps it too) for ``cache_user_progress_ttl``
seconds. One AsyncSession (the injected ``db``) flows into
``DashboardSummaryService``, whose ``build()`` already composes every
sub-service on that single session (PERF-15-03) -- the cache factory does
not open a second session.
"""

from fastapi import APIRouter, Depends
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.core.cache import get_cache
from src.core.dependencies import get_current_user
from src.db.dependencies import get_db
from src.db.models import User
from src.schemas.dashboard import DashboardSummaryResponse
from src.services.dashboard_summary_service import DashboardSummaryService

router = APIRouter()


@router.get(
    "/summary",
    response_model=DashboardSummaryResponse,
    summary="Get composed dashboard summary",
)
async def get_dashboard_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardSummaryResponse:
    """Cached, single-composed-call replacement for the dashboard's eight
    separate requests. Cache-aside: hit returns the validated cached
    payload, miss computes + stores it, and a None/invalid cache result
    falls back to a direct (uncached) build() rather than crashing.
    """
    cache = get_cache()
    key = f"progress:user:{current_user.id}:dashboard_summary"

    async def _factory() -> dict:
        return (await DashboardSummaryService(db).build(current_user.id)).model_dump(mode="json")

    cached = await cache.get_or_set(key, _factory, ttl=settings.cache_user_progress_ttl)  # type: ignore[arg-type]
    if cached is not None:
        try:
            return DashboardSummaryResponse.model_validate(cached)
        except ValidationError:
            pass
    return await DashboardSummaryService(db).build(current_user.id)


__all__ = ["router"]
