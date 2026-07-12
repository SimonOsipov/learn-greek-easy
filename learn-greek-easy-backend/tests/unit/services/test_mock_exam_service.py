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
from types import SimpleNamespace
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

    @pytest.mark.asyncio
    async def test_submit_all_handles_missing_question(
        self,
        db_session: AsyncSession,
        test_user: User,
        active_mock_exam: MockExamSession,
        culture_questions: list[CultureQuestion],
        mock_s3_service,
    ):
        """PERF-18-04 AC2 — an answer whose question_id is absent from the DB
        is silently skipped; a sibling valid answer is still processed.

        Parity lock: holds today via `_get_question` returning None
        (mock_exam_service.py:535-546, `scalar_one_or_none()`) hitting the
        `if question is None: continue` branch (mock_exam_service.py:280-289);
        must continue to hold after PERF-18-04 batches the read via
        `questions_by_id.get(question_id)`, which returns None for a key
        absent from the dict for the identical reason (dict.get default).
        """
        service = MockExamService(db_session, s3_service=mock_s3_service)

        missing_question_id = uuid4()
        valid_question = culture_questions[0]

        answers = [
            {
                "question_id": missing_question_id,
                "selected_option": 1,
                "time_taken_seconds": 10,
            },
            {
                "question_id": valid_question.id,
                "selected_option": valid_question.correct_option,
                "time_taken_seconds": 10,
            },
        ]

        result = await service.submit_all_answers(
            user_id=test_user.id,
            session_id=active_mock_exam.id,
            answers=answers,
            total_time_seconds=20,
        )

        # The missing question produced no crash and no answer_results entry.
        assert len(result["answer_results"]) == 1
        assert result["answer_results"][0]["question_id"] == valid_question.id
        assert result["answer_results"][0]["is_correct"] is True

        # Only the valid answer counted as "new"; the missing one is neither
        # a duplicate nor a processed answer.
        assert result["new_answers_count"] == 1
        assert result["duplicate_answers_count"] == 0
        assert result["score"] == 1


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


# =============================================================================
# PERF-21-03: QA Verify (Mode B) adversarial/edge coverage
# =============================================================================


class TestMockExamBatchPresigningEdgeCases:
    """QA Verify (Mode B) adversarial/edge coverage for PERF-21-03, added on
    top of the 4 architect-authored AC/trap tests in `TestMockExamBatchPresigning`
    above.

    All DB-free by construction (unpersisted `CultureQuestion`, no session/
    flush; `_batch_sign_image_urls` itself never touches `self.db`), matching
    `test_mock_exam_image_url_unchanged` / `test_mock_exam_no_image_is_none` --
    these run with zero Postgres dependency locally and in CI alike.
    """

    def test_build_question_data_distributes_correct_url_from_shared_map(self, batched_s3_service):
        """Distribution correctness: given a url_map covering several keys (as
        it would across a whole 25-question exam), this item's image_url pulls
        exactly its own key's URL -- not another key's, not a stale/None value
        for a key that is genuinely present and signed.
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
            image_key="imgB",
        )
        url_map = batched_s3_service.generate_presigned_urls(
            [
                ("imgA", IMAGE_PRESIGN_EXPIRY_SECONDS),
                ("imgB", IMAGE_PRESIGN_EXPIRY_SECONDS),
                ("imgC", IMAGE_PRESIGN_EXPIRY_SECONDS),
            ]
        )

        result = service._build_question_data(question, url_map)

        assert result["image_url"] == url_map["imgB"]
        assert result["image_url"] != url_map["imgA"]
        assert result["image_url"] != url_map["imgC"]

    def test_build_question_data_key_missing_from_url_map_resolves_to_none(
        self, batched_s3_service
    ):
        """Defensive coverage: the question references a real key, but the
        supplied `url_map` doesn't include it (e.g. it was signed for a
        different, narrower collection pass -- one of the other two
        `_get_session_questions` branches). `.get()` must degrade to None
        rather than raise KeyError.
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
            image_key="imgNotInMap",
        )

        # url_map deliberately omits the key the question references.
        result = service._build_question_data(question, url_map={"otherKey": "https://x/other"})

        assert result["image_url"] is None

    def test_build_question_data_no_image_key_ignores_populated_map(self, batched_s3_service):
        """A question with `image_key=None` must resolve to `image_url=None`
        even when the supplied `url_map` is non-empty and contains other
        questions' keys -- proving the guard is `if question.image_key` (never
        falls through to `url_map.get(None)` accidentally matching a sentinel
        entry some other caller stashed under a falsy key).
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
        url_map = batched_s3_service.generate_presigned_urls(
            [("someOtherQuestionsImage", IMAGE_PRESIGN_EXPIRY_SECONDS)]
        )

        result = service._build_question_data(question, url_map)

        assert result["image_url"] is None

    @pytest.mark.asyncio
    async def test_batch_sign_image_urls_empty_question_list_returns_empty_dict(
        self, batched_s3_service
    ):
        """`_batch_sign_image_urls([])` (e.g. an all-answered session with zero
        questions, or a deck with no rows) must return `{}` without error --
        the batch method still gets exactly one dispatch, just with an empty
        pairs list, rather than being skipped/short-circuited in a way that
        could raise downstream.
        """
        service = MockExamService(db=MagicMock(), s3_service=batched_s3_service)

        url_map = await service._batch_sign_image_urls([])

        assert url_map == {}
        assert batched_s3_service.generate_presigned_urls.call_count == 1

    @pytest.mark.asyncio
    async def test_batch_sign_image_urls_all_questions_missing_image_key(self, batched_s3_service):
        """A non-empty question list where every question has `image_key=None`
        must still batch-sign cleanly to `{}` -- the truthy-filter comprehension
        in `_batch_sign_image_urls` excludes every question, so the dispatched
        pairs list is empty, not a crash from `None` being passed as a key.
        """
        service = MockExamService(db=MagicMock(), s3_service=batched_s3_service)
        questions = [
            CultureQuestion(
                id=uuid4(),
                deck_id=None,
                question_text={"en": f"Q{i}?", "el": f"Ε{i};"},
                option_a={"en": "A", "el": "Α"},
                option_b={"en": "B", "el": "Β"},
                correct_option=1,
                order_index=i,
                image_key=None,
            )
            for i in range(3)
        ]

        url_map = await service._batch_sign_image_urls(questions)

        assert url_map == {}
        assert batched_s3_service.generate_presigned_urls.call_count == 1


# =============================================================================
# WEDGE-04-01: Per-topic breakdown on submit-all (Test-Spec / RALPH Mode A)
# =============================================================================


@pytest.fixture
async def topic_tagged_questions(
    db_session: AsyncSession, culture_deck: CultureDeck
) -> dict[str, list[CultureQuestion]]:
    """6 questions tagged history(3)/geography(1)/politics(2) -- no
    culture/practical questions exist in this deck at all, so the
    topic_breakdown tests below verify those 2 empty buckets are emitted from
    the CultureTopic enum itself, never from a seeded question row.
    """
    specs = ["history", "history", "history", "geography", "politics", "politics"]
    by_topic: dict[str, list[CultureQuestion]] = {}
    for i, topic in enumerate(specs):
        question = CultureQuestion(
            deck_id=culture_deck.id,
            question_text={"en": f"Topic Q{i}?", "el": f"Θέμα Ε{i};"},
            option_a={"en": "A", "el": "Α"},
            option_b={"en": "B", "el": "Β"},
            option_c={"en": "C", "el": "Γ"},
            option_d={"en": "D", "el": "Δ"},
            correct_option=1,
            order_index=i,
            topic=topic,
        )
        db_session.add(question)
        by_topic.setdefault(topic, []).append(question)

    await db_session.flush()
    for questions in by_topic.values():
        for q in questions:
            await db_session.refresh(q)
    return by_topic


@pytest.fixture
async def null_topic_question(
    db_session: AsyncSession, culture_deck: CultureDeck
) -> CultureQuestion:
    """A question with topic=None (untagged, e.g. pre-WEDGE-02 backfill)."""
    question = CultureQuestion(
        deck_id=culture_deck.id,
        question_text={"en": "Untagged?", "el": "Χωρίς θέμα;"},
        option_a={"en": "A", "el": "Α"},
        option_b={"en": "B", "el": "Β"},
        correct_option=1,
        order_index=99,
        topic=None,
    )
    db_session.add(question)
    await db_session.flush()
    await db_session.refresh(question)
    return question


class TestSubmitAllTopicBreakdown:
    """WEDGE-04-01: `submit_all_answers` returns a `topic_breakdown` key
    computed in Python from the already-loaded `all_answers` list
    (mock_exam_service.py:348), grouped by `answer.question.topic`.
    """

    @pytest.mark.asyncio
    async def test_topic_breakdown_matches_hand_computed(
        self,
        db_session: AsyncSession,
        test_user: User,
        active_mock_exam: MockExamSession,
        topic_tagged_questions: dict[str, list[CultureQuestion]],
        mock_s3_service,
    ):
        """AC-2: topic_breakdown matches a hand-computed table --
        history[correct,correct,wrong], geography[correct],
        politics[wrong,wrong], culture/practical untouched (0 asked)."""
        service = MockExamService(db_session, s3_service=mock_s3_service)

        correctness = {
            "history": [True, True, False],
            "geography": [True],
            "politics": [False, False],
        }
        answers = []
        for topic, questions in topic_tagged_questions.items():
            for question, is_correct in zip(questions, correctness[topic]):
                selected = (
                    question.correct_option if is_correct else (question.correct_option % 4) + 1
                )
                answers.append(
                    {
                        "question_id": question.id,
                        "selected_option": selected,
                        "time_taken_seconds": 10,
                    }
                )

        result = await service.submit_all_answers(
            user_id=test_user.id,
            session_id=active_mock_exam.id,
            answers=answers,
            total_time_seconds=60,
        )

        breakdown = {item["topic"]: item for item in result["topic_breakdown"]}

        assert breakdown["history"] == {
            "topic": "history",
            "asked": 3,
            "correct": 2,
            "percentage": 66.7,
        }
        assert breakdown["geography"] == {
            "topic": "geography",
            "asked": 1,
            "correct": 1,
            "percentage": 100.0,
        }
        assert breakdown["politics"] == {
            "topic": "politics",
            "asked": 2,
            "correct": 0,
            "percentage": 0.0,
        }
        assert breakdown["culture"] == {
            "topic": "culture",
            "asked": 0,
            "correct": 0,
            "percentage": None,
        }
        assert breakdown["practical"] == {
            "topic": "practical",
            "asked": 0,
            "correct": 0,
            "percentage": None,
        }

    @pytest.mark.asyncio
    async def test_breakdown_always_five_topics_canonical_order(
        self,
        db_session: AsyncSession,
        test_user: User,
        active_mock_exam: MockExamSession,
        topic_tagged_questions: dict[str, list[CultureQuestion]],
        mock_s3_service,
    ):
        """AC-1: topic_breakdown always has exactly 5 items in canonical
        CultureTopic order, even when only one topic was actually answered."""
        service = MockExamService(db_session, s3_service=mock_s3_service)

        politics_questions = topic_tagged_questions["politics"]
        answers = [
            {
                "question_id": q.id,
                "selected_option": q.correct_option,
                "time_taken_seconds": 10,
            }
            for q in politics_questions
        ]

        result = await service.submit_all_answers(
            user_id=test_user.id,
            session_id=active_mock_exam.id,
            answers=answers,
            total_time_seconds=20,
        )

        breakdown = result["topic_breakdown"]
        assert len(breakdown) == 5
        assert [item["topic"] for item in breakdown] == [
            "history",
            "geography",
            "politics",
            "culture",
            "practical",
        ]

    @pytest.mark.asyncio
    async def test_zero_asked_topic_has_null_percentage(
        self,
        db_session: AsyncSession,
        test_user: User,
        active_mock_exam: MockExamSession,
        topic_tagged_questions: dict[str, list[CultureQuestion]],
        mock_s3_service,
    ):
        """AC-2: a topic with zero answered questions reports asked=0,
        correct=0, percentage=None -- never 0.0, which would misleadingly
        imply a 0% score for a topic that was never tested."""
        service = MockExamService(db_session, s3_service=mock_s3_service)

        history_questions = topic_tagged_questions["history"]
        answers = [
            {
                "question_id": q.id,
                "selected_option": q.correct_option,
                "time_taken_seconds": 10,
            }
            for q in history_questions
        ]

        result = await service.submit_all_answers(
            user_id=test_user.id,
            session_id=active_mock_exam.id,
            answers=answers,
            total_time_seconds=30,
        )

        breakdown = {item["topic"]: item for item in result["topic_breakdown"]}
        assert breakdown["culture"] == {
            "topic": "culture",
            "asked": 0,
            "correct": 0,
            "percentage": None,
        }

    @pytest.mark.asyncio
    async def test_null_topic_answer_excluded(
        self,
        db_session: AsyncSession,
        test_user: User,
        active_mock_exam: MockExamSession,
        topic_tagged_questions: dict[str, list[CultureQuestion]],
        null_topic_question: CultureQuestion,
        mock_s3_service,
    ):
        """AC-1: an answer whose question.topic is NULL is excluded from all
        5 buckets -- no 6th item -- and the buckets' combined asked total
        equals exactly the count of answers with a recognized topic."""
        service = MockExamService(db_session, s3_service=mock_s3_service)

        geography_questions = topic_tagged_questions["geography"]
        answers = [
            {
                "question_id": q.id,
                "selected_option": q.correct_option,
                "time_taken_seconds": 10,
            }
            for q in geography_questions
        ] + [
            {
                "question_id": null_topic_question.id,
                "selected_option": null_topic_question.correct_option,
                "time_taken_seconds": 10,
            }
        ]

        result = await service.submit_all_answers(
            user_id=test_user.id,
            session_id=active_mock_exam.id,
            answers=answers,
            total_time_seconds=20,
        )

        breakdown = result["topic_breakdown"]
        assert len(breakdown) == 5, "the NULL-topic answer must not add a 6th bucket"
        total_asked = sum(item["asked"] for item in breakdown)
        assert total_asked == 1, (
            "only the 1 geography answer has a recognized topic -- the "
            "NULL-topic answer must be excluded from every bucket's asked count"
        )


# =============================================================================
# WEDGE-04-01 QA (Mode B): adversarial/edge coverage for
# `MockExamService._compute_topic_breakdown` -- pure/DB-free, calling the
# static method directly with lightweight stand-ins (mirroring the
# SimpleNamespace stub pattern already used in test_news_item_service.py)
# instead of the full DB-backed submit_all_answers round-trip the Mode-A
# tests above use. Complements those tests; does not duplicate their
# assertions.
# =============================================================================


def _stub_answer(topic: str | None, is_correct: bool) -> SimpleNamespace:
    """Minimal stand-in for a MockExamAnswer ORM row: exposes only the two
    attributes `_compute_topic_breakdown` reads (`.question.topic`,
    `.is_correct`)."""
    return SimpleNamespace(question=SimpleNamespace(topic=topic), is_correct=is_correct)


class TestComputeTopicBreakdownPure:
    def test_empty_answers_yields_five_zero_buckets(self):
        """An attempt with zero answers at all (e.g. every submitted
        question_id was invalid/not-found and none pre-existed, so
        `get_session_answers` returns []) still yields exactly 5 items, each
        asked=0, correct=0, percentage=None -- never a 4-item or missing
        response."""
        breakdown = MockExamService._compute_topic_breakdown([])
        assert breakdown == [
            {"topic": "history", "asked": 0, "correct": 0, "percentage": None},
            {"topic": "geography", "asked": 0, "correct": 0, "percentage": None},
            {"topic": "politics", "asked": 0, "correct": 0, "percentage": None},
            {"topic": "culture", "asked": 0, "correct": 0, "percentage": None},
            {"topic": "practical", "asked": 0, "correct": 0, "percentage": None},
        ]

    def test_all_null_topic_answers_yields_five_zero_buckets(self):
        """Every answer's question.topic is None (pre-WEDGE-02 legacy,
        untagged data) -> excluded from all buckets; still exactly 5
        zero/None items, not 5 items with a phantom nonzero count."""
        answers = [_stub_answer(None, True), _stub_answer(None, False)]
        breakdown = MockExamService._compute_topic_breakdown(answers)
        assert len(breakdown) == 5
        assert all(item["asked"] == 0 and item["percentage"] is None for item in breakdown)

    def test_unrecognized_legacy_topic_string_excluded_not_crash(self):
        """A stray non-canonical topic string (e.g. a future/legacy value
        that isn't one of the 5 CultureTopic members) must be excluded by
        membership check, not crash with a KeyError, and must not create a
        6th bucket."""
        answers = [
            _stub_answer("misc", True),
            _stub_answer("history", True),
        ]
        breakdown = MockExamService._compute_topic_breakdown(answers)
        assert len(breakdown) == 5
        by_topic = {item["topic"]: item for item in breakdown}
        assert by_topic["history"] == {
            "topic": "history",
            "asked": 1,
            "correct": 1,
            "percentage": 100.0,
        }
        assert (
            sum(item["asked"] for item in breakdown) == 1
        ), "the 'misc' answer must not be tallied into any of the 5 buckets"

    def test_all_correct_topic_percentage_is_float_100_not_bool_or_int(self):
        answers = [_stub_answer("geography", True) for _ in range(4)]
        breakdown = MockExamService._compute_topic_breakdown(answers)
        geography = next(item for item in breakdown if item["topic"] == "geography")
        assert geography["percentage"] == 100.0
        assert isinstance(geography["percentage"], float)

    def test_all_wrong_topic_percentage_is_float_zero_not_none(self):
        """A topic that was asked but answered entirely wrong must report
        percentage=0.0 (a real, meaningful score) -- distinct from
        percentage=None, which means the topic was never asked at all."""
        answers = [_stub_answer("politics", False) for _ in range(3)]
        breakdown = MockExamService._compute_topic_breakdown(answers)
        politics = next(item for item in breakdown if item["topic"] == "politics")
        assert politics["percentage"] == 0.0
        assert politics["percentage"] is not None
        assert isinstance(politics["percentage"], float)

    @pytest.mark.parametrize(
        "correct,asked,expected_pct",
        [
            (1, 3, 33.3),
            (2, 3, 66.7),
            (1, 8, 12.5),
            (5, 6, 83.3),
            (1, 6, 16.7),
            # Exact round-half-to-even boundary: correct/asked*100 lands on
            # an exact X.X5 tie at the 2nd decimal. Verified (not assumed):
            # Python's `round()`, which the impl calls directly, resolves
            # ties to the nearest EVEN 1st-decimal digit ("banker's
            # rounding"), NOT round-half-up -- 6.25 -> 6.2 (even), and
            # 18.75 -> 18.8 (even), not 6.3 / 18.75->18.8-by-half-up-coincidence.
            (1, 16, 6.2),
            (3, 16, 18.8),
        ],
    )
    def test_rounding_matches_python_round_builtin(self, correct, asked, expected_pct):
        answers = [_stub_answer("culture", True) for _ in range(correct)] + [
            _stub_answer("culture", False) for _ in range(asked - correct)
        ]
        breakdown = MockExamService._compute_topic_breakdown(answers)
        culture = next(item for item in breakdown if item["topic"] == "culture")
        assert culture["asked"] == asked
        assert culture["correct"] == correct
        assert culture["percentage"] == expected_pct
