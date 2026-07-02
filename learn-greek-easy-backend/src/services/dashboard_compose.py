"""Pure dashboard derivation & feed-composition helpers (PERF-15-03).

These are PURE functions (no DB, no I/O, no ``AsyncSession``) — deliberately
split out of ``DashboardSummaryService`` (PERF-15-02, which owns the
DB-touching ``_gather_*``/``gather()`` methods) so they mirror the frontend's
pure dashboard/lib modules 1:1 and can be unit-tested without a database:
    - build_week_heat    <-> src/components/dashboard/lib/weekHeat.ts
    - map_deck_slice      <-> src/stores/deckStore.ts (transformDeckResponse)
    - derive_is_new_user <-> src/components/dashboard/lib/isNewUser.ts
    - pick_resume_deck   <-> src/components/dashboard/lib/heroEntries.ts
    - compose_feed       <-> src/components/dashboard/lib/composeFeed.ts

See ``tests/unit/services/test_dashboard_derivations.py`` and
``tests/unit/services/test_compose_feed.py`` for the byte-parity contract
each helper is locked against.

``DashboardSummaryService.build()`` (src/services/dashboard_summary_service.py)
composes these pure helpers with ``gather()``'s output into the final
``DashboardSummaryResponse``.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Protocol
from uuid import UUID

from src.schemas.dashboard import (
    DashboardDeckSlice,
    DeckFeedItem,
    FeedItem,
    MilestoneFeedItem,
    NewsFeedItem,
    QuickFeedItem,
    ResumeFeedItem,
    ReviewFeedItem,
    SituationFeedItem,
    SlimNews,
    SlimSituation,
    WeekHeat,
    WordOfDayFeedItem,
)
from src.schemas.progress import DeckProgressSummary, RecentActivity
from src.utils.heatmap import bucket_heatmap_intensity


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
    """Bucket each day's summed ``reviews_count`` into a dense 7-element,
    UTC-anchored rolling-window heat array (index 0 = 6 days ago, index 6 =
    today). Byte-parity port of src/components/dashboard/lib/weekHeat.ts's
    ``buildWeekHeat`` (thresholds delegated to ``bucket_heatmap_intensity``,
    shared with the per-word/deck heatmaps).

    ``today_utc`` MUST be ``datetime.now(timezone.utc).date()`` at the call
    site — never ``date.today()`` (that reads the local/server timezone, not
    UTC, and would silently drift the bucket boundaries from the frontend
    oracle's ``Date.UTC`` anchoring).
    """
    daily_sums: dict[int, int] = {}
    for entry in recent_activity:
        days_ago = (today_utc - entry.date).days
        if 0 <= days_ago <= 6:
            idx = 6 - days_ago
            daily_sums[idx] = daily_sums.get(idx, 0) + entry.reviews_count

    heat = [bucket_heatmap_intensity(daily_sums.get(i, 0)) for i in range(7)]
    return WeekHeat(heat=heat, today_idx=6)


def map_deck_slice(
    deck: DeckLike, progress: DeckProgressSummary | None, card_count: int
) -> DashboardDeckSlice:
    """Map a deck + its (optional) progress summary onto a
    ``DashboardDeckSlice``. Byte-parity port of
    src/stores/deckStore.ts's ``transformDeckResponse`` (status/count
    derivation) + src/components/dashboard/FeedCards.tsx's
    ``completion_pct`` formula (both cited in the module docstring).

    ``status``: 'completed' iff ``completion_percentage >= 100``, else
    'in-progress' iff ``cards_studied > 0``, else 'not-started'. No progress
    row -> 'not-started'.

    ``completion_pct`` is a SEPARATE ``round(cards_studied / cards_total *
    100)`` computation (guarded to 0 when ``cards_total == 0``) —
    deliberately independent of the ``status`` gate's float
    ``completion_percentage``, which may not itself equal that ratio.

    ``cards_review`` and ``due_today`` both mirror ``progress.cards_due``.
    With no progress row, all SRS counts fall back to ``card_count``/zeros
    and ``cards_total`` uses ``card_count`` (mirrors the frontend's
    ``deck.card_count ?? progressData?.total_cards ?? 0`` when there is no
    progress row at all).
    """
    level = deck.level.value if hasattr(deck.level, "value") else deck.level

    if progress is None:
        return DashboardDeckSlice(
            deck_id=deck.id,
            name_el=deck.name_el,
            name_en=deck.name_en,
            name_ru=deck.name_ru,
            level=level,
            is_premium=deck.is_premium,
            card_count=card_count,
            cover_image_url=deck.cover_image_url,
            cover_image_variants=deck.cover_image_variants,
            status="not-started",
            cards_total=card_count,
            cards_new=card_count,
            cards_learning=0,
            cards_review=0,
            cards_mastered=0,
            due_today=0,
            completion_pct=0,
            mastery_pct=0.0,
            last_studied_at=None,
        )

    if progress.completion_percentage >= 100:
        status = "completed"
    elif progress.cards_studied > 0:
        status = "in-progress"
    else:
        status = "not-started"

    cards_total = progress.total_cards
    completion_pct = round(progress.cards_studied / cards_total * 100) if cards_total > 0 else 0

    return DashboardDeckSlice(
        deck_id=deck.id,
        name_el=deck.name_el,
        name_en=deck.name_en,
        name_ru=deck.name_ru,
        level=level,
        is_premium=deck.is_premium,
        card_count=card_count,
        cover_image_url=deck.cover_image_url,
        cover_image_variants=deck.cover_image_variants,
        status=status,
        cards_total=cards_total,
        cards_new=cards_total - progress.cards_studied,
        cards_learning=progress.cards_studied - progress.cards_mastered,
        cards_review=progress.cards_due,
        cards_mastered=progress.cards_mastered,
        due_today=progress.cards_due,
        completion_pct=completion_pct,
        mastery_pct=progress.mastery_percentage,
        last_studied_at=progress.last_studied_at,
    )


def derive_is_new_user(
    cards_due: int,
    current_streak: int,
    mastered: int,
    deck_slices: list[DashboardDeckSlice],
) -> bool:
    """New-user predicate. Byte-parity port of
    src/components/dashboard/lib/isNewUser.ts's ``isNewUser``: True iff
    ``cards_due == 0`` AND ``current_streak == 0`` AND ``mastered == 0`` AND
    every deck slice's ``last_studied_at`` is None (vacuously True for an
    empty deck list, mirroring JS ``Array.prototype.every``).
    """
    return (
        cards_due == 0
        and current_streak == 0
        and mastered == 0
        and all(s.last_studied_at is None for s in deck_slices)
    )


def pick_resume_deck(deck_slices: list[DashboardDeckSlice]) -> DashboardDeckSlice | None:
    """Pick the "resume" deck. Byte-parity port of
    src/components/dashboard/lib/heroEntries.ts's ``pickResumeDeck``, in
    priority order: (a) the deck with the max ``last_studied_at`` (ties ->
    earliest in list order — the reduce-style scan below only replaces on a
    STRICT '>' so an equal-or-earlier later entry never wins); (b) else the
    first deck with ``due_today > 0``; (c) else ``deck_slices[0]``; (d) else
    ``None`` for an empty list.
    """
    if not deck_slices:
        return None

    with_last_studied = [d for d in deck_slices if d.last_studied_at is not None]
    if with_last_studied:
        best = with_last_studied[0]
        for d in with_last_studied[1:]:
            if d.last_studied_at > best.last_studied_at:  # type: ignore[operator]
                best = d
        return best

    for d in deck_slices:
        if d.due_today > 0:
            return d

    return deck_slices[0]


def compose_feed(signals: ComposeFeedSignals) -> list[FeedItem]:
    """Compose the priority-ordered dashboard feed. Byte-parity port of
    src/components/dashboard/lib/composeFeed.ts's ``composeFeed``.

    Fixed emission order: resume -> review -> situation -> word_of_day ->
    deck -> milestone -> news -> quick. Every variant is presence-gated
    except ``word_of_day``, which is always emitted (no backend source yet).
    """
    items: list[FeedItem] = []
    deck_slices = signals.deck_slices

    # 1. resume — most-recently-studied / first-with-due / first deck.
    resume_deck = pick_resume_deck(deck_slices)
    resume_deck_id: UUID | None = resume_deck.deck_id if resume_deck is not None else None
    if resume_deck is not None:
        siblings = [d.deck_id for d in deck_slices if d.deck_id != resume_deck.deck_id][:2]
        items.append(
            ResumeFeedItem(
                type="resume",
                id=f"resume-{resume_deck.deck_id}",
                deck_id=resume_deck.deck_id,
                sibling_deck_ids=siblings,
            )
        )

    # 2. review — any cards due today.
    if signals.cards_due > 0:
        due_deck_ids = [d.deck_id for d in deck_slices if d.due_today > 0]
        items.append(
            ReviewFeedItem(
                type="review",
                id="review",
                cards_due=signals.cards_due,
                due_deck_ids=due_deck_ids,
            )
        )

    # 3. situation — the single gathered situation, if any.
    if signals.situation is not None:
        items.append(
            SituationFeedItem(
                type="situation",
                id=f"situation-{signals.situation.id}",
                situation=signals.situation,
            )
        )

    # 4. word_of_day — ALWAYS (no backend source yet; renders as placeholder).
    items.append(WordOfDayFeedItem(type="word_of_day", id="word-of-day"))

    # 5. deck — active decks (in-progress or due today) excluding the resume deck.
    for d in deck_slices:
        is_active = d.status == "in-progress" or d.due_today > 0
        if not is_active or d.deck_id == resume_deck_id:
            continue
        items.append(DeckFeedItem(type="deck", id=f"deck-{d.deck_id}", deck_id=d.deck_id))

    # 6. milestone — active streak.
    if signals.current_streak > 0:
        items.append(
            MilestoneFeedItem(
                type="milestone",
                id="milestone",
                current_streak=signals.current_streak,
                longest_streak=signals.longest_streak,
            )
        )

    # 7. news — one item per news article (1:1 mapping).
    for n in signals.news:
        items.append(NewsFeedItem(type="news", id=f"news-{n.id}", news=n))

    # 8. quick — exercises ready in the queue.
    if signals.queue_count > 0:
        items.append(QuickFeedItem(type="quick", id="quick", queue_count=signals.queue_count))

    return items


__all__ = [
    "ComposeFeedSignals",
    "DeckLike",
    "build_week_heat",
    "map_deck_slice",
    "derive_is_new_user",
    "pick_resume_deck",
    "compose_feed",
]
