"""Unit tests for response formatting utilities.

Tests cover:
- PaginationMeta model validation and serialization
- SuccessResponse generic model with various data types
- PaginatedResponse model with pagination metadata
- ErrorDetail and ErrorResponse models
- create_success_response() helper function
- create_paginated_response() helper with pagination calculations
- create_error_response() helper with optional debug field

Target coverage: 95%+
"""

import pytest
from pydantic import BaseModel, ValidationError

from src.utils.responses import (
    ErrorDetail,
    ErrorResponse,
    PaginatedResponse,
    PaginationMeta,
    SuccessResponse,
    create_error_response,
    create_paginated_response,
    create_success_response,
)

# ============================================================================
# Test Fixtures
# ============================================================================


class SampleModel(BaseModel):
    """Sample Pydantic model for testing generic responses."""

    id: int
    name: str


# ============================================================================
# PaginationMeta Tests
# ============================================================================


class TestPaginationMeta:
    """Tests for PaginationMeta model."""

    def test_valid_construction(self) -> None:
        """Test creating valid pagination metadata."""
        meta = PaginationMeta(
            page=1,
            page_size=20,
            total_items=150,
            total_pages=8,
            has_next=True,
            has_previous=False,
        )
        assert meta.page == 1
        assert meta.page_size == 20
        assert meta.total_items == 150
        assert meta.total_pages == 8
        assert meta.has_next is True
        assert meta.has_previous is False

    def test_page_must_be_at_least_one(self) -> None:
        """Test that page must be >= 1."""
        with pytest.raises(ValidationError) as exc_info:
            PaginationMeta(
                page=0,
                page_size=20,
                total_items=150,
                total_pages=8,
                has_next=True,
                has_previous=False,
            )
        assert "page" in str(exc_info.value).lower()

    def test_page_size_must_be_at_least_one(self) -> None:
        """Test that page_size must be >= 1."""
        with pytest.raises(ValidationError) as exc_info:
            PaginationMeta(
                page=1,
                page_size=0,
                total_items=150,
                total_pages=8,
                has_next=True,
                has_previous=False,
            )
        assert "page_size" in str(exc_info.value).lower()

    def test_page_size_max_is_100(self) -> None:
        """Test that page_size must be <= 100."""
        with pytest.raises(ValidationError) as exc_info:
            PaginationMeta(
                page=1,
                page_size=101,
                total_items=150,
                total_pages=8,
                has_next=True,
                has_previous=False,
            )
        assert "page_size" in str(exc_info.value).lower()

    def test_total_items_can_be_zero(self) -> None:
        """Test that total_items can be 0."""
        meta = PaginationMeta(
            page=1,
            page_size=20,
            total_items=0,
            total_pages=0,
            has_next=False,
            has_previous=False,
        )
        assert meta.total_items == 0

    def test_total_items_cannot_be_negative(self) -> None:
        """Test that total_items must be >= 0."""
        with pytest.raises(ValidationError) as exc_info:
            PaginationMeta(
                page=1,
                page_size=20,
                total_items=-1,
                total_pages=0,
                has_next=False,
                has_previous=False,
            )
        assert "total_items" in str(exc_info.value).lower()

    def test_model_serialization(self) -> None:
        """Test that model serializes to dict correctly."""
        meta = PaginationMeta(
            page=2,
            page_size=10,
            total_items=50,
            total_pages=5,
            has_next=True,
            has_previous=True,
        )
        data = meta.model_dump()
        assert data == {
            "page": 2,
            "page_size": 10,
            "total_items": 50,
            "total_pages": 5,
            "has_next": True,
            "has_previous": True,
        }

    def test_model_is_frozen(self) -> None:
        """Test that PaginationMeta is immutable."""
        meta = PaginationMeta(
            page=1,
            page_size=20,
            total_items=100,
            total_pages=5,
            has_next=True,
            has_previous=False,
        )
        with pytest.raises(ValidationError):
            meta.page = 2  # type: ignore


# ============================================================================
# SuccessResponse Tests
# ============================================================================


class TestSuccessResponse:
    """Tests for SuccessResponse generic model."""

    def test_wrapping_dict_data(self) -> None:
        """Test wrapping dictionary data."""
        response = SuccessResponse(data={"id": 1, "name": "Test"})
        assert response.success is True
        assert response.data == {"id": 1, "name": "Test"}

    def test_wrapping_pydantic_model(self) -> None:
        """Test wrapping Pydantic model data."""
        model = SampleModel(id=1, name="Test")
        response = SuccessResponse(data=model)
        assert response.success is True
        assert response.data == model
        assert response.data.id == 1
        assert response.data.name == "Test"

    def test_wrapping_list(self) -> None:
        """Test wrapping list data."""
        response = SuccessResponse(data=[1, 2, 3])
        assert response.success is True
        assert response.data == [1, 2, 3]

    def test_wrapping_none(self) -> None:
        """Test wrapping None data."""
        response = SuccessResponse(data=None)
        assert response.success is True
        assert response.data is None

    def test_wrapping_scalar(self) -> None:
        """Test wrapping scalar values."""
        response = SuccessResponse(data=42)
        assert response.success is True
        assert response.data == 42

    def test_success_is_always_true(self) -> None:
        """Test that success field is always True."""
        response = SuccessResponse(data={})
        assert response.success is True

    def test_serialization_with_model_dump(self) -> None:
        """Test serialization using model_dump()."""
        response = SuccessResponse(data={"key": "value"})
        data = response.model_dump()
        assert data == {"success": True, "data": {"key": "value"}}

    def test_serialization_with_nested_model(self) -> None:
        """Test serialization with nested Pydantic model."""
        model = SampleModel(id=1, name="Test")
        response = SuccessResponse(data=model)
        data = response.model_dump()
        assert data == {"success": True, "data": {"id": 1, "name": "Test"}}


# ============================================================================
# PaginatedResponse Tests
# ============================================================================


class TestPaginatedResponse:
    """Tests for PaginatedResponse generic model."""

    def test_wrapping_list_data(self) -> None:
        """Test wrapping list data with pagination."""
        pagination = PaginationMeta(
            page=1,
            page_size=10,
            total_items=25,
            total_pages=3,
            has_next=True,
            has_previous=False,
        )
        response = PaginatedResponse(data=[1, 2, 3], pagination=pagination)
        assert response.success is True
        assert response.data == [1, 2, 3]
        assert response.pagination == pagination

    def test_with_pydantic_model_list(self) -> None:
        """Test with list of Pydantic models."""
        models = [SampleModel(id=1, name="A"), SampleModel(id=2, name="B")]
        pagination = PaginationMeta(
            page=1,
            page_size=10,
            total_items=2,
            total_pages=1,
            has_next=False,
            has_previous=False,
        )
        response = PaginatedResponse(data=models, pagination=pagination)
        assert len(response.data) == 2
        assert response.data[0].name == "A"

    def test_success_is_always_true(self) -> None:
        """Test that success field is always True."""
        pagination = PaginationMeta(
            page=1,
            page_size=10,
            total_items=0,
            total_pages=0,
            has_next=False,
            has_previous=False,
        )
        response = PaginatedResponse(data=[], pagination=pagination)
        assert response.success is True

    def test_serialization(self) -> None:
        """Test serialization to dict."""
        pagination = PaginationMeta(
            page=1,
            page_size=10,
            total_items=25,
            total_pages=3,
            has_next=True,
            has_previous=False,
        )
        response = PaginatedResponse(data=[1, 2], pagination=pagination)
        data = response.model_dump()
        assert data == {
            "success": True,
            "data": [1, 2],
            "pagination": {
                "page": 1,
                "page_size": 10,
                "total_items": 25,
                "total_pages": 3,
                "has_next": True,
                "has_previous": False,
            },
        }


# ============================================================================
# ErrorDetail Tests
# ============================================================================


class TestErrorDetail:
    """Tests for ErrorDetail model."""

    def test_required_fields(self) -> None:
        """Test that code, message, and request_id are required."""
        error = ErrorDetail(
            code="NOT_FOUND",
            message="User not found",
            request_id="req-123",
        )
        assert error.code == "NOT_FOUND"
        assert error.message == "User not found"
        assert error.request_id == "req-123"

    def test_optional_debug_field(self) -> None:
        """Test that debug field is optional."""
        error = ErrorDetail(
            code="ERROR",
            message="Test",
            request_id="req-123",
        )
        assert error.debug is None

    def test_debug_field_can_be_dict(self) -> None:
        """Test that debug field accepts dict."""
        debug_info = {"type": "ValueError", "traceback": ["line1", "line2"]}
        error = ErrorDetail(
            code="ERROR",
            message="Test",
            request_id="req-123",
            debug=debug_info,
        )
        assert error.debug == debug_info

    def test_serialization(self) -> None:
        """Test model serialization."""
        error = ErrorDetail(
            code="VALIDATION_ERROR",
            message="Invalid input",
            request_id="req-456",
        )
        data = error.model_dump()
        assert data == {
            "code": "VALIDATION_ERROR",
            "message": "Invalid input",
            "request_id": "req-456",
            "debug": None,
        }


# ============================================================================
# ErrorResponse Tests
# ============================================================================


class TestErrorResponse:
    """Tests for ErrorResponse model."""

    def test_success_is_always_false(self) -> None:
        """Test that success field is always False."""
        error = ErrorDetail(code="ERROR", message="Test", request_id="req")
        response = ErrorResponse(error=error)
        assert response.success is False

    def test_error_field_is_error_detail(self) -> None:
        """Test that error field is ErrorDetail."""
        error = ErrorDetail(code="NOT_FOUND", message="Not found", request_id="req")
        response = ErrorResponse(error=error)
        assert isinstance(response.error, ErrorDetail)
        assert response.error.code == "NOT_FOUND"

    def test_serialization(self) -> None:
        """Test model serialization."""
        error = ErrorDetail(code="ERROR", message="Message", request_id="req-789")
        response = ErrorResponse(error=error)
        data = response.model_dump()
        assert data == {
            "success": False,
            "error": {
                "code": "ERROR",
                "message": "Message",
                "request_id": "req-789",
                "debug": None,
            },
        }


# ============================================================================
# create_success_response Tests
# ============================================================================


class TestCreateSuccessResponse:
    """Tests for create_success_response helper function."""

    def test_output_format(self) -> None:
        """Test that output has correct format."""
        result = create_success_response({"id": 1})
        assert "success" in result
        assert "data" in result

    def test_success_is_true(self) -> None:
        """Test that success field is True."""
        result = create_success_response({})
        assert result["success"] is True

    def test_with_dict_data(self) -> None:
        """Test with dictionary data."""
        data = {"id": 1, "name": "Test"}
        result = create_success_response(data)
        assert result["data"] == data

    def test_with_list_data(self) -> None:
        """Test with list data."""
        data = [1, 2, 3]
        result = create_success_response(data)
        assert result["data"] == data

    def test_with_none_data(self) -> None:
        """Test with None data."""
        result = create_success_response(None)
        assert result["data"] is None

    def test_with_scalar_data(self) -> None:
        """Test with scalar data."""
        result = create_success_response(42)
        assert result["data"] == 42

    def test_returns_dict(self) -> None:
        """Test that function returns a dictionary."""
        result = create_success_response({})
        assert isinstance(result, dict)


# ============================================================================
# create_paginated_response Tests
# ============================================================================


class TestCreatePaginatedResponse:
    """Tests for create_paginated_response helper function."""

    def test_output_format(self) -> None:
        """Test that output has correct format."""
        result = create_paginated_response([1, 2], page=1, page_size=10, total_items=20)
        assert "success" in result
        assert "data" in result
        assert "pagination" in result

    def test_success_is_true(self) -> None:
        """Test that success field is True."""
        result = create_paginated_response([], page=1, page_size=10, total_items=0)
        assert result["success"] is True

    def test_first_page_has_previous_false(self) -> None:
        """Test that first page has has_previous=False."""
        result = create_paginated_response([1], page=1, page_size=10, total_items=50)
        assert result["pagination"]["has_previous"] is False

    def test_first_page_has_next_true(self) -> None:
        """Test that first page has has_next=True when more pages exist."""
        result = create_paginated_response([1], page=1, page_size=10, total_items=50)
        assert result["pagination"]["has_next"] is True

    def test_last_page_has_next_false(self) -> None:
        """Test that last page has has_next=False."""
        result = create_paginated_response([1], page=5, page_size=10, total_items=50)
        assert result["pagination"]["has_next"] is False

    def test_last_page_has_previous_true(self) -> None:
        """Test that last page has has_previous=True."""
        result = create_paginated_response([1], page=5, page_size=10, total_items=50)
        assert result["pagination"]["has_previous"] is True

    def test_middle_page_has_both_navigation(self) -> None:
        """Test that middle page has both has_next and has_previous True."""
        result = create_paginated_response([1], page=3, page_size=10, total_items=50)
        assert result["pagination"]["has_next"] is True
        assert result["pagination"]["has_previous"] is True

    def test_empty_results(self) -> None:
        """Test with zero total_items."""
        result = create_paginated_response([], page=1, page_size=20, total_items=0)
        assert result["data"] == []
        assert result["pagination"]["total_pages"] == 0
        assert result["pagination"]["has_next"] is False
        assert result["pagination"]["has_previous"] is False

    def test_single_page(self) -> None:
        """Test when all items fit on one page."""
        result = create_paginated_response([1, 2], page=1, page_size=20, total_items=15)
        assert result["pagination"]["total_pages"] == 1
        assert result["pagination"]["has_next"] is False
        assert result["pagination"]["has_previous"] is False

    def test_total_pages_calculation_exact(self) -> None:
        """Test total_pages calculation when items divide evenly."""
        result = create_paginated_response([], page=1, page_size=20, total_items=40)
        assert result["pagination"]["total_pages"] == 2

    def test_total_pages_calculation_remainder(self) -> None:
        """Test total_pages calculation with remainder."""
        result = create_paginated_response([], page=1, page_size=20, total_items=41)
        assert result["pagination"]["total_pages"] == 3

    def test_total_pages_calculation_150_items(self) -> None:
        """Test total_pages calculation: ceil(150/20) = 8."""
        result = create_paginated_response([], page=1, page_size=20, total_items=150)
        assert result["pagination"]["total_pages"] == 8

    def test_page_size_one(self) -> None:
        """Test edge case with page_size=1."""
        result = create_paginated_response([1], page=1, page_size=1, total_items=10)
        assert result["pagination"]["total_pages"] == 10
        assert result["pagination"]["has_next"] is True

    def test_large_page_numbers(self) -> None:
        """Test with large page numbers."""
        result = create_paginated_response([], page=1000, page_size=10, total_items=10000)
        assert result["pagination"]["page"] == 1000
        assert result["pagination"]["total_pages"] == 1000
        assert result["pagination"]["has_next"] is False
        assert result["pagination"]["has_previous"] is True

    def test_pagination_metadata_fields(self) -> None:
        """Test all pagination metadata fields are present."""
        result = create_paginated_response([1, 2, 3], page=2, page_size=10, total_items=100)
        pagination = result["pagination"]
        assert pagination["page"] == 2
        assert pagination["page_size"] == 10
        assert pagination["total_items"] == 100
        assert pagination["total_pages"] == 10
        assert "has_next" in pagination
        assert "has_previous" in pagination

    def test_page_size_zero_edge_case(self) -> None:
        """Test edge case when page_size is 0."""
        result = create_paginated_response([], page=1, page_size=0, total_items=10)
        # Should handle gracefully with 0 total_pages
        assert result["pagination"]["total_pages"] == 0

    def test_returns_dict(self) -> None:
        """Test that function returns a dictionary."""
        result = create_paginated_response([], page=1, page_size=10, total_items=0)
        assert isinstance(result, dict)


# ============================================================================
# create_error_response Tests
# ============================================================================


class TestCreateErrorResponse:
    """Tests for create_error_response helper function."""

    def test_output_format(self) -> None:
        """Test that output has correct format."""
        result = create_error_response("ERROR", "Test message", "req-123")
        assert "success" in result
        assert "error" in result

    def test_success_is_false(self) -> None:
        """Test that success field is False."""
        result = create_error_response("ERROR", "Test", "req")
        assert result["success"] is False

    def test_required_fields_present(self) -> None:
        """Test that required fields are in error object."""
        result = create_error_response("CODE", "Message", "req-id")
        error = result["error"]
        assert error["code"] == "CODE"
        assert error["message"] == "Message"
        assert error["request_id"] == "req-id"

    def test_debug_included_when_provided(self) -> None:
        """Test that debug field is included when provided."""
        debug_info = {"type": "Error", "traceback": ["line1"]}
        result = create_error_response("ERROR", "Test", "req", debug=debug_info)
        assert result["error"]["debug"] == debug_info

    def test_debug_excluded_when_none(self) -> None:
        """Test that debug field is excluded when None."""
        result = create_error_response("ERROR", "Test", "req", debug=None)
        assert "debug" not in result["error"]

    def test_debug_excluded_by_default(self) -> None:
        """Test that debug field is excluded by default."""
        result = create_error_response("ERROR", "Test", "req")
        assert "debug" not in result["error"]

    def test_default_request_id_is_unknown(self) -> None:
        """Test that default request_id is 'unknown'."""
        result = create_error_response("ERROR", "Test")
        assert result["error"]["request_id"] == "unknown"

    def test_custom_request_id(self) -> None:
        """Test custom request_id."""
        result = create_error_response("ERROR", "Test", request_id="custom-123")
        assert result["error"]["request_id"] == "custom-123"

    def test_returns_dict(self) -> None:
        """Test that function returns a dictionary."""
        result = create_error_response("ERROR", "Test")
        assert isinstance(result, dict)

    def test_matches_middleware_format(self) -> None:
        """Test that format matches error handling middleware."""
        result = create_error_response(
            code="INTERNAL_SERVER_ERROR",
            message="An unexpected error occurred",
            request_id="abc12345",
        )
        # Expected format from middleware
        assert result == {
            "success": False,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred",
                "request_id": "abc12345",
            },
        }
