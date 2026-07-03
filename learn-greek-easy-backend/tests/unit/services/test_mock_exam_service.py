"""Unit tests for MockExamService.

This module tests:
- create_mock_exam: Creates exam with 25 questions
- submit_all_answers: Processes all answers atomically with SM-2 and XP integration
- get_statistics: Returns aggregated stats with recent exams
- get_active_exam: Returns active session info
- abandon_exam: Abandons session successfully

Tests use real database fixtures and mock S3Service where needed.
"""

from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import MockExamNotFoundException, MockExamSessionExpiredException
from src.db.models import CultureDeck, CultureQuestion, MockExamSession, MockExamStatus, User
from src.services.mock_exam_service import MockExamService
from src.services.s3_service import IMAGE_PRESIGN_EXPIRY_SECONDS

# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
async def culture_deck(db_session: AsyncSession) -> CultureDeck:
    """Create an active culture deck for testing."""
    deck = CultureDeck(
        name_en="Greek History",
        name_el="Greek History",
        name_ru="Greek History",
        description_en="Learn about Greek history",
        description_el="Learn about Greek history",
        description_ru="Learn about Greek history",
        category="history",
        is_active=True,
    )
    db_session.add(deck)
    await db_session.flush()
    await db_session.refresh(deck)
    return deck


@pytest.fixture
async def culture_questions(
    db_session: AsyncSession, culture_deck: CultureDeck
) -> list[CultureQuestion]:
    """Create 30 culture questions (more than needed for mock exam)."""
    questions = []
    for i in range(30):
        question = CultureQuestion(
            deck_id=culture_deck.id,
            question_text={
                "en": f"Question {i + 1}?",
                "el": f"Ερώτηση {i + 1};",
            },
            option_a={"en": "Option A", "el": "Επιλογή Α"},
            option_b={"en": "Option B", "el": "Επιλογή Β"},
            option_c={"en": "Option C", "el": "Επιλογή Γ"},
            option_d={"en": "Option D", "el": "Επιλογή Δ"},
            correct_option=(i % 4) + 1,
            order_index=i,
        )
        db_session.add(question)
        questions.append(question)

    await db_session.flush()
    for q in questions:
        await db_session.refresh(q)
    return questions


@pytest.fixture
async def active_mock_exam(db_session: AsyncSession, test_user: User) -> MockExamSession:
    """Create an active mock exam session."""
    session = MockExamSession(
        user_id=test_user.id,
        total_questions=25,
        status=MockExamStatus.ACTIVE,
        score=0,
        passed=False,
        time_taken_seconds=0,
    )
    db_session.add(session)
    await db_session.flush()
    await db_session.refresh(session)
    return session


@pytest.fixture
async def completed_mock_exam(db_session: AsyncSession, test_user: User) -> MockExamSession:
    """Create a completed mock exam session."""
    session = MockExamSession(
        user_id=test_user.id,
        total_questions=25,
        status=MockExamStatus.COMPLETED,
        score=22,
        passed=True,
        time_taken_seconds=900,
        completed_at=datetime.utcnow(),
    )
    db_session.add(session)
    await db_session.flush()
    await db_session.refresh(session)
    return session


@pytest.fixture
async def multiple_completed_exams(
    db_session: AsyncSession, test_user: User
) -> list[MockExamSession]:
    """Create multiple completed exam sessions with varying scores."""
    sessions = []
    for i in range(5):
        score = 15 + i * 2  # 15, 17, 19, 21, 23
        passed = score >= 16  # 60% threshold
        session = MockExamSession(
            user_id=test_user.id,
            total_questions=25,
            status=MockExamStatus.COMPLETED,
            score=score,
            passed=passed,
            time_taken_seconds=600 + (i * 60),
            completed_at=datetime.utcnow() - timedelta(days=i),
        )
        db_session.add(session)
        sessions.append(session)

    await db_session.flush()
    for s in sessions:
        await db_session.refresh(s)
    return sessions


@pytest.fixture
def mock_s3_service():
    """Create a mock S3 service."""
    mock = MagicMock()
    mock.generate_presigned_url.return_value = "https://s3.example.com/presigned-url"
    return mock


@pytest.fixture
def batched_s3_service():
    """S3 service mock with a real-dict-returning `generate_presigned_urls` (PERF-21-03).

    `mock_s3_service` above is unusable for the batch-wiring tests below: its
    `generate_presigned_urls` is auto-mocked, so it returns a bare `MagicMock`
    instead of a `dict` -- `url_map.get(key)` on that would yield a `MagicMock`,
    not `None`/a URL string, silently corrupting `_build_question_data`'s output
    instead of failing loudly (Round-2 debate Finding 7, mirrored from
    PERF-21-02's identical fixture in test_culture_question_service.py). This
    fixture's batch method dedupes by key exactly like the real
    `S3Service.generate_presigned_urls` and returns a genuine `dict`, matching
    production shape.
    """
    mock = MagicMock()

    def _fake_batch(keys_with_expiry):
        result: dict[str, str | None] = {}
        for key, expiry in keys_with_expiry:
            if not key or key in result:
                continue
            result[key] = f"https://s3.example.com/presigned/{key}?exp={expiry}"
        return result

    mock.generate_presigned_urls.side_effect = _fake_batch
    mock.generate_presigned_url.return_value = "https://s3.example.com/presigned-url"
    return mock


@pytest.fixture
async def culture_questions_shared_image(
    db_session: AsyncSession, culture_deck: CultureDeck
) -> list[CultureQuestion]:
    """Create exactly 25 culture questions for mock-exam batching tests (PERF-21-03).

    Questions 0-9 share `image_key="examImgShared"` (dedupe target); questions
    10-19 each have a unique `image_key`; questions 20-24 have no image
    (`image_key=None`, trap4 coverage). Exactly 25 so `create_mock_exam`'s
    `get_random_questions(count=25)` query (`ORDER BY random() LIMIT 25` over
    exactly 25 rows) deterministically returns the full set -- order varies
    with the PRNG, membership doesn't -- keeping the signing-count assertions
    below independent of random sampling.
    """
    questions = []
    for i in range(25):
        if i < 10:
            image_key = "examImgShared"
        elif i < 20:
            image_key = f"examImgUniq{i}"
        else:
            image_key = None
        question = CultureQuestion(
            deck_id=culture_deck.id,
            question_text={
                "en": f"Question {i + 1}?",
                "el": f"Ερώτηση {i + 1};",
            },
            option_a={"en": "Option A", "el": "Επιλογή Α"},
            option_b={"en": "Option B", "el": "Επιλογή Β"},
            option_c={"en": "Option C", "el": "Επιλογή Γ"},
            option_d={"en": "Option D", "el": "Επιλογή Δ"},
            correct_option=(i % 4) + 1,
            order_index=i,
            image_key=image_key,
        )
        db_session.add(question)
        questions.append(question)

    await db_session.flush()
    for q in questions:
        await db_session.refresh(q)
    return questions


# =============================================================================
# Test create_mock_exam
# =============================================================================


class TestCreateMockExam:
    """Tests for create_mock_exam method."""

    @pytest.mark.asyncio
    async def test_create_mock_exam_success(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Should create exam with 25 questions."""
        service = MockExamService(db_session, s3_service=mock_s3_service)

        result = await service.create_mock_exam(test_user.id)

        assert result["session"] is not None
        assert result["session"].user_id == test_user.id
        assert result["session"].status == MockExamStatus.ACTIVE
        assert result["session"].total_questions == 25
        assert result["is_resumed"] is False
        assert len(result["questions"]) == 25

    @pytest.mark.asyncio
    async def test_create_mock_exam_prevents_duplicate_active(
        self,
        db_session: AsyncSession,
        test_user: User,
        active_mock_exam: MockExamSession,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Should return existing session if user has an active exam."""
        service = MockExamService(db_session, s3_service=mock_s3_service)

        result = await service.create_mock_exam(test_user.id)

        assert result["session"].id == active_mock_exam.id
        assert result["is_resumed"] is True

    @pytest.mark.asyncio
    async def test_create_mock_exam_no_questions(
        self,
        db_session: AsyncSession,
        test_user: User,
        mock_s3_service,
    ):
        """Should raise ValueError when no questions available."""
        service = MockExamService(db_session, s3_service=mock_s3_service)

        with pytest.raises(ValueError, match="No questions available"):
            await service.create_mock_exam(test_user.id)


# =============================================================================
# Test get_statistics
# =============================================================================


class TestGetStatistics:
    """Tests for get_statistics method."""

    @pytest.mark.asyncio
    async def test_get_statistics(
        self,
        db_session: AsyncSession,
        test_user: User,
        multiple_completed_exams: list[MockExamSession],
        mock_s3_service,
    ):
        """Should return aggregated stats with recent exams."""
        service = MockExamService(db_session, s3_service=mock_s3_service)

        result = await service.get_statistics(test_user.id)

        assert "stats" in result
        assert "recent_exams" in result

        stats = result["stats"]
        assert stats["total_exams"] == 5
        # Scores: 15, 17, 19, 21, 23 - all except 15 pass (60% = 16/25)
        assert stats["passed_exams"] == 4
        assert stats["pass_rate"] == 80.0

        # Recent exams should be ordered by completion date
        recent = result["recent_exams"]
        assert len(recent) == 5

    @pytest.mark.asyncio
    async def test_get_statistics_empty(
        self,
        db_session: AsyncSession,
        test_user: User,
        mock_s3_service,
    ):
        """Should return zeros for new user."""
        service = MockExamService(db_session, s3_service=mock_s3_service)

        result = await service.get_statistics(test_user.id)

        assert result["stats"]["total_exams"] == 0
        assert result["stats"]["passed_exams"] == 0
        assert result["recent_exams"] == []


# =============================================================================
# Test get_active_exam
# =============================================================================


class TestGetActiveExam:
    """Tests for get_active_exam method."""

    @pytest.mark.asyncio
    async def test_get_active_exam(
        self,
        db_session: AsyncSession,
        test_user: User,
        active_mock_exam: MockExamSession,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Should return active session info."""
        service = MockExamService(db_session, s3_service=mock_s3_service)

        result = await service.get_active_exam(test_user.id)

        assert result is not None
        assert result["session"].id == active_mock_exam.id
        assert "questions" in result
        assert "answers_count" in result

    @pytest.mark.asyncio
    async def test_get_active_exam_none(
        self,
        db_session: AsyncSession,
        test_user: User,
        mock_s3_service,
    ):
        """Should return None when no active exam."""
        service = MockExamService(db_session, s3_service=mock_s3_service)

        result = await service.get_active_exam(test_user.id)

        assert result is None


# =============================================================================
# Test abandon_exam
# =============================================================================


class TestAbandonExam:
    """Tests for abandon_exam method."""

    @pytest.mark.asyncio
    async def test_abandon_exam(
        self,
        db_session: AsyncSession,
        test_user: User,
        active_mock_exam: MockExamSession,
        mock_s3_service,
    ):
        """Should abandon session successfully."""
        service = MockExamService(db_session, s3_service=mock_s3_service)

        result = await service.abandon_exam(
            user_id=test_user.id,
            session_id=active_mock_exam.id,
        )

        assert result is not None
        assert result.status == MockExamStatus.ABANDONED
        assert result.completed_at is not None

    @pytest.mark.asyncio
    async def test_abandon_exam_invalid_session(
        self,
        db_session: AsyncSession,
        test_user: User,
        mock_s3_service,
    ):
        """Should raise MockExamNotFoundException for invalid session."""
        service = MockExamService(db_session, s3_service=mock_s3_service)

        with pytest.raises(MockExamNotFoundException):
            await service.abandon_exam(
                user_id=test_user.id,
                session_id=uuid4(),
            )

    @pytest.mark.asyncio
    async def test_abandon_exam_already_completed(
        self,
        db_session: AsyncSession,
        test_user: User,
        completed_mock_exam: MockExamSession,
        mock_s3_service,
    ):
        """Should raise MockExamSessionExpiredException for completed session."""
        service = MockExamService(db_session, s3_service=mock_s3_service)

        with pytest.raises(MockExamSessionExpiredException):
            await service.abandon_exam(
                user_id=test_user.id,
                session_id=completed_mock_exam.id,
            )


# =============================================================================
# Test submit_all_answers
# =============================================================================


class TestSubmitAllAnswers:
    """Tests for submit_all_answers method."""

    @pytest.mark.asyncio
    async def test_submit_all_success_pass(
        self,
        db_session: AsyncSession,
        test_user: User,
        active_mock_exam: MockExamSession,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Should process all answers and pass exam with 64% score."""
        service = MockExamService(db_session, s3_service=mock_s3_service)

        # Build answers: 16 correct, 9 wrong (64% = pass)
        answers = []
        for i, question in enumerate(culture_questions[:25]):
            if i < 16:
                # Correct answer
                answers.append(
                    {
                        "question_id": question.id,
                        "selected_option": question.correct_option,
                        "time_taken_seconds": 10,
                    }
                )
            else:
                # Wrong answer
                wrong_option = (question.correct_option % 4) + 1
                answers.append(
                    {
                        "question_id": question.id,
                        "selected_option": wrong_option,
                        "time_taken_seconds": 10,
                    }
                )

        result = await service.submit_all_answers(
            user_id=test_user.id,
            session_id=active_mock_exam.id,
            answers=answers,
            total_time_seconds=1200,
        )

        assert result["passed"] is True
        assert result["score"] == 16
        assert result["total_questions"] == 25
        assert result["percentage"] == 64.0
        assert result["pass_threshold"] == 60
        assert len(result["answer_results"]) == 25
        assert result["new_answers_count"] == 25
        assert result["duplicate_answers_count"] == 0
        assert result["total_xp_earned"] > 0
        assert result["session"].status == MockExamStatus.COMPLETED

    @pytest.mark.asyncio
    async def test_submit_all_success_fail(
        self,
        db_session: AsyncSession,
        test_user: User,
        active_mock_exam: MockExamSession,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Should process all answers and fail exam with 40% score."""
        service = MockExamService(db_session, s3_service=mock_s3_service)

        # Build answers: 10 correct, 15 wrong (40% = fail)
        answers = []
        for i, question in enumerate(culture_questions[:25]):
            if i < 10:
                # Correct answer
                answers.append(
                    {
                        "question_id": question.id,
                        "selected_option": question.correct_option,
                        "time_taken_seconds": 10,
                    }
                )
            else:
                # Wrong answer
                wrong_option = (question.correct_option % 4) + 1
                answers.append(
                    {
                        "question_id": question.id,
                        "selected_option": wrong_option,
                        "time_taken_seconds": 10,
                    }
                )

        result = await service.submit_all_answers(
            user_id=test_user.id,
            session_id=active_mock_exam.id,
            answers=answers,
            total_time_seconds=1200,
        )

        assert result["passed"] is False
        assert result["score"] == 10
        assert result["percentage"] == 40.0

    @pytest.mark.asyncio
    async def test_submit_all_handles_all_duplicates(
        self,
        db_session: AsyncSession,
        test_user: User,
        active_mock_exam: MockExamSession,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Should handle the case where all answers are duplicates gracefully."""
        service = MockExamService(db_session, s3_service=mock_s3_service)

        # Build all answers (all correct)
        answers = []
        for question in culture_questions[:25]:
            answers.append(
                {
                    "question_id": question.id,
                    "selected_option": question.correct_option,
                    "time_taken_seconds": 10,
                }
            )

        # First submission should process all 25 answers
        result = await service.submit_all_answers(
            user_id=test_user.id,
            session_id=active_mock_exam.id,
            answers=answers,
            total_time_seconds=1200,
        )

        # Verify first submission processed all answers
        assert result["new_answers_count"] == 25
        assert result["duplicate_answers_count"] == 0
        assert result["score"] == 25  # All correct

        # Verify no duplicates in results
        duplicate_results = [ar for ar in result["answer_results"] if ar["was_duplicate"]]
        assert len(duplicate_results) == 0

    @pytest.mark.asyncio
    async def test_submit_all_invalid_session(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Should raise MockExamNotFoundException for invalid session."""
        service = MockExamService(db_session, s3_service=mock_s3_service)

        answers = [
            {
                "question_id": culture_questions[0].id,
                "selected_option": 1,
                "time_taken_seconds": 10,
            }
        ]

        with pytest.raises(MockExamNotFoundException):
            await service.submit_all_answers(
                user_id=test_user.id,
                session_id=uuid4(),
                answers=answers,
                total_time_seconds=1200,
            )

    @pytest.mark.asyncio
    async def test_submit_all_expired_session(
        self,
        db_session: AsyncSession,
        test_user: User,
        completed_mock_exam: MockExamSession,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Should raise MockExamSessionExpiredException for completed session."""
        service = MockExamService(db_session, s3_service=mock_s3_service)

        answers = [
            {
                "question_id": culture_questions[0].id,
                "selected_option": 1,
                "time_taken_seconds": 10,
            }
        ]

        with pytest.raises(MockExamSessionExpiredException):
            await service.submit_all_answers(
                user_id=test_user.id,
                session_id=completed_mock_exam.id,
                answers=answers,
                total_time_seconds=1200,
            )

    @pytest.mark.asyncio
    async def test_submit_all_perfect_recall_xp_bonus(
        self,
        db_session: AsyncSession,
        test_user: User,
        active_mock_exam: MockExamSession,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """Should award bonus XP for answers in < 2 seconds."""
        service = MockExamService(db_session, s3_service=mock_s3_service)

        # Submit 2 answers: 1 fast (perfect recall), 1 normal speed
        answers = [
            {
                "question_id": culture_questions[0].id,
                "selected_option": culture_questions[0].correct_option,
                "time_taken_seconds": 1,  # Perfect recall (< 2 seconds)
            },
            {
                "question_id": culture_questions[1].id,
                "selected_option": culture_questions[1].correct_option,
                "time_taken_seconds": 10,  # Normal speed
            },
        ]

        result = await service.submit_all_answers(
            user_id=test_user.id,
            session_id=active_mock_exam.id,
            answers=answers,
            total_time_seconds=11,
        )

        # Verify XP was awarded
        answer_results = result["answer_results"]
        assert len(answer_results) == 2

        # Perfect recall answer should have bonus XP (15 instead of 10)
        perfect_result = answer_results[0]
        normal_result = answer_results[1]

        assert perfect_result["xp_earned"] == 15  # Bonus XP for perfect recall
        assert normal_result["xp_earned"] == 10  # Normal XP


# =============================================================================
# PERF-21-03: Dedupe + off-loop the mock-exam presign paths (Test-Spec)
# =============================================================================


class TestMockExamBatchPresigning:
    """PERF-21-03 Test Specs (Mode A / RED): batch-sign + off-loop the
    mock-exam presign paths (`create_mock_exam` / `_build_question_data`).

    RED (Test-Spec / RALPH Mode A): `create_mock_exam` still signs one image
    URL per question inline via `_build_question_data(question)` (no
    `url_map` param yet, no `asyncio.to_thread` dispatch). These tests are
    authored from the PERF-21-03 acceptance criteria BEFORE the batching
    implementation and are expected to fail until: (a) `create_mock_exam`
    collects `(image_key, IMAGE_PRESIGN_EXPIRY_SECONDS)` pairs across all 25
    questions, dispatches `S3Service.generate_presigned_urls` via
    `asyncio.to_thread`, and (b) `_build_question_data` gains a `url_map`
    parameter and stops calling `generate_presigned_url` itself.

    DB note: `create_mock_exam` (the AC1/AC2 tests below) requires the real
    Postgres test DB, per this file's existing convention -- locally this
    errors with "Cannot connect to test database" regardless of RED/GREEN
    status (documented no-local-DB-verification convention); those two are
    RED-by-construction here and will run for real in CI. The two
    `_build_question_data`-level tests (AC3, trap4) deliberately construct a
    `CultureQuestion` object WITHOUT a session/flush so they run -- and their
    RED is confirmed -- with zero DB dependency, locally and in CI alike.
    """

    @pytest.mark.asyncio
    async def test_create_mock_exam_batches_signing(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_questions_shared_image: list[CultureQuestion],
        batched_s3_service,
    ):
        """AC1/AC4: 10 of the 25 questions share `image_key="examImgShared"`
        -> `_build_question_data` makes NOTHING per-item
        (`generate_presigned_url.call_count == 0`) and the batch method
        `generate_presigned_urls` is called exactly once, covering the
        deduped-by-object-key set of `(key, expiry)` pairs collected across
        the whole 25-question exam (Finding 7 -- assert on the singular
        method's call count, not a boto count masked by the per-instance
        `_url_cache`).
        """
        service = MockExamService(db_session, s3_service=batched_s3_service)

        with patch.object(batched_s3_service, "generate_presigned_url") as spy_single:
            result = await service.create_mock_exam(test_user.id)

        assert len(result["questions"]) == 25
        assert spy_single.call_count == 0, (
            "_build_question_data must no longer call the singular "
            f"generate_presigned_url per item; got {spy_single.call_count} calls"
        )
        assert batched_s3_service.generate_presigned_urls.call_count == 1, (
            "Batch signing must run exactly once per create_mock_exam call, "
            f"not once per question (got "
            f"{batched_s3_service.generate_presigned_urls.call_count})"
        )
        called_pairs = batched_s3_service.generate_presigned_urls.call_args[0][0]
        called_keys = {key for key, _expiry in called_pairs}
        expected_keys = {"examImgShared"} | {f"examImgUniq{i}" for i in range(10, 20)}
        assert called_keys == expected_keys, (
            "Expected the 11 unique image keys (1 shared + 10 distinct) across "
            f"the 25 questions, got {called_keys}"
        )
        image_expiries = {expiry for _key, expiry in called_pairs}
        assert image_expiries == {
            IMAGE_PRESIGN_EXPIRY_SECONDS
        }, "image_key pairs must carry IMAGE_PRESIGN_EXPIRY_SECONDS as their expiry"

    @pytest.mark.asyncio
    async def test_mock_exam_signs_off_event_loop(
        self,
        db_session: AsyncSession,
        test_user: User,
        culture_questions_shared_image: list[CultureQuestion],
        batched_s3_service,
    ):
        """AC2: batch signing is dispatched via `asyncio.to_thread`, not run
        inline on the event loop.

        Patch target: `"asyncio.to_thread"` (global), matching the codebase's
        established off-loop convention and the PERF-21-01/-02 precedent
        (`import asyncio` + call `asyncio.to_thread(...)` as a module
        attribute -- see `culture_question_service.py`,
        `situation_picture_service.py:172,182`, `news_item_service.py:475`).
        `mock_exam_service.py` does NOT `import asyncio` yet (grep-confirmed
        pre-implementation), so once PERF-21-03 adds it, the call site becomes
        `asyncio.to_thread(...)` and this global patch target is correct.

        The side_effect executes the wrapped callable synchronously and
        returns its real return value (a `dict`), so `_build_question_data`
        downstream receives a genuine `url_map` instead of a bare `Mock`
        (Finding 8).
        """
        service = MockExamService(db_session, s3_service=batched_s3_service)

        with patch(
            "asyncio.to_thread",
            new=AsyncMock(side_effect=lambda func, *a, **kw: func(*a, **kw)),
        ) as mock_to_thread:
            result = await service.create_mock_exam(test_user.id)

        assert len(result["questions"]) == 25
        assert (
            mock_to_thread.await_count >= 1
        ), "create_mock_exam must dispatch batch signing via asyncio.to_thread"
        dispatched_targets = [call.args[0] for call in mock_to_thread.await_args_list]
        assert batched_s3_service.generate_presigned_urls in dispatched_targets, (
            "asyncio.to_thread must be invoked with s3_service.generate_presigned_urls "
            f"as the dispatched function; got {dispatched_targets}"
        )
        dispatch_call = next(
            call
            for call in mock_to_thread.await_args_list
            if call.args[0] is batched_s3_service.generate_presigned_urls
        )
        dispatched_pairs = dispatch_call.args[1]
        dispatched_keys = {key for key, _expiry in dispatched_pairs}
        expected_keys = {"examImgShared"} | {f"examImgUniq{i}" for i in range(10, 20)}
        assert dispatched_keys == expected_keys

    def test_mock_exam_image_url_unchanged(self, batched_s3_service):
        """AC3: `image_url` on the built question dict is byte-identical to
        what the batched map yields for that exact key/expiry.

        Deliberately DB-free: once PERF-21-03 lands, `_build_question_data`
        must become a pure sync builder over its `question`/`url_map`
        arguments and never touch `self.db` (mirroring `_build_queue_item`
        from PERF-21-02) -- so this constructs an unpersisted `CultureQuestion`
        directly (no session, no flush) instead of going through a DB-backed
        fixture. This test runs with zero Postgres dependency, locally and in
        CI alike.

        Calling with 2 positional args (`question, url_map`) against today's
        1-arg `_build_question_data(self, question)` signature IS the
        expected RED here: a `TypeError` for the unexpected extra positional
        argument, not an import/collection error -- confirming the `url_map`
        parameter genuinely doesn't exist yet.
        """
        service = MockExamService(db=MagicMock(), s3_service=batched_s3_service)
        question = CultureQuestion(
            id=uuid4(),
            deck_id=None,
            question_text={"en": "Q?", "el": "Ε;"},
            option_a={"en": "A", "el": "Α"},
            option_b={"en": "B", "el": "Β"},
            correct_option=1,
            order_index=0,
            image_key="imgX",
        )
        url_map = batched_s3_service.generate_presigned_urls(
            [("imgX", IMAGE_PRESIGN_EXPIRY_SECONDS)]
        )

        result = service._build_question_data(question, url_map)

        assert result["image_url"] == url_map["imgX"]
        assert result["image_url"] is not None

    def test_mock_exam_no_image_is_none(self, batched_s3_service):
        """trap4: a question with `image_key=None` yields `image_url=None`,
        with no exception -- degraded handling is unchanged by the batching
        refactor. Same DB-free construction as
        `test_mock_exam_image_url_unchanged` (see its docstring); same
        expected `TypeError` RED for the not-yet-existing `url_map` param.
        """
        service = MockExamService(db=MagicMock(), s3_service=batched_s3_service)
        question = CultureQuestion(
            id=uuid4(),
            deck_id=None,
            question_text={"en": "Q?", "el": "Ε;"},
            option_a={"en": "A", "el": "Α"},
            option_b={"en": "B", "el": "Β"},
            correct_option=1,
            order_index=0,
            image_key=None,
        )

        result = service._build_question_data(question, url_map={})

        assert result["image_url"] is None
