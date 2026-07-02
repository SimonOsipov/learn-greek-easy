"""Pure dashboard derivation & feed-composition helpers (PERF-15-03).

STUB — the PERF-15-03 executor replaces every function body below with the
real byte-parity logic. Each stub unconditionally raises
``NotImplementedError`` rather than returning a "plausible" wrong constant
(e.g. an always-``None`` ``pick_resume_deck`` would coincidentally satisfy
the "empty list -> None" AC test even though nothing is implemented yet).
Raising guarantees every RED test in
``tests/unit/services/test_dashboard_derivations.py`` and
``tests/unit/services/test_compose_feed.py`` fails for an unambiguous
"not implemented" reason, never a silent false-green.

These are PURE functions (no DB, no I/O, no ``AsyncSession``) — deliberately
split out of ``DashboardSummaryService`` (PERF-15-02, which owns the
DB-touching ``_gather_*``/``gather()`` methods) so they mirror the frontend's
pure dashboard/lib modules 1:1 and can be unit-tested without a database:
    - build_week_heat    <-> src/components/dashboard/lib/weekHeat.ts
    - map_deck_slice      <-> src/stores/deckStore.ts (transformDeckResponse)
    - derive_is_new_user <-> src/components/dashboard/lib/isNewUser.ts
    - pick_resume_deck   <-> src/components/dashboard/lib/heroEntries.ts
    - compose_feed       <-> src/components/dashboard/lib/composeFeed.ts

PERF-15-03's ``build()`` (not yet written) composes these pure helpers with
``DashboardSummaryService.gather()``'s output into the final
``DashboardSummaryResponse``.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Protocol
from uuid import UUID

from src.schemas.dashboard import (
    DashboardDeckSlice,
    FeedItem,
    SlimNews,
    SlimSituation,
    WeekHeat,
)
from src.schemas.progress import DeckProgressSummary, RecentActivity


class DeckLike(Protocol):
    """Structural shape ``map_deck_slice`` needs from its ``deck`` argument.

    Satisfied by both the ``Deck`` ORM model (src/db/models.py) and the
    ``DeckResponse`` schema (src/schemas/deck.py) — ``map_deck_slice`` only
    reads identity/display fields off ``deck``; the SRS counts come from the
    separate ``progress``/``card_count`` arguments (see the ``card_count``
    docstring on ``DashboardDeckSlice``, src/schemas/dashboard.py).
    """

    id: UUID
    name_el: str | None
    name_en: str | None
    name_ru: str | None
    level: str
    is_premium: bool
    cover_image_url: str | None
    cover_image_variants: dict[int, str] | None


@dataclass
class ComposeFeedSignals:
    """Bundled inputs to ``compose_feed`` — mirrors the frontend's
    ``FeedSources`` interface (src/components/dashboard/lib/composeFeed.ts).
    """

    deck_slices: list[DashboardDeckSlice]
    cards_due: int
    situation: SlimSituation | None
    news: list[SlimNews]
    current_streak: int
    longest_streak: int
    queue_count: int


def build_week_heat(recent_activity: list[RecentActivity], *, today_utc: date) -> WeekHeat:
    """STUB — PERF-15-03 executor replaces this.

    Real contract: bucket each day's summed ``reviews_count`` (thresholds
    0->0, <=2->1, <=4->2, <=7->3, <=12->4, else->5) into a dense 7-element
    array anchored on the UTC calendar day ``today_utc`` (index 0 = 6 days
    ago, index 6 = today); entries outside the 0-6-days-ago window are
    dropped. See src/components/dashboard/lib/weekHeat.ts for the frontend
    oracle this must byte-match.
    """
    raise NotImplementedError("build_week_heat: PERF-15-03 executor replaces this stub")


def map_deck_slice(
    deck: DeckLike, progress: DeckProgressSummary | None, card_count: int
) -> DashboardDeckSlice:
    """STUB — PERF-15-03 executor replaces this.

    Real contract: status is 'completed' iff completion_percentage >= 100,
    else 'in-progress' iff cards_studied > 0, else 'not-started';
    completion_pct is a SEPARATE round(cards_studied / cards_total * 100)
    computation (0 when cards_total == 0); cards_review and due_today both
    equal progress.cards_due; with no progress row all counts fall back to
    card_count/zeros. See src/stores/deckStore.ts (transformDeckResponse)
    for the frontend oracle this must byte-match.
    """
    raise NotImplementedError("map_deck_slice: PERF-15-03 executor replaces this stub")


def derive_is_new_user(
    cards_due: int,
    current_streak: int,
    mastered: int,
    deck_slices: list[DashboardDeckSlice],
) -> bool:
    """STUB — PERF-15-03 executor replaces this.

    Real contract: True iff cards_due == 0 AND current_streak == 0 AND
    mastered == 0 AND every deck_slice.last_studied_at is None. See
    src/components/dashboard/lib/isNewUser.ts for the frontend oracle this
    must byte-match.
    """
    raise NotImplementedError("derive_is_new_user: PERF-15-03 executor replaces this stub")


def pick_resume_deck(deck_slices: list[DashboardDeckSlice]) -> DashboardDeckSlice | None:
    """STUB — PERF-15-03 executor replaces this.

    Real contract, in priority order: (a) the deck with the max
    last_studied_at (ties -> earliest in list order, strict '>' comparison);
    (b) else the first deck with due_today > 0; (c) else deck_slices[0];
    (d) else None for an empty list. See
    src/components/dashboard/lib/heroEntries.ts for the frontend oracle this
    must byte-match.
    """
    raise NotImplementedError("pick_resume_deck: PERF-15-03 executor replaces this stub")


def compose_feed(signals: ComposeFeedSignals) -> list[FeedItem]:
    """STUB — PERF-15-03 executor replaces this.

    Real contract: fixed emission order resume -> review -> situation ->
    word_of_day -> deck -> milestone -> news -> quick, each presence-gated
    except word_of_day (always emitted). See
    src/components/dashboard/lib/composeFeed.ts for the frontend oracle this
    must byte-match.
    """
    raise NotImplementedError("compose_feed: PERF-15-03 executor replaces this stub")


__all__ = [
    "ComposeFeedSignals",
    "DeckLike",
    "build_week_heat",
    "map_deck_slice",
    "derive_is_new_user",
    "pick_resume_deck",
    "compose_feed",
]
