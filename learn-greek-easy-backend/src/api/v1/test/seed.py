"""Seed API endpoints for E2E test database seeding.

IMPORTANT: These endpoints should NEVER be available in production.
The router is only mounted when settings.is_production is False.

Security layers:
1. Router is not mounted in production (checked at import time)
2. verify_seed_access dependency checks is_production again
3. test_seed_enabled must be True
4. Optional X-Test-Seed-Secret header validation
"""

from datetime import datetime, timedelta, timezone
from time import perf_counter
from typing import Any, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Body, Depends, Header, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.core.exceptions import (
    SeedDisabledException,
    SeedForbiddenException,
    SeedUnauthorizedException,
)
from src.core.logging import get_logger
from src.db.dependencies import get_db
from src.db.models import (
    CardErrorCardType,
    CardErrorReport,
    CardErrorStatus,
    Feedback,
    FeedbackCategory,
    FeedbackStatus,
    NewsItem,
    ProposalAttempt,
    WordEntry,
    WordProposal,
    WordProposalOrigin,
    WordProposalReviewLog,
    WordProposalState,
)
from src.repositories.user import UserRepository, UserSettingsRepository
from src.schemas.seed import (
    ResetOnboardingRequest,
    SeedRequest,
    SeedResultResponse,
    SeedStatusResponse,
)
from src.services.seed_service import SeedService, namespaced_beginner_email

logger = get_logger(__name__)


class TestCreateUserRequest(BaseModel):
    """Request model for creating a test user."""

    email: EmailStr
    full_name: str = "E2E Test User"


class TestCreateUserResponse(BaseModel):
    """Response model for test user creation."""

    success: bool
    user_id: str
    email: str
    full_name: str
    supabase_id: str | None
    is_superuser: bool = False


router = APIRouter(
    prefix="/test/seed",
    tags=["Testing"],
    responses={
        401: {"description": "Invalid or missing seed secret"},
        403: {"description": "Seeding disabled or production environment"},
    },
)


async def verify_seed_access(
    x_test_seed_secret: Optional[str] = Header(None, alias="X-Test-Seed-Secret"),
) -> None:
    """Dependency to verify seed endpoint access.

    Checks in order:
    1. Not production environment
    2. Seeding is enabled via TEST_SEED_ENABLED
    3. If secret is configured, it must match

    Raises:
        SeedForbiddenException: If production environment
        SeedDisabledException: If seeding is disabled
        SeedUnauthorizedException: If secret is configured but invalid
    """
    if settings.is_production:
        raise SeedForbiddenException()

    if not settings.test_seed_enabled:
        raise SeedDisabledException()

    if settings.seed_requires_secret:
        if not settings.validate_seed_secret(x_test_seed_secret):
            raise SeedUnauthorizedException()


@router.get(
    "/status",
    response_model=SeedStatusResponse,
    summary="Get seed endpoint status",
    description="Check if seeding is available and what's required to use it. "
    "This endpoint does not require authentication.",
)
async def get_seed_status() -> SeedStatusResponse:
    """Get current seed endpoint status without authentication.

    Returns information about:
    - Whether seeding is enabled
    - Current environment
    - Whether a secret is required
    - Any validation errors preventing seeding
    """
    return SeedStatusResponse(
        enabled=settings.can_seed_database(),
        environment=settings.app_env,
        requires_secret=settings.seed_requires_secret,
        validation_errors=settings.get_seed_validation_errors(),
    )


@router.post(
    "/all",
    response_model=SeedResultResponse,
    summary="Seed all data",
    description="Truncate database and seed with complete test dataset. "
    "Creates users, decks, cards, card statistics, and reviews.",
    dependencies=[Depends(verify_seed_access)],
)
async def seed_all(
    request: Optional[SeedRequest] = None,
    db: AsyncSession = Depends(get_db),
) -> SeedResultResponse:
    """Execute full database seeding.

    By default, truncates all tables first, then seeds:
    - 4 test users (learner, beginner, advanced, admin)
    - 4 decks (A1-B2 CEFR levels)
    - 40 cards (10 per deck)
    - Card statistics for the learner user
    - Review history for the learner user

    Args:
        request: Optional request body with seeding options.
            - skip_truncate: If True, don't truncate tables first (additive seeding)
        db: Database session

    Returns:
        SeedResultResponse with operation results and timing
    """
    start_time = perf_counter()

    service = SeedService(db)

    pr_number = request.pr_number if request else None

    # Note: skip_truncate option is less relevant now since users are permanent
    # Both paths call seed_all() which handles truncation (except for users)
    result = await service.seed_all(pr_number=pr_number)

    duration_ms = (perf_counter() - start_time) * 1000

    return SeedResultResponse(
        success=True,
        operation="all",
        timestamp=datetime.now(timezone.utc),
        duration_ms=duration_ms,
        results=result,
    )


@router.post(
    "/truncate",
    response_model=SeedResultResponse,
    summary="Truncate all tables",
    description="Clear all data from the database. " "Tables are truncated in FK-safe order.",
    dependencies=[Depends(verify_seed_access)],
)
async def truncate_tables(
    db: AsyncSession = Depends(get_db),
) -> SeedResultResponse:
    """Truncate all tables without seeding.

    Clears all data in FK-safe order:
    reviews -> card_statistics -> user_deck_progress ->
    user_settings -> cards -> users -> decks

    Returns:
        SeedResultResponse with truncation results and timing
    """
    start_time = perf_counter()
    service = SeedService(db)
    result = await service.truncate_tables()
    await db.commit()
    duration_ms = (perf_counter() - start_time) * 1000

    return SeedResultResponse(
        success=True,
        operation="truncate",
        timestamp=datetime.now(timezone.utc),
        duration_ms=duration_ms,
        results=result,
    )


@router.post(
    "/content",
    response_model=SeedResultResponse,
    summary="Seed V2 decks and word entries",
    description="Create V2 vocabulary decks with word entries without users or progress.",
    dependencies=[Depends(verify_seed_access)],
)
async def seed_content(
    db: AsyncSession = Depends(get_db),
) -> SeedResultResponse:
    """Create V2 vocabulary decks with word entries without users or progress.

    Creates V2 decks (Nouns, Verbs) with associated word entries.

    Returns:
        SeedResultResponse with content creation results and timing
    """
    start_time = perf_counter()
    service = SeedService(db)
    result = await service._seed_v2_decks()
    await db.commit()
    duration_ms = (perf_counter() - start_time) * 1000

    return SeedResultResponse(
        success=True,
        operation="content",
        timestamp=datetime.now(timezone.utc),
        duration_ms=duration_ms,
        results=result,
    )


@router.post(
    "/culture",
    response_model=SeedResultResponse,
    summary="Seed culture decks and questions only",
    description="Create culture decks and questions without users or progress. "
    "Creates 5 culture decks with 10 Greek culture questions each.",
    dependencies=[Depends(verify_seed_access)],
)
async def seed_culture(
    db: AsyncSession = Depends(get_db),
) -> SeedResultResponse:
    """Create culture decks and questions without users or progress.

    Creates:
    - 5 culture decks (History, Geography, Politics, Culture, Traditions)
    - 50 questions total (10 trilingual questions per deck: el, en, ru)

    Returns:
        SeedResultResponse with culture content creation results and timing
    """
    start_time = perf_counter()
    service = SeedService(db)
    result = await service.seed_culture_decks_and_questions()
    await db.commit()
    duration_ms = (perf_counter() - start_time) * 1000

    return SeedResultResponse(
        success=True,
        operation="culture",
        timestamp=datetime.now(timezone.utc),
        duration_ms=duration_ms,
        results=result,
    )


@router.post(
    "/mock-exams",
    response_model=SeedResultResponse,
    summary="Seed mock exam history",
    description="Create mock exam history for the learner test user. "
    "Creates 5 completed mock exam sessions (3 passed, 2 failed). "
    "Requires culture questions to be seeded first.",
    dependencies=[Depends(verify_seed_access)],
)
async def seed_mock_exams(
    db: AsyncSession = Depends(get_db),
) -> SeedResultResponse:
    """Create mock exam history for learner user.

    Creates:
    - 5 mock exam sessions (3 passed, 2 failed with 80% threshold)
    - 125 mock exam answers (25 per session)

    Requires culture questions to be seeded first (seed_all or seed_culture).

    Returns:
        SeedResultResponse with mock exam creation results and timing
    """
    start_time = perf_counter()
    service = SeedService(db)

    # Get learner user
    user_repo = UserRepository(db)
    learner = await user_repo.get_by_email("e2e_learner@test.com")

    if not learner:
        return SeedResultResponse(
            success=False,
            operation="mock-exams",
            timestamp=datetime.now(timezone.utc),
            duration_ms=(perf_counter() - start_time) * 1000,
            results={"error": "Learner user not found. Run /api/v1/test/seed/users first."},
        )

    result = await service.seed_mock_exam_history(user_id=learner.id)
    await db.commit()
    duration_ms = (perf_counter() - start_time) * 1000

    return SeedResultResponse(
        success=result.get("success", False),
        operation="mock-exams",
        timestamp=datetime.now(timezone.utc),
        duration_ms=duration_ms,
        results=result,
    )


@router.post(
    "/pending-question",
    response_model=SeedResultResponse,
    summary="Seed a pending culture question",
    description="Creates a pending review question for testing the review UI.",
)
async def seed_pending_question(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_seed_access),
) -> SeedResultResponse:
    """Seed a pending culture question for review testing."""
    start = perf_counter()

    service = SeedService(db)
    result = await service.seed_pending_question()
    await db.commit()

    duration_ms = (perf_counter() - start) * 1000

    return SeedResultResponse(
        success=True,
        operation="pending-question",
        timestamp=datetime.now(timezone.utc),
        duration_ms=round(duration_ms, 2),
        results=result,
    )


@router.post(
    "/news-feed",
    response_model=SeedResultResponse,
    summary="Seed news feed items",
    description="Create test news items for E2E testing.",
    dependencies=[Depends(verify_seed_access)],
)
async def seed_news_feed(
    db: AsyncSession = Depends(get_db),
) -> SeedResultResponse:
    """Create news feed test items for E2E testing."""
    start_time = perf_counter()

    seed_service = SeedService(db)
    result = await seed_service.seed_news_items()
    await db.commit()

    duration_ms = (perf_counter() - start_time) * 1000

    return SeedResultResponse(
        success=result.get("success", False),
        operation="news-feed",
        timestamp=datetime.now(timezone.utc),
        duration_ms=duration_ms,
        results=result,
    )


@router.post(
    "/news-questions",
    response_model=SeedResultResponse,
    summary="Seed news items with questions",
    description="Create test news items with Situation trees for E2E testing.",
    dependencies=[Depends(verify_seed_access)],
)
async def seed_news_questions(
    db: AsyncSession = Depends(get_db),
) -> SeedResultResponse:
    """Seed news items with Situation trees for E2E testing.

    Creates:
    - 3 NewsItems with Situation + SituationDescription trees
    """
    start_time = perf_counter()

    service = SeedService(db)
    result = await service.seed_news_questions()
    await db.commit()

    duration_ms = (perf_counter() - start_time) * 1000

    return SeedResultResponse(
        success=result.get("success", False),
        operation="news-questions",
        timestamp=datetime.now(timezone.utc),
        duration_ms=duration_ms,
        results=result,
    )


@router.post(
    "/news-feed-page",
    response_model=SeedResultResponse,
    summary="Seed news feed page",
    description="Creates 25 news items with Situation trees, varied categories and difficulty levels.",
    dependencies=[Depends(verify_seed_access)],
)
async def seed_news_feed_page(
    db: AsyncSession = Depends(get_db),
) -> SeedResultResponse:
    """Seed news items for E2E testing of the News Feed Page.

    Creates:
    - 25 NewsItems with Situation + SituationDescription trees
    - Varied categories, difficulty levels, and countries
    - Publication dates spread over the last 30 days

    This endpoint is idempotent - it clears existing test data before seeding.

    Returns:
        SeedResultResponse with news item creation results
    """
    start_time = perf_counter()

    service = SeedService(db)
    result = await service.seed_news_feed_page()
    await db.commit()

    duration_ms = (perf_counter() - start_time) * 1000

    return SeedResultResponse(
        success=result.get("success", False),
        operation="news-feed-page",
        timestamp=datetime.now(timezone.utc),
        duration_ms=duration_ms,
        results=result,
    )


@router.post(
    "/news-feed/clear",
    response_model=SeedResultResponse,
    summary="Clear news items only",
    description="Clear only news items without affecting other data.",
    dependencies=[Depends(verify_seed_access)],
)
async def clear_news_items(
    db: AsyncSession = Depends(get_db),
) -> SeedResultResponse:
    """Clear only news items from the database.

    Unlike /truncate, this only affects the news_items table,
    leaving users, decks, cards, and other data intact.

    Returns:
        SeedResultResponse with clear operation results and timing
    """
    start_time = perf_counter()

    # Delete only news items
    await db.execute(delete(NewsItem))
    await db.commit()

    duration_ms = (perf_counter() - start_time) * 1000

    return SeedResultResponse(
        success=True,
        operation="clear_news",
        timestamp=datetime.now(timezone.utc),
        duration_ms=duration_ms,
        results={"cleared": True, "table": "news_items"},
    )


# ── LEXGEN Verification Inbox (LEXGEN-12-05) ──────────────────────────────────
# Seed a DETERMINISTIC set of word_proposal rows so the read-only Verification
# Inbox E2E spec (admin-lexgen-inbox.spec.ts) can assert the queue filter,
# priority ordering, per-field provenance, and the anti-anchoring invariant
# (Decision Record §3 — NO numeric score reaches the DOM). Gated on
# verify_seed_access; never mounted in production. Mirrors /news-feed +
# /news-feed/clear (deletes only word_proposal rows; NEVER /truncate).
#
# DIGIT-COLLISION CONTRACT: the spec asserts each returned ``judge_score_digits``
# value is absent from the detail-panel text. The panel renders a formatted
# created_at date (arbitrary digits, not under our control), so we (1) keep every
# DISPLAYED value (lemma / pos / field value / source) strictly DIGIT-FREE, and
# (2) seed + return DISTINCTIVE 6-digit sentinels — a 6-digit run never substrings
# a formatted date or a digit-free value, making the assertion sound by
# construction and locale-independent. Real 1–5 rubric ints also live in
# judge_scores, but those are never serialized by the inbox API anyway.

# Distinctive 6-digit sentinels seeded into judge_scores / trust_score on the
# most-flagged row, returned as judge_score_digits. Chosen so the digit-string
# of each can never appear in a formatted date or any digit-free displayed value.
_LEXGEN_JUDGE_SENTINELS = [717273, 818283, 919293]


@router.post(
    "/lexgen-proposals",
    response_model=SeedResultResponse,
    summary="Seed LEXGEN verification-inbox proposals",
    description="Create a deterministic set of word_proposal rows for the "
    "Verification Inbox E2E spec: one heavily-flagged needs_review row (sorts "
    "first), one zero-flagged needs_review row, a few intermediate needs_review "
    "rows, and a couple of NON-needs_review rows that must be excluded from the "
    "queue. Idempotent — deletes all word_proposal rows first.",
    dependencies=[Depends(verify_seed_access)],
)
async def seed_lexgen_proposals(
    db: AsyncSession = Depends(get_db),
) -> SeedResultResponse:
    """Seed a deterministic word_proposal set for the Verification Inbox E2E spec.

    Creates (after deleting all existing rows for determinism):
      (a) ONE heavily-flagged ``needs_review`` row (>=3 flagged fields incl. a
          morphological key + a content key) carrying judge_scores + trust_score
          — this row sorts FIRST (most-flagged, oldest).
      (b) ONE ``needs_review`` row with ZERO flagged fields (still renders).
      (c) THREE ``needs_review`` rows with intermediate (1-2) flag counts.
      (d) TWO NON-``needs_review`` rows (scored, shipped) to prove the queue
          filter excludes them.

    All needs_review rows (total 5) fit on page 1 (PAGE_SIZE=20). Every displayed
    value is digit-free so the seeded judge_score sentinels can never collide.

    Returns:
        SeedResultResponse whose ``results`` includes needs_review_created,
        non_review_created, and judge_score_digits (the seeded sentinels).
    """
    start_time = perf_counter()

    # Determinism: wipe the table first so counts are exact.
    await db.execute(delete(WordProposal))
    await db.flush()

    base_ts = datetime.now(timezone.utc)

    def _recon_field(value: str, source: str) -> dict:
        """One reconciliation_log.fields entry (lexgen.reconciliation.v1 shape).

        Mirrors LexgenReconcilerService: value / source / confidence(None) /
        flags / cross_checks. The inbox detail serializer reads only value +
        source, but we carry the full shape for fidelity.
        """
        return {
            "value": value,
            "source": source,
            "confidence": None,
            "flags": [],
            "cross_checks": [],
        }

    def _recon_log(pos: str, lemma: str, fields: dict[str, dict]) -> dict:
        return {
            "schema_version": "lexgen.reconciliation.v1",
            "pos": pos,
            "lemma": lemma,
            "fields": fields,
            "gaps": [],
        }

    def _generated_content(gloss_en: str, gloss_ru: str, ex_el: str, ex_tr: str) -> dict:
        return {
            "gloss_en": gloss_en,
            "gloss_ru": gloss_ru,
            "example_greek": ex_el,
            "example_translation": ex_tr,
        }

    proposals: list[WordProposal] = []

    # (a) Heavily-flagged needs_review — sorts FIRST. Earliest created_at so the
    # FIFO tiebreak is also unambiguous. >=3 flagged fields including the
    # morphological "gender" and the content "example_greek".
    most_flagged = WordProposal(
        lemma_input="θάλασσα",
        pos="noun",
        origin=WordProposalOrigin.ADMIN,
        status=WordProposalState.NEEDS_REVIEW,
        flagged_fields=["gender", "declension_group", "example_greek"],
        reconciliation_log=_recon_log(
            "noun",
            "θάλασσα",
            {
                "gender": _recon_field("feminine", "wiktionary"),
                "declension_group": _recon_field("first declension", "triantafyllidis"),
            },
        ),
        generated_content=_generated_content(
            "sea",
            "море",
            "Η θάλασσα είναι ήρεμη σήμερα.",
            "The sea is calm today.",
        ),
        # Realistic rubric ints (1-5) PLUS distinctive 6-digit sentinels seeded
        # under non-serialized keys. The inbox API never serializes judge_scores,
        # so neither the ints nor the sentinels can leak; the sentinels are
        # returned so the spec's "digits absent from the DOM" assertion is real.
        judge_scores={
            "schema_version": "lexgen.judge.v1",
            "judges": [
                {
                    "model": "openai/gpt-4.1-mini",
                    "status": "scored",
                    "rubric": {
                        "naturalness": 4,
                        "sense_fit": 3,
                        "translation_faith_en": 4,
                        "translation_faith_ru": 5,
                        "a2_appropriateness": 4,
                        "blocking_issues": [],
                    },
                },
                {
                    "model": "anthropic/claude-haiku-4.5",
                    "status": "scored",
                    "rubric": {
                        "naturalness": 2,
                        "sense_fit": 3,
                        "translation_faith_en": 4,
                        "translation_faith_ru": 4,
                        "a2_appropriateness": 3,
                        "blocking_issues": [
                            {"field": "example_greek", "issue": "register too formal"}
                        ],
                    },
                },
            ],
            "disagreement": {
                "disagreed": True,
                "dimensions": ["naturalness"],
                "rule": "per_dimension_delta>=2 OR blocking_issue_field_mismatch",
            },
            # Sentinels live here so they are GENUINELY seeded into judge_scores.
            "seed_sentinels": _LEXGEN_JUDGE_SENTINELS,
        },
        trust_score=float(_LEXGEN_JUDGE_SENTINELS[0]),
    )
    most_flagged.created_at = base_ts
    proposals.append(most_flagged)

    def _evidence_packet(lemma: str, gender: str, gloss_en: str) -> dict[str, Any]:
        """Build a schema-valid EvidencePacket dict for LEXGEN E2E flows.

        Returns a JSON-serializable dict (suitable for JSONB storage) that
        round-trips through ``EvidencePacket.model_validate()`` — required by
        the generator and judge stage services.  Mirrors ``_make_biblio_packet``
        in tests/integration/services/test_lexgen_review_service.py.

        ``gloss_en`` MUST equal the canned payload's ``gloss_en`` in
        ``lexgen_fake_openrouter.FakeOpenRouter`` so ``check_gloss_subset``
        in the verify stage PASSES.
        """
        from src.schemas.lexgen import (  # noqa: PLC0415
            EvidencePacket,
            EvidencePacketSources,
            FrequencySource,
            GreekLexiconSource,
            RulesSource,
            WiktionarySource,
        )

        packet = EvidencePacket(
            lemma_input=lemma,
            normalized_lemma=lemma,
            pos="noun",
            sources=EvidencePacketSources(
                wiktionary=WiktionarySource(
                    present=True,
                    gender=gender,
                    forms=[],
                    pronunciation=None,
                    glosses_en=gloss_en,
                    genders=None,
                ),
                greek_lexicon=GreekLexiconSource(
                    present=False,
                    forms=[],
                    attested_lemma=False,
                    attested_surface_form=False,
                    resolved_lemma=None,
                ),
                frequency=FrequencySource(present=False, rank=None, band=None),
                rules=RulesSource(present=False),
            ),
        )
        return packet.model_dump(mode="json")

    # (c) Three intermediate needs_review rows (1-2 flags each), created LATER so
    # they sort after the most-flagged row.
    #
    # βιβλίο (Flow 3 — regenerate) and δρόμος (Flow 2 — edit) carry additional
    # fields so the LEXGEN E2E chain can run with the FakeOpenRouter injected:
    #   - evidence_packet: schema-valid EvidencePacket (required by generator/judge)
    #   - generated_fields: prior morphological output (edit logs pipeline_value=old)
    #   - generated_content: prior RAG output (snapshot in ProposalAttempt)
    #   - reconciliation_log: reconciler output (snapshot in ProposalAttempt)
    #   - retry_attempts: βιβλίο=2 so AC-4 can assert the snapshot preserves it

    # βιβλίο — regenerate flow (offset=1 → created_at base+1min, sorts 2nd)
    biblio_row = WordProposal(
        lemma_input="βιβλίο",
        pos="noun",
        origin=WordProposalOrigin.ADMIN,
        status=WordProposalState.NEEDS_REVIEW,
        flagged_fields=["gender"],
        reconciliation_log=_recon_log(
            "noun", "βιβλίο", {"gender": _recon_field("neuter", "wiktionary")}
        ),
        generated_content=_generated_content("book", "книга", "Βιβλίο.", "Book."),
        generated_fields={"gender": "neuter"},
        evidence_packet=_evidence_packet("βιβλίο", "neuter", "book"),
        retry_attempts=2,
    )
    biblio_row.created_at = base_ts + timedelta(minutes=1)
    proposals.append(biblio_row)

    # ποτάμι — untouched intermediate row (offset=2)
    potami_row = WordProposal(
        lemma_input="ποτάμι",
        pos="noun",
        origin=WordProposalOrigin.ADMIN,
        status=WordProposalState.NEEDS_REVIEW,
        flagged_fields=["example_translation", "gloss_ru"],
        reconciliation_log=_recon_log(
            "noun", "ποτάμι", {"gender": _recon_field("neuter", "triantafyllidis")}
        ),
        generated_content=_generated_content(
            "river", "река", "Το ποτάμι κυλάει αργά.", "The river flows slowly."
        ),
    )
    potami_row.created_at = base_ts + timedelta(minutes=2)
    proposals.append(potami_row)

    # δρόμος — edit flow (offset=3 → created_at base+3min, sorts last among intermediates)
    dromos_row = WordProposal(
        lemma_input="δρόμος",
        pos="noun",
        origin=WordProposalOrigin.ADMIN,
        status=WordProposalState.NEEDS_REVIEW,
        flagged_fields=["gender"],
        reconciliation_log=_recon_log(
            "noun", "δρόμος", {"gender": _recon_field("masculine", "wiktionary")}
        ),
        generated_content=_generated_content("road", "дорога", "Δρόμος.", "Road."),
        generated_fields={"gender": "masculine"},
        evidence_packet=_evidence_packet("δρόμος", "masculine", "road"),
        retry_attempts=0,
    )
    dromos_row.created_at = base_ts + timedelta(minutes=3)
    proposals.append(dromos_row)

    # (b) Zero-flagged needs_review — still renders detail (recon + content), but
    # carries an empty flagged_fields list. Created last among needs_review rows.
    zero_flagged = WordProposal(
        lemma_input="ουρανός",
        pos="noun",
        origin=WordProposalOrigin.ADMIN,
        status=WordProposalState.NEEDS_REVIEW,
        flagged_fields=[],
        reconciliation_log=_recon_log(
            "noun",
            "ουρανός",
            {"gender": _recon_field("masculine", "wiktionary")},
        ),
        generated_content=_generated_content(
            "sky",
            "небо",
            "Ο ουρανός είναι γαλάζιος.",
            "The sky is blue.",
        ),
    )
    zero_flagged.created_at = base_ts + timedelta(minutes=10)
    proposals.append(zero_flagged)

    needs_review_created = len(proposals)

    # (d) NON-needs_review rows — MUST be excluded from the queue. shipped's
    # shipped_word_entry_id is a nullable SET-NULL FK, so a None target is valid.
    non_review = [
        WordProposal(
            lemma_input="πίνακας",
            pos="noun",
            origin=WordProposalOrigin.ADMIN,
            status=WordProposalState.SCORED,
            flagged_fields=[],
        ),
        WordProposal(
            lemma_input="καρέκλα",
            pos="noun",
            origin=WordProposalOrigin.ADMIN,
            status=WordProposalState.SHIPPED,
            flagged_fields=[],
            shipped_word_entry_id=None,
        ),
    ]
    proposals.extend(non_review)
    non_review_created = len(non_review)

    db.add_all(proposals)
    await db.commit()

    duration_ms = (perf_counter() - start_time) * 1000

    return SeedResultResponse(
        success=True,
        operation="lexgen-proposals",
        timestamp=datetime.now(timezone.utc),
        duration_ms=duration_ms,
        results={
            "needs_review_created": needs_review_created,
            "non_review_created": non_review_created,
            "judge_score_digits": _LEXGEN_JUDGE_SENTINELS,
        },
    )


@router.post(
    "/lexgen-proposals/clear",
    response_model=SeedResultResponse,
    summary="Clear LEXGEN word proposals only",
    description="Delete only word_proposal rows without affecting other data. "
    "Mirrors /news-feed/clear (NEVER /truncate).",
    dependencies=[Depends(verify_seed_access)],
)
async def clear_lexgen_proposals(
    db: AsyncSession = Depends(get_db),
) -> SeedResultResponse:
    """Clear only word_proposal rows from the database.

    Unlike /truncate, this only affects the word_proposal table, leaving users,
    decks, cards, and other data intact (D-SEED-CLEAR).

    Returns:
        SeedResultResponse with clear operation results and timing.
    """
    start_time = perf_counter()

    await db.execute(delete(WordProposal))
    await db.commit()

    duration_ms = (perf_counter() - start_time) * 1000

    return SeedResultResponse(
        success=True,
        operation="clear_lexgen_proposals",
        timestamp=datetime.now(timezone.utc),
        duration_ms=duration_ms,
        results={"cleared": True, "table": "word_proposal"},
    )


# ---------------------------------------------------------------------------
# LEXGEN test-only read endpoints (LEXGEN-13-06 D2)
# ---------------------------------------------------------------------------
# These three GET routes expose structured DB state for the 4 E2E action flows.
# All are gated by verify_seed_access (TEST_SEED_ENABLED + not production) and
# NEVER surfaced in the production deployment.
#
# Why they exist:
#   - The admin GET /lexgen/proposals/{id} (admin:1293) returns 404 when status
#     != needs_review, so it cannot read a shipped/rejected proposal post-action.
#   - These routes are the ONLY way to assert final DB state from Playwright.
# ---------------------------------------------------------------------------


class _ReviewLogRow(BaseModel):
    """One word_proposal_review_log row, shape for E2E assertions."""

    action: str
    field: str | None
    pipeline_value: str | None
    edited_value: str | None
    human_decision: str | None
    reviewer_id: str | None
    created_at: datetime


class _ReviewLogResponse(BaseModel):
    rows: list[_ReviewLogRow]


class _AttemptRow(BaseModel):
    """One proposal_attempt row (score-free), shape for E2E assertions."""

    attempt_no: int
    generated_content: dict | None
    generated_fields: dict | None
    flagged_fields: list | None
    retry_attempts: int | None
    superseded_at: datetime | None
    created_at: datetime


class _AttemptsResponse(BaseModel):
    attempts: list[_AttemptRow]


class _ProposalStateResponse(BaseModel):
    """Current status + shipped FK for post-action assertions."""

    status: str
    rejection_reason: str | None
    shipped_word_entry_id: str | None
    word_entry_exists: bool
    flagged_fields: list


@router.get(
    "/lexgen-proposals/{proposal_id}/review-log",
    response_model=_ReviewLogResponse,
    summary="[TEST ONLY] Read review-log rows for a proposal",
    description="Returns all word_proposal_review_log rows for the given proposal, "
    "ordered by created_at ASC. Gated by TEST_SEED_ENABLED. Never in prod.",
    dependencies=[Depends(verify_seed_access)],
)
async def get_lexgen_proposal_review_log(
    proposal_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> _ReviewLogResponse:
    """Return all review-log rows for the given proposal (E2E assertions)."""
    result = await db.execute(
        select(WordProposalReviewLog)
        .where(WordProposalReviewLog.proposal_id == proposal_id)
        .order_by(WordProposalReviewLog.created_at.asc(), WordProposalReviewLog.id.asc())
    )
    rows = result.scalars().all()
    return _ReviewLogResponse(
        rows=[
            _ReviewLogRow(
                action=row.action.value if hasattr(row.action, "value") else str(row.action),
                field=row.field,
                pipeline_value=row.pipeline_value,
                edited_value=row.edited_value,
                human_decision=(
                    row.human_decision.value
                    if row.human_decision is not None and hasattr(row.human_decision, "value")
                    else (str(row.human_decision) if row.human_decision is not None else None)
                ),
                reviewer_id=str(row.reviewer_id) if row.reviewer_id is not None else None,
                created_at=row.created_at,
            )
            for row in rows
        ]
    )


@router.get(
    "/lexgen-proposals/{proposal_id}/attempts",
    response_model=_AttemptsResponse,
    summary="[TEST ONLY] Read proposal_attempt rows for a proposal",
    description="Returns all proposal_attempt rows for the given proposal, "
    "ordered by attempt_no ASC. Score-free (judge_scores omitted). "
    "Gated by TEST_SEED_ENABLED. Never in prod.",
    dependencies=[Depends(verify_seed_access)],
)
async def get_lexgen_proposal_attempts(
    proposal_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> _AttemptsResponse:
    """Return all attempt snapshots for the given proposal (E2E assertions)."""
    result = await db.execute(
        select(ProposalAttempt)
        .where(ProposalAttempt.proposal_id == proposal_id)
        .order_by(ProposalAttempt.attempt_no.asc())
    )
    attempts = result.scalars().all()
    return _AttemptsResponse(
        attempts=[
            _AttemptRow(
                attempt_no=a.attempt_no,
                generated_content=a.generated_content,
                generated_fields=a.generated_fields,
                flagged_fields=a.flagged_fields,
                retry_attempts=a.retry_attempts,
                superseded_at=a.superseded_at,
                created_at=a.created_at,
            )
            for a in attempts
        ]
    )


@router.get(
    "/lexgen-proposals/{proposal_id}/state",
    response_model=_ProposalStateResponse,
    summary="[TEST ONLY] Read proposal status + shipped FK for post-action assertion",
    description="Returns status, rejection_reason, shipped_word_entry_id, "
    "word_entry_exists (bool), and flagged_fields. The admin detail endpoint "
    "returns 404 on non-needs_review proposals; this route is the only way to "
    "read shipped/rejected state from E2E. Gated by TEST_SEED_ENABLED. Never in prod.",
    dependencies=[Depends(verify_seed_access)],
)
async def get_lexgen_proposal_state(
    proposal_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> _ProposalStateResponse:
    """Return current proposal status + shipped-entry existence (E2E assertions)."""
    result = await db.execute(select(WordProposal).where(WordProposal.id == proposal_id))
    proposal = result.scalar_one_or_none()
    if proposal is None:
        raise HTTPException(status_code=404, detail=f"Proposal {proposal_id} not found")

    word_entry_exists = False
    if proposal.shipped_word_entry_id is not None:
        entry_result = await db.execute(
            select(WordEntry).where(WordEntry.id == proposal.shipped_word_entry_id)
        )
        word_entry_exists = entry_result.scalar_one_or_none() is not None

    return _ProposalStateResponse(
        status=(
            proposal.status.value if hasattr(proposal.status, "value") else str(proposal.status)
        ),
        rejection_reason=proposal.rejection_reason,
        shipped_word_entry_id=(
            str(proposal.shipped_word_entry_id)
            if proposal.shipped_word_entry_id is not None
            else None
        ),
        word_entry_exists=word_entry_exists,
        flagged_fields=list(proposal.flagged_fields or []),
    )


@router.post(
    "/create-user",
    response_model=TestCreateUserResponse,
    summary="Create test user in Supabase Auth and app DB",
    description="Create a new test user in both Supabase Auth and the application database. "
    "ONLY available when TEST_SEED_ENABLED=true and NOT in production.",
    dependencies=[Depends(verify_seed_access)],
)
async def create_test_user(
    request: TestCreateUserRequest,
    db: AsyncSession = Depends(get_db),
) -> TestCreateUserResponse:
    """Create a test user in Supabase Auth and app DB.

    Args:
        request: Contains email and optional full_name
        db: Database session

    Returns:
        TestCreateUserResponse with user data
    """
    from src.core.supabase_admin import get_supabase_admin_client
    from src.db.models import User, UserSettings

    admin_client = get_supabase_admin_client()

    supabase_id = None
    if admin_client:
        # Idempotent: delete existing Supabase Auth user first
        existing = await admin_client.list_users_by_email(request.email)
        if existing:
            await admin_client.delete_user(existing[0]["id"])
        supabase_user = await admin_client.create_user(
            email=request.email,
            password="TestPassword123!",
            email_confirm=True,
            user_metadata={"full_name": request.full_name},
        )
        supabase_id = supabase_user["id"]

    # Check if app DB user exists
    user_repo = UserRepository(db)
    existing_db_user = await user_repo.get_by_email(request.email)
    if existing_db_user:
        existing_db_user.supabase_id = supabase_id
        await db.flush()
        user = existing_db_user
    else:
        user = User(
            email=request.email,
            full_name=request.full_name,
            supabase_id=supabase_id,
            is_superuser=False,
            is_active=True,
        )
        db.add(user)
        await db.flush()
        user_settings = UserSettings(user_id=user.id, daily_goal=20, email_notifications=True)
        db.add(user_settings)

    await db.commit()

    return TestCreateUserResponse(
        success=True,
        user_id=str(user.id),
        email=user.email,
        full_name=user.full_name or "",
        supabase_id=supabase_id,
    )


@router.post(
    "/danger-zone",
    response_model=SeedResultResponse,
    summary="Seed danger zone test users",
    description="Create test users for danger zone E2E tests. "
    "Creates e2e_danger_reset@test.com (full data) and "
    "e2e_danger_delete@test.com (minimal data). "
    "Requires /seed/content and /seed/culture to be called first.",
    dependencies=[Depends(verify_seed_access)],
)
async def seed_danger_zone(
    db: AsyncSession = Depends(get_db),
) -> SeedResultResponse:
    """Create danger zone test users with appropriate data states.

    Creates two test users for E2E testing:
    - e2e_danger_reset@test.com: Full progress data for reset testing
    - e2e_danger_delete@test.com: Minimal data for deletion testing

    This endpoint is idempotent - it deletes existing users before recreating.
    Requires /seed/content and /seed/culture to be called first for full data.

    Returns:
        SeedResultResponse with user creation results and timing
    """
    start_time = perf_counter()

    seed_service = SeedService(db)
    result = await seed_service.seed_danger_zone_users()
    await db.commit()

    duration_ms = (perf_counter() - start_time) * 1000

    return SeedResultResponse(
        success=result.get("success", False),
        operation="danger-zone",
        timestamp=datetime.now(timezone.utc),
        duration_ms=duration_ms,
        results=result,
    )


@router.post(
    "/changelog",
    response_model=SeedResultResponse,
    summary="Seed changelog entries",
    description="Create test changelog entries for E2E testing. Creates 12 entries with varied tags and dates.",
    dependencies=[Depends(verify_seed_access)],
)
async def seed_changelog(
    db: AsyncSession = Depends(get_db),
) -> SeedResultResponse:
    """Seed changelog entries for E2E testing."""
    start_time = perf_counter()

    service = SeedService(db)
    result = await service.seed_changelog_entries()
    await db.commit()

    duration_ms = (perf_counter() - start_time) * 1000

    return SeedResultResponse(
        success=result.get("success", False),
        operation="changelog",
        timestamp=datetime.now(timezone.utc),
        duration_ms=duration_ms,
        results=result,
    )


@router.post(
    "/announcements",
    response_model=SeedResultResponse,
    summary="Seed announcement campaigns",
    description="Create announcement campaigns and notifications for E2E testing. "
    "Creates 4 campaigns with varied states (read/unread, with/without links, "
    "different ages). Requires test users to be seeded first.",
    dependencies=[Depends(verify_seed_access)],
)
async def seed_announcements(
    db: AsyncSession = Depends(get_db),
) -> SeedResultResponse:
    """Create announcement campaigns for E2E testing.

    Creates 4 announcement campaigns with varying states:
    - Fresh announcement (30 min ago, unread)
    - Recent with link (2 hours ago, read)
    - Day-old announcement (24 hours ago, read)
    - Week-old announcement (7 days ago, unread)

    Requires test users to be seeded first (seed_all or seed_users).

    Returns:
        SeedResultResponse with campaign creation results and timing
    """
    start_time = perf_counter()

    user_repo = UserRepository(db)
    admin = await user_repo.get_by_email("e2e_admin@test.com")
    learner = await user_repo.get_by_email("e2e_learner@test.com")

    if not admin or not learner:
        return SeedResultResponse(
            success=False,
            operation="announcements",
            timestamp=datetime.now(timezone.utc),
            duration_ms=(perf_counter() - start_time) * 1000,
            results={"error": "Test users not found. Run /seed/users first."},
        )

    service = SeedService(db)
    result = await service.seed_announcement_campaigns(
        admin_id=admin.id,
        learner_id=learner.id,
    )
    await db.commit()

    return SeedResultResponse(
        success=result.get("success", False),
        operation="announcements",
        timestamp=datetime.now(timezone.utc),
        duration_ms=(perf_counter() - start_time) * 1000,
        results=result,
    )


@router.post(
    "/admin-cards",
    response_model=SeedResultResponse,
    summary="Seed vocabulary cards for admin testing",
    description="Create vocabulary decks and cards for E2E testing of the admin vocabulary card UI. "
    "Creates 2 decks: one with 10 cards of varying completeness, one empty for first card creation. "
    "This endpoint is idempotent - existing test data is replaced.",
    dependencies=[Depends(verify_seed_access)],
)
async def seed_admin_cards(
    db: AsyncSession = Depends(get_db),
) -> SeedResultResponse:
    """Seed vocabulary cards for admin E2E testing.

    Creates:
    - 1 deck with 10 vocabulary cards (varying grammar completeness)
    - 1 empty deck for first card creation testing

    Card types include:
    - Basic cards (just front_text and back_text_en)
    - Cards with Russian translations
    - Cards with pronunciation
    - Noun cards with partial/full declension
    - Verb cards with active/passive voice
    - Adjective cards with declension and comparison
    - Adverb cards with comparison forms
    - Cards with structured examples

    This endpoint is idempotent - it replaces existing E2E test decks.

    Returns:
        SeedResultResponse with deck and card creation results
    """
    start_time = perf_counter()

    service = SeedService(db)
    result = await service.seed_admin_cards()
    await db.commit()

    duration_ms = (perf_counter() - start_time) * 1000

    return SeedResultResponse(
        success=result.get("success", False),
        operation="admin-cards",
        timestamp=datetime.now(timezone.utc),
        duration_ms=duration_ms,
        results=result,
    )


@router.post(
    "/subscription-users",
    response_model=SeedResultResponse,
    summary="Seed subscription test users",
    description=(
        "Create test users with various subscription states for E2E testing. "
        "Creates 5 users: trial, expired trial, premium, cancelled, past due. "
        "This endpoint is idempotent - existing users are updated, not duplicated."
    ),
    dependencies=[Depends(verify_seed_access)],
)
async def seed_subscription_users(
    db: AsyncSession = Depends(get_db),
) -> SeedResultResponse:
    """Seed subscription test users for E2E testing."""
    start_time = perf_counter()

    service = SeedService(db)
    result = await service.seed_subscription_users()
    await db.commit()

    duration_ms = (perf_counter() - start_time) * 1000

    return SeedResultResponse(
        success=result.get("success", False),
        operation="subscription-users",
        timestamp=datetime.now(timezone.utc),
        duration_ms=duration_ms,
        results=result,
    )


@router.post(
    "/situations",
    response_model=SeedResultResponse,
    summary="Seed situation records",
    description="Create 3 sample situations with B1/A2 descriptions for E2E testing.",
    dependencies=[Depends(verify_seed_access)],
)
async def seed_situations(
    db: AsyncSession = Depends(get_db),
) -> SeedResultResponse:
    """Create situation records with descriptions for E2E testing.

    Creates:
    - 3 Situation records (DRAFT status)
    - 3 SituationDescription records with B1 text_el and A2 text_el_a2

    This endpoint is idempotent - existing seed situations are replaced.

    Returns:
        SeedResultResponse with situation creation results and timing
    """
    start_time = perf_counter()

    service = SeedService(db)
    result = await service.seed_situations()
    await db.commit()

    duration_ms = (perf_counter() - start_time) * 1000

    return SeedResultResponse(
        success=result.get("success", False),
        operation="situations",
        timestamp=datetime.now(timezone.utc),
        duration_ms=duration_ms,
        results=result,
    )


class GamificationResetStuckStateRequest(BaseModel):
    """Request body for resetting a user to the gamification stuck state."""

    email: EmailStr
    achievement_id: str


class GamificationResetStuckStateResponse(BaseModel):
    """Response for gamification stuck-state reset."""

    success: bool
    deleted_rows: int
    projection_version_reset: bool


@router.post(
    "/gamification-reset-stuck-state",
    response_model=GamificationResetStuckStateResponse,
    summary="Reset user to gamification stuck state",
    description=(
        "Idempotent test-only endpoint. "
        "Deletes the UserAchievement row for the given (email, achievement_id) pair "
        "and resets UserXP.projection_version to 0, reproducing the pre-GAMIF-04 "
        "'stuck user' shape for E2E self-heal testing."
    ),
    dependencies=[Depends(verify_seed_access)],
)
async def gamification_reset_stuck_state(
    body: GamificationResetStuckStateRequest,
    db: AsyncSession = Depends(get_db),
) -> GamificationResetStuckStateResponse:
    """Reset a user to the stuck gamification state for E2E self-heal testing.

    Args:
        body: email + achievement_id to reset
        db: Database session

    Returns:
        GamificationResetStuckStateResponse with operation details

    Raises:
        404: If no user found with the given email
    """
    user_repo = UserRepository(db)
    user = await user_repo.get_by_email(body.email)
    if not user:
        raise HTTPException(
            status_code=404,
            detail=f"User not found: {body.email}",
        )

    service = SeedService(db)
    result = await service.reset_gamification_stuck_state(
        user_id=user.id,
        achievement_id=body.achievement_id,
    )
    await db.commit()

    return GamificationResetStuckStateResponse(
        success=result["success"],
        deleted_rows=result["deleted_rows"],
        projection_version_reset=result["projection_version_reset"],
    )


class GamificationNearThresholdRequest(BaseModel):
    """Request body for resetting a user to the near-threshold gamification state."""

    email: EmailStr
    achievement_id: str


class GamificationNearThresholdResponse(BaseModel):
    """Response for gamification near-threshold reset."""

    ok: bool
    achievement_id: str
    current_value: int
    threshold: int
    reviews_truncated: int


@router.post(
    "/gamification-near-threshold",
    response_model=GamificationNearThresholdResponse,
    summary="Reset user to gamification near-threshold state",
    description=(
        "Idempotent test-only endpoint for GAMIF-05-06 IMMEDIATE-mode E2E testing. "
        "Resets the learner so that cards_learned == 0 (one review away from unlocking "
        "the given achievement), allowing a single card review to cross the threshold "
        "and fire the achievement toast via the IMMEDIATE reconcile path."
    ),
    dependencies=[Depends(verify_seed_access)],
)
async def gamification_near_threshold(
    body: GamificationNearThresholdRequest,
    db: AsyncSession = Depends(get_db),
) -> GamificationNearThresholdResponse:
    """Reset a user to the near-threshold gamification state for IMMEDIATE-mode E2E testing.

    Args:
        body: email + achievement_id to target
        db: Database session

    Returns:
        GamificationNearThresholdResponse with operation details

    Raises:
        404: If no user found with the given email
    """
    user_repo = UserRepository(db)
    user = await user_repo.get_by_email(body.email)
    if not user:
        raise HTTPException(
            status_code=404,
            detail=f"User not found: {body.email}",
        )

    service = SeedService(db)
    try:
        result = await service.reset_user_to_near_threshold(
            user_id=user.id,
            achievement_id=body.achievement_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        # Log the full traceback so CI logs reveal the root cause of any 500.
        logger.exception(
            "gamification-near-threshold seed failed unexpectedly",
            extra={
                "event": "seed.near_threshold.error",
                "user_id": str(user.id),
                "achievement_id": body.achievement_id,
                "error_type": type(exc).__name__,
                "error_message": str(exc),
            },
        )
        raise
    await db.commit()

    return GamificationNearThresholdResponse(
        ok=result["ok"],
        achievement_id=result["achievement_id"],
        current_value=result["current_value"],
        threshold=result["threshold"],
        reviews_truncated=result["reviews_truncated"],
    )


@router.post(
    "/feedback",
    response_model=SeedResultResponse,
    summary="Seed a feedback item",
    description="Create one Feedback row (status=NEW) for E2E testing. "
    "Requires test users to be seeded first.",
    dependencies=[Depends(verify_seed_access)],
)
async def seed_feedback(
    db: AsyncSession = Depends(get_db),
) -> SeedResultResponse:
    """Create a single Feedback row for E2E testing.

    Creates one Feedback item with status=NEW attributed to e2e_learner.
    Requires /seed/all or /seed/users to have run first.

    Returns:
        SeedResultResponse with the created feedback id.
    """
    start_time = perf_counter()

    user_repo = UserRepository(db)
    learner = await user_repo.get_by_email("e2e_learner@test.com")

    if not learner:
        return SeedResultResponse(
            success=False,
            operation="feedback",
            timestamp=datetime.now(timezone.utc),
            duration_ms=(perf_counter() - start_time) * 1000,
            results={"error": "e2e_learner@test.com not found. Run /seed/users first."},
        )

    feedback = Feedback(
        user_id=learner.id,
        title="E2E test feedback item",
        description="Created by /test/seed/feedback for E2E badge regression testing.",
        category=FeedbackCategory.FEATURE_REQUEST,
        status=FeedbackStatus.NEW,
    )
    db.add(feedback)
    await db.flush()
    await db.commit()

    duration_ms = (perf_counter() - start_time) * 1000
    return SeedResultResponse(
        success=True,
        operation="feedback",
        timestamp=datetime.now(timezone.utc),
        duration_ms=duration_ms,
        results={"id": str(feedback.id)},
    )


@router.post(
    "/card-error",
    response_model=SeedResultResponse,
    summary="Seed a card error report",
    description="Create one CardErrorReport row for E2E testing. "
    "Accepts optional card_type (default WORD) and status (default PENDING) body params. "
    "When status is FIXED/REVIEWED/DISMISSED, stamps resolved_at and resolved_by. "
    "Requires test users to be seeded first.",
    dependencies=[Depends(verify_seed_access)],
)
async def seed_card_error(
    card_type: CardErrorCardType = Body(CardErrorCardType.WORD),
    status: CardErrorStatus = Body(CardErrorStatus.PENDING),
    description: str = Body("E2E test card error report — pending admin review."),
    db: AsyncSession = Depends(get_db),
) -> SeedResultResponse:
    """Create a single CardErrorReport row for E2E testing.

    Creates one CardErrorReport attributed to e2e_learner.
    When status is FIXED, REVIEWED, or DISMISSED, stamps resolved_at = now()
    and resolved_by = e2e_admin.id so the resolved banner and Meta tab have data.
    Uses a random UUID for card_id (no FK constraint on that column).
    Requires /seed/all or /seed/users to have run first.

    Returns:
        SeedResultResponse with the created report id.
    """
    start_time = perf_counter()

    user_repo = UserRepository(db)
    learner = await user_repo.get_by_email("e2e_learner@test.com")

    if not learner:
        return SeedResultResponse(
            success=False,
            operation="card-error",
            timestamp=datetime.now(timezone.utc),
            duration_ms=(perf_counter() - start_time) * 1000,
            results={"error": "e2e_learner@test.com not found. Run /seed/users first."},
        )

    resolved_at = None
    resolved_by = None
    terminal_statuses = {CardErrorStatus.FIXED, CardErrorStatus.REVIEWED, CardErrorStatus.DISMISSED}
    if status in terminal_statuses:
        admin = await user_repo.get_by_email("e2e_admin@test.com")
        if admin:
            resolved_at = datetime.now(timezone.utc)
            resolved_by = admin.id

    report = CardErrorReport(
        user_id=learner.id,
        card_type=card_type,
        card_id=uuid4(),
        description=description,
        status=status,
        resolved_at=resolved_at,
        resolved_by=resolved_by,
    )
    db.add(report)
    await db.flush()
    await db.commit()

    duration_ms = (perf_counter() - start_time) * 1000
    return SeedResultResponse(
        success=True,
        operation="card-error",
        timestamp=datetime.now(timezone.utc),
        duration_ms=duration_ms,
        results={"id": str(report.id), "card_type": card_type.value, "status": status.value},
    )


@router.post(
    "/card-errors",
    summary="Seed canonical batch of 4 card error reports",
    description="Creates 4 canonical CardErrorReport rows in one call: "
    "WORD-PENDING, CULTURE-PENDING, WORD-FIXED, WORD-DISMISSED. "
    "Returns their IDs in stable order. Gated on TEST_SEED_ENABLED. "
    "Requires test users to be seeded first.",
    dependencies=[Depends(verify_seed_access)],
)
async def seed_card_errors_batch(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Create 4 canonical CardErrorReport rows in one call.

    Canonical order (stable for E2E spec assertions):
      1. WORD   + PENDING   — open, no resolver
      2. CULTURE + PENDING  — open, no resolver
      3. WORD   + FIXED     — resolved, resolver = e2e_admin
      4. WORD   + DISMISSED — resolved, resolver = e2e_admin

    Returns:
        {"ids": [str, str, str, str]} in the order above.
    """
    user_repo = UserRepository(db)
    learner = await user_repo.get_by_email("e2e_learner@test.com")
    admin = await user_repo.get_by_email("e2e_admin@test.com")

    if not learner or not admin:
        return {
            "ids": [],
            "error": "e2e_learner or e2e_admin not found. Run /seed/users first.",
        }

    now = datetime.now(timezone.utc)

    specs = [
        (CardErrorCardType.WORD, CardErrorStatus.PENDING, None, None),
        (CardErrorCardType.CULTURE, CardErrorStatus.PENDING, None, None),
        (CardErrorCardType.WORD, CardErrorStatus.FIXED, now, admin.id),
        (CardErrorCardType.WORD, CardErrorStatus.DISMISSED, now, admin.id),
    ]

    rows = [
        CardErrorReport(
            user_id=learner.id,
            card_type=ct,
            card_id=uuid4(),
            description=f"E2E batch {ct.value}/{st.value}",
            status=st,
            resolved_at=resolved_at,
            resolved_by=resolved_by,
        )
        for ct, st, resolved_at, resolved_by in specs
    ]
    db.add_all(rows)
    await db.flush()
    await db.commit()
    for r in rows:
        await db.refresh(r)

    return {"ids": [str(r.id) for r in rows]}


@router.post(
    "/reset-onboarding",
    response_model=SeedResultResponse,
    summary="Reset onboarding state for e2e_beginner user",
    description="Nulls tour_completed_at for the E2E beginner user so Maestro E2E tests "
    "can exercise the onboarding tour from a clean state. "
    "Pass pr_number in the body to target a namespaced user (e.g. e2e_beginner+pr<N>@test.com). "
    "Requires test users to be seeded first.",
    dependencies=[Depends(verify_seed_access)],
)
async def reset_onboarding(
    body: Optional[ResetOnboardingRequest] = Body(default=None),
    db: AsyncSession = Depends(get_db),
) -> SeedResultResponse:
    """Null tour_completed_at for the E2E beginner user.

    Resets the onboarding tour state so E2E tests can exercise the full
    first-run experience regardless of prior test runs.

    When pr_number is supplied in the request body, targets the namespaced
    e2e_beginner+pr<N>@test.com user instead of the default (RGATE-05).

    Returns:
        SeedResultResponse with operation details

    Raises:
        404: If the resolved beginner email is not found in the database
        404: If UserSettings row is missing for the beginner user
    """
    start_time = perf_counter()

    email = namespaced_beginner_email(body.pr_number if body else None)

    user = await UserRepository(db).get_by_email(email)
    if user is None:
        raise HTTPException(status_code=404, detail=f"E2E beginner user not found: {email}")

    user_settings = await UserSettingsRepository(db).get_by_user_id(user.id)
    if user_settings is None:
        raise HTTPException(status_code=404, detail="E2E beginner user settings not found")

    user_settings.tour_completed_at = None
    await db.commit()

    duration_ms = (perf_counter() - start_time) * 1000

    logger.info(
        "reset-onboarding seed completed",
        extra={
            "event": "seed.reset_onboarding.success",
            "user_id": str(user.id),
        },
    )

    return SeedResultResponse(
        success=True,
        operation="reset-onboarding",
        timestamp=datetime.now(timezone.utc),
        duration_ms=duration_ms,
        results={"tour_completed_at": None},
    )
