"""Unit tests for feedback schema validation.

Tests for FeedbackCreate, FeedbackUpdate, FeedbackResponse, FeedbackListResponse,
VoteRequest, VoteResponse, AdminFeedbackUpdate, AdminFeedbackResponse,
AdminFeedbackListResponse, and AuthorBriefResponse schemas.
Covers valid payloads, boundary constraints, invalid payloads that should
raise ValidationError, and enum membership.
"""

from datetime import datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from src.db.models import FeedbackCategory, FeedbackStatus, VoteType
from src.schemas.feedback import (
    AdminFeedbackListResponse,
    AdminFeedbackResponse,
    AdminFeedbackUpdate,
    AuthorBriefResponse,
    FeedbackCreate,
    FeedbackListResponse,
    FeedbackResponse,
    FeedbackUpdate,
    VoteRequest,
    VoteResponse,
)

# ============================================================================
# Enum membership tests
# ============================================================================


class TestFeedbackCategoryEnum:
    """Test FeedbackCategory enum membership."""

    def test_feature_request_member(self):
        """FeedbackCategory.FEATURE_REQUEST has the expected string value."""
        assert FeedbackCategory.FEATURE_REQUEST == "feature_request"

    def test_bug_incorrect_data_member(self):
        """FeedbackCategory.BUG_INCORRECT_DATA has the expected string value."""
        assert FeedbackCategory.BUG_INCORRECT_DATA == "bug_incorrect_data"

    def test_enum_has_exactly_two_members(self):
        """FeedbackCategory has exactly 2 members — no accidental additions."""
        assert len(list(FeedbackCategory)) == 2

    def test_invalid_category_value_rejected(self):
        """An unrecognised category string is rejected by Pydantic."""
        with pytest.raises(ValidationError):
            FeedbackCreate(
                title="Valid title here",
                description="A long enough description here",
                category="not_a_category",
            )


class TestFeedbackStatusEnum:
    """Test FeedbackStatus enum membership."""

    def test_all_statuses_present(self):
        """All 6 expected status values are present."""
        expected = {"new", "under_review", "planned", "in_progress", "completed", "cancelled"}
        actual = {s.value for s in FeedbackStatus}
        assert actual == expected

    def test_new_status(self):
        assert FeedbackStatus.NEW == "new"

    def test_under_review_status(self):
        assert FeedbackStatus.UNDER_REVIEW == "under_review"

    def test_planned_status(self):
        assert FeedbackStatus.PLANNED == "planned"

    def test_in_progress_status(self):
        assert FeedbackStatus.IN_PROGRESS == "in_progress"

    def test_completed_status(self):
        assert FeedbackStatus.COMPLETED == "completed"

    def test_cancelled_status(self):
        assert FeedbackStatus.CANCELLED == "cancelled"


class TestVoteTypeEnum:
    """Test VoteType enum membership."""

    def test_up_member(self):
        assert VoteType.UP == "up"

    def test_down_member(self):
        assert VoteType.DOWN == "down"

    def test_enum_has_exactly_two_members(self):
        assert len(list(VoteType)) == 2

    def test_invalid_vote_type_rejected(self):
        with pytest.raises(ValidationError):
            VoteRequest(vote_type="sideways")


# ============================================================================
# AuthorBriefResponse
# ============================================================================


class TestAuthorBriefResponse:
    """Test AuthorBriefResponse schema."""

    def test_valid_with_full_name(self):
        author = AuthorBriefResponse(id=uuid4(), full_name="Alice")
        assert author.full_name == "Alice"

    def test_valid_without_full_name(self):
        """full_name is optional and defaults to None."""
        author = AuthorBriefResponse(id=uuid4())
        assert author.full_name is None

    def test_id_required(self):
        """id is required."""
        with pytest.raises(ValidationError):
            AuthorBriefResponse(full_name="Alice")


# ============================================================================
# FeedbackCreate
# ============================================================================


class TestFeedbackCreate:
    """Test FeedbackCreate schema validation."""

    def _valid(self, **overrides):
        defaults = dict(
            title="Valid title",
            description="A description that is long enough",
            category=FeedbackCategory.FEATURE_REQUEST,
        )
        defaults.update(overrides)
        return FeedbackCreate(**defaults)

    def test_valid_feature_request(self):
        fb = self._valid()
        assert fb.title == "Valid title"
        assert fb.category == FeedbackCategory.FEATURE_REQUEST

    def test_valid_bug_category(self):
        fb = self._valid(category=FeedbackCategory.BUG_INCORRECT_DATA)
        assert fb.category == FeedbackCategory.BUG_INCORRECT_DATA

    # --- title constraints ---

    def test_title_min_length_boundary_valid(self):
        """3-char title is accepted (min_length=3)."""
        fb = self._valid(title="abc")
        assert len(fb.title) == 3

    def test_title_too_short_rejected(self):
        """2-char title is rejected (min_length=3)."""
        with pytest.raises(ValidationError) as exc_info:
            self._valid(title="ab")
        assert "string_too_short" in str(exc_info.value).lower()

    def test_title_max_length_boundary_valid(self):
        """255-char title is accepted (max_length=255)."""
        fb = self._valid(title="A" * 255)
        assert len(fb.title) == 255

    def test_title_too_long_rejected(self):
        """256-char title is rejected (max_length=255)."""
        with pytest.raises(ValidationError) as exc_info:
            self._valid(title="A" * 256)
        assert "string_too_long" in str(exc_info.value).lower()

    def test_title_required(self):
        with pytest.raises(ValidationError):
            FeedbackCreate(
                description="Long enough description", category=FeedbackCategory.FEATURE_REQUEST
            )

    # --- description constraints ---

    def test_description_min_length_boundary_valid(self):
        """10-char description is accepted (min_length=10)."""
        fb = self._valid(description="1234567890")
        assert len(fb.description) == 10

    def test_description_too_short_rejected(self):
        """9-char description is rejected (min_length=10)."""
        with pytest.raises(ValidationError) as exc_info:
            self._valid(description="123456789")
        assert "string_too_short" in str(exc_info.value).lower()

    def test_description_max_length_boundary_valid(self):
        """5000-char description is accepted (max_length=5000)."""
        fb = self._valid(description="A" * 5000)
        assert len(fb.description) == 5000

    def test_description_too_long_rejected(self):
        """5001-char description is rejected (max_length=5000)."""
        with pytest.raises(ValidationError) as exc_info:
            self._valid(description="A" * 5001)
        assert "string_too_long" in str(exc_info.value).lower()

    def test_description_required(self):
        with pytest.raises(ValidationError):
            FeedbackCreate(title="Valid title", category=FeedbackCategory.FEATURE_REQUEST)

    # --- category ---

    def test_category_required(self):
        with pytest.raises(ValidationError):
            FeedbackCreate(title="Valid title", description="Long enough description")

    def test_invalid_category_rejected(self):
        with pytest.raises(ValidationError):
            self._valid(category="unknown_category")


# ============================================================================
# FeedbackUpdate
# ============================================================================


class TestFeedbackUpdate:
    """Test FeedbackUpdate schema (partial update — all fields optional)."""

    def test_empty_update_is_valid(self):
        """All fields are optional; empty update passes."""
        update = FeedbackUpdate()
        assert update.title is None
        assert update.description is None

    def test_update_title_only(self):
        update = FeedbackUpdate(title="New title")
        assert update.title == "New title"
        assert update.description is None

    def test_update_description_only(self):
        update = FeedbackUpdate(description="New description here.")
        assert update.description == "New description here."
        assert update.title is None

    def test_update_both_fields(self):
        update = FeedbackUpdate(title="Updated", description="Updated description text.")
        assert update.title == "Updated"
        assert update.description == "Updated description text."

    # --- title constraints on optional field ---

    def test_title_too_short_rejected(self):
        with pytest.raises(ValidationError) as exc_info:
            FeedbackUpdate(title="ab")
        assert "string_too_short" in str(exc_info.value).lower()

    def test_title_too_long_rejected(self):
        with pytest.raises(ValidationError) as exc_info:
            FeedbackUpdate(title="A" * 256)
        assert "string_too_long" in str(exc_info.value).lower()

    def test_title_min_boundary_valid(self):
        update = FeedbackUpdate(title="abc")
        assert update.title == "abc"

    def test_title_max_boundary_valid(self):
        update = FeedbackUpdate(title="A" * 255)
        assert len(update.title) == 255

    # --- description constraints on optional field ---

    def test_description_too_short_rejected(self):
        with pytest.raises(ValidationError) as exc_info:
            FeedbackUpdate(description="short")
        assert "string_too_short" in str(exc_info.value).lower()

    def test_description_too_long_rejected(self):
        with pytest.raises(ValidationError) as exc_info:
            FeedbackUpdate(description="A" * 5001)
        assert "string_too_long" in str(exc_info.value).lower()

    def test_description_min_boundary_valid(self):
        update = FeedbackUpdate(description="1234567890")
        assert update.description == "1234567890"

    def test_description_max_boundary_valid(self):
        update = FeedbackUpdate(description="A" * 5000)
        assert len(update.description) == 5000


# ============================================================================
# VoteRequest
# ============================================================================


class TestVoteRequest:
    """Test VoteRequest schema."""

    def test_vote_up(self):
        req = VoteRequest(vote_type=VoteType.UP)
        assert req.vote_type == VoteType.UP

    def test_vote_down(self):
        req = VoteRequest(vote_type=VoteType.DOWN)
        assert req.vote_type == VoteType.DOWN

    def test_vote_type_accepts_string_value(self):
        """str-enum coercion: raw string 'up' is accepted."""
        req = VoteRequest(vote_type="up")
        assert req.vote_type == VoteType.UP

    def test_invalid_vote_type_rejected(self):
        with pytest.raises(ValidationError):
            VoteRequest(vote_type="neutral")

    def test_vote_type_required(self):
        with pytest.raises(ValidationError):
            VoteRequest()


# ============================================================================
# VoteResponse
# ============================================================================


class TestVoteResponse:
    """Test VoteResponse schema."""

    def test_valid_vote_response_with_vote(self):
        fid = uuid4()
        resp = VoteResponse(feedback_id=fid, vote_type=VoteType.UP, new_vote_count=5)
        assert resp.feedback_id == fid
        assert resp.vote_type == VoteType.UP
        assert resp.new_vote_count == 5

    def test_vote_response_none_vote_type(self):
        """vote_type=None means the vote was removed."""
        resp = VoteResponse(feedback_id=uuid4(), vote_type=None, new_vote_count=0)
        assert resp.vote_type is None
        assert resp.new_vote_count == 0

    def test_feedback_id_required(self):
        with pytest.raises(ValidationError):
            VoteResponse(vote_type=VoteType.UP, new_vote_count=1)


# ============================================================================
# FeedbackResponse
# ============================================================================


class TestFeedbackResponse:
    """Test FeedbackResponse schema (from-attributes, response model)."""

    def _make_author(self):
        return AuthorBriefResponse(id=uuid4(), full_name="Bob")

    def _valid(self, **overrides):
        now = datetime.now()
        defaults = dict(
            id=uuid4(),
            title="Some feedback",
            description="A longer description.",
            category=FeedbackCategory.FEATURE_REQUEST,
            status=FeedbackStatus.NEW,
            vote_count=0,
            user_vote=None,
            admin_response=None,
            admin_response_at=None,
            author=self._make_author(),
            created_at=now,
            updated_at=now,
        )
        defaults.update(overrides)
        return FeedbackResponse(**defaults)

    def test_valid_minimal(self):
        resp = self._valid()
        assert resp.status == FeedbackStatus.NEW
        assert resp.vote_count == 0
        assert resp.user_vote is None

    def test_valid_with_user_vote_up(self):
        resp = self._valid(user_vote=VoteType.UP, vote_count=3)
        assert resp.user_vote == VoteType.UP
        assert resp.vote_count == 3

    def test_valid_with_admin_response(self):
        now = datetime.now()
        resp = self._valid(admin_response="Thanks for the report!", admin_response_at=now)
        assert resp.admin_response == "Thanks for the report!"
        assert resp.admin_response_at == now

    def test_all_status_values_accepted(self):
        for status in FeedbackStatus:
            resp = self._valid(status=status)
            assert resp.status == status

    def test_all_category_values_accepted(self):
        for cat in FeedbackCategory:
            resp = self._valid(category=cat)
            assert resp.category == cat

    def test_negative_vote_count_accepted(self):
        """FeedbackResponse does not constrain vote_count to >= 0 — pin current behaviour."""
        resp = self._valid(vote_count=-1)
        assert resp.vote_count == -1

    def test_author_required(self):
        with pytest.raises((ValidationError, TypeError)):
            now = datetime.now()
            FeedbackResponse(
                id=uuid4(),
                title="Title",
                description="Description",
                category=FeedbackCategory.FEATURE_REQUEST,
                status=FeedbackStatus.NEW,
                vote_count=0,
                created_at=now,
                updated_at=now,
            )


# ============================================================================
# FeedbackListResponse
# ============================================================================


class TestFeedbackListResponse:
    """Test FeedbackListResponse schema."""

    def _make_item(self):
        now = datetime.now()
        author = AuthorBriefResponse(id=uuid4(), full_name="Carol")
        return FeedbackResponse(
            id=uuid4(),
            title="Item",
            description="Some description.",
            category=FeedbackCategory.BUG_INCORRECT_DATA,
            status=FeedbackStatus.UNDER_REVIEW,
            vote_count=1,
            author=author,
            created_at=now,
            updated_at=now,
        )

    def test_valid_list_with_one_item(self):
        item = self._make_item()
        resp = FeedbackListResponse(total=1, page=1, page_size=20, items=[item])
        assert resp.total == 1
        assert len(resp.items) == 1

    def test_empty_list(self):
        resp = FeedbackListResponse(total=0, page=1, page_size=20, items=[])
        assert resp.total == 0
        assert resp.items == []

    def test_multiple_items(self):
        items = [self._make_item(), self._make_item()]
        resp = FeedbackListResponse(total=2, page=2, page_size=10, items=items)
        assert resp.total == 2
        assert resp.page == 2
        assert resp.page_size == 10
        assert len(resp.items) == 2


# ============================================================================
# AdminFeedbackUpdate
# ============================================================================


class TestAdminFeedbackUpdate:
    """Test AdminFeedbackUpdate schema."""

    def test_empty_update_valid(self):
        """All fields optional."""
        update = AdminFeedbackUpdate()
        assert update.status is None
        assert update.admin_response is None

    def test_status_only(self):
        update = AdminFeedbackUpdate(status=FeedbackStatus.PLANNED)
        assert update.status == FeedbackStatus.PLANNED
        assert update.admin_response is None

    def test_admin_response_only(self):
        update = AdminFeedbackUpdate(admin_response="We are looking into this.")
        assert update.admin_response == "We are looking into this."
        assert update.status is None

    def test_both_fields(self):
        update = AdminFeedbackUpdate(
            status=FeedbackStatus.IN_PROGRESS,
            admin_response="Work started.",
        )
        assert update.status == FeedbackStatus.IN_PROGRESS
        assert update.admin_response == "Work started."

    def test_admin_response_max_length_boundary_valid(self):
        """500-char response is accepted (max_length=500)."""
        update = AdminFeedbackUpdate(admin_response="A" * 500)
        assert len(update.admin_response) == 500

    def test_admin_response_too_long_rejected(self):
        """501-char response is rejected (max_length=500)."""
        with pytest.raises(ValidationError) as exc_info:
            AdminFeedbackUpdate(admin_response="A" * 501)
        assert "string_too_long" in str(exc_info.value).lower()

    def test_invalid_status_rejected(self):
        with pytest.raises(ValidationError):
            AdminFeedbackUpdate(status="not_a_status")

    def test_all_valid_statuses_accepted(self):
        for status in FeedbackStatus:
            update = AdminFeedbackUpdate(status=status)
            assert update.status == status


# ============================================================================
# AdminFeedbackResponse
# ============================================================================


class TestAdminFeedbackResponse:
    """Test AdminFeedbackResponse schema (admin view, no user_vote field)."""

    def _make_author(self):
        return AuthorBriefResponse(id=uuid4(), full_name="Dave")

    def _valid(self, **overrides):
        now = datetime.now()
        defaults = dict(
            id=uuid4(),
            title="Admin feedback",
            description="Description for admin.",
            category=FeedbackCategory.FEATURE_REQUEST,
            status=FeedbackStatus.NEW,
            vote_count=0,
            admin_response=None,
            admin_response_at=None,
            author=self._make_author(),
            created_at=now,
            updated_at=now,
        )
        defaults.update(overrides)
        return AdminFeedbackResponse(**defaults)

    def test_valid_minimal(self):
        resp = self._valid()
        assert resp.status == FeedbackStatus.NEW
        assert resp.vote_count == 0
        assert resp.admin_response is None

    def test_no_user_vote_field(self):
        """AdminFeedbackResponse must NOT expose user_vote."""
        resp = self._valid()
        assert "user_vote" not in resp.model_fields

    def test_all_statuses_accepted(self):
        for status in FeedbackStatus:
            resp = self._valid(status=status)
            assert resp.status == status

    def test_with_admin_response(self):
        now = datetime.now()
        resp = self._valid(admin_response="Response text", admin_response_at=now)
        assert resp.admin_response == "Response text"
        assert resp.admin_response_at == now


# ============================================================================
# AdminFeedbackListResponse
# ============================================================================


class TestAdminFeedbackListResponse:
    """Test AdminFeedbackListResponse schema."""

    def _make_admin_item(self):
        now = datetime.now()
        author = AuthorBriefResponse(id=uuid4(), full_name="Eve")
        return AdminFeedbackResponse(
            id=uuid4(),
            title="Admin item",
            description="Admin item description.",
            category=FeedbackCategory.BUG_INCORRECT_DATA,
            status=FeedbackStatus.COMPLETED,
            vote_count=2,
            author=author,
            created_at=now,
            updated_at=now,
        )

    def test_valid_list(self):
        item = self._make_admin_item()
        resp = AdminFeedbackListResponse(total=1, page=1, page_size=20, items=[item])
        assert resp.total == 1
        assert len(resp.items) == 1

    def test_empty_list(self):
        resp = AdminFeedbackListResponse(total=0, page=1, page_size=20, items=[])
        assert resp.total == 0
        assert resp.items == []

    def test_pagination_fields(self):
        resp = AdminFeedbackListResponse(total=50, page=3, page_size=10, items=[])
        assert resp.total == 50
        assert resp.page == 3
        assert resp.page_size == 10
