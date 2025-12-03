"""Custom assertion helpers for Learn Greek Easy tests.

This module provides domain-specific assertion functions that:
- Validate API response structures
- Verify SM-2 algorithm calculations
- Check pagination response format
- Validate error response structures

All assertions raise AssertionError with descriptive messages on failure.

Usage:
    from tests.helpers.assertions import (
        assert_valid_user_response,
        assert_valid_token_response,
        assert_sm2_calculation,
    )

    def test_user_creation(response):
        assert_valid_user_response(response.json())
"""

from datetime import date
from typing import Any
from uuid import UUID

from httpx import Response

# =============================================================================
# API Response Assertions
# =============================================================================


def assert_valid_user_response(
    data: dict[str, Any],
    *,
    email: str | None = None,
    full_name: str | None = None,
    is_active: bool = True,
    is_superuser: bool = False,
) -> None:
    """Assert that a user response has valid structure and expected values.

    Args:
        data: User response data dictionary
        email: Expected email (optional)
        full_name: Expected full name (optional)
        is_active: Expected active status
        is_superuser: Expected superuser status

    Raises:
        AssertionError: If validation fails

    Example:
        response = await client.get("/api/v1/auth/me", headers=auth_headers)
        assert_valid_user_response(response.json(), email="test@example.com")
    """
    # Required fields
    required_fields = ["id", "email", "is_active", "is_superuser", "created_at", "updated_at"]
    for field in required_fields:
        assert field in data, f"Missing required field: {field}"

    # UUID validation
    try:
        UUID(data["id"])
    except (ValueError, TypeError):
        raise AssertionError(f"Invalid UUID format for id: {data['id']}")

    # Type validation
    assert isinstance(data["email"], str), f"email must be string, got {type(data['email'])}"
    assert isinstance(
        data["is_active"], bool
    ), f"is_active must be bool, got {type(data['is_active'])}"
    assert isinstance(
        data["is_superuser"], bool
    ), f"is_superuser must be bool, got {type(data['is_superuser'])}"

    # Expected values
    if email is not None:
        assert data["email"] == email, f"Expected email '{email}', got '{data['email']}'"
    if full_name is not None:
        assert (
            data.get("full_name") == full_name
        ), f"Expected full_name '{full_name}', got '{data.get('full_name')}'"
    assert (
        data["is_active"] == is_active
    ), f"Expected is_active={is_active}, got {data['is_active']}"
    assert (
        data["is_superuser"] == is_superuser
    ), f"Expected is_superuser={is_superuser}, got {data['is_superuser']}"


def assert_valid_token_response(
    data: dict[str, Any],
    *,
    token_type: str = "bearer",
    min_expires_in: int = 60,
) -> None:
    """Assert that a token response has valid structure.

    Args:
        data: Token response data dictionary
        token_type: Expected token type (default: "bearer")
        min_expires_in: Minimum expected expiration time in seconds

    Raises:
        AssertionError: If validation fails

    Example:
        response = await client.post("/api/v1/auth/login", json=credentials)
        assert_valid_token_response(response.json())
    """
    required_fields = ["access_token", "refresh_token", "token_type", "expires_in"]
    for field in required_fields:
        assert field in data, f"Missing required field: {field}"

    # Token validation
    assert isinstance(data["access_token"], str), "access_token must be string"
    assert len(data["access_token"]) > 20, "access_token too short"
    assert isinstance(data["refresh_token"], str), "refresh_token must be string"
    assert len(data["refresh_token"]) > 20, "refresh_token too short"

    # Token type
    assert (
        data["token_type"] == token_type
    ), f"Expected token_type '{token_type}', got '{data['token_type']}'"

    # Expiration
    assert isinstance(
        data["expires_in"], int
    ), f"expires_in must be int, got {type(data['expires_in'])}"
    assert (
        data["expires_in"] >= min_expires_in
    ), f"expires_in too short: {data['expires_in']} < {min_expires_in}"


def assert_api_error(
    response: Response,
    status_code: int,
    *,
    detail_contains: str | None = None,
    detail_exact: str | None = None,
) -> None:
    """Assert that an API error response has expected format.

    Args:
        response: HTTP response object
        status_code: Expected status code
        detail_contains: Substring that should be in detail message
        detail_exact: Exact detail message expected

    Raises:
        AssertionError: If validation fails

    Example:
        response = await client.post("/api/v1/auth/login", json=bad_credentials)
        assert_api_error(response, 401, detail_contains="Invalid")
    """
    assert (
        response.status_code == status_code
    ), f"Expected status {status_code}, got {response.status_code}: {response.text}"

    data = response.json()
    assert "detail" in data, f"Error response missing 'detail' field: {data}"

    if detail_exact is not None:
        assert (
            data["detail"] == detail_exact
        ), f"Expected detail '{detail_exact}', got '{data['detail']}'"

    if detail_contains is not None:
        assert detail_contains in str(
            data["detail"]
        ), f"Expected detail to contain '{detail_contains}', got '{data['detail']}'"


def assert_pagination(
    data: dict[str, Any],
    *,
    total: int | None = None,
    page: int | None = None,
    page_size: int | None = None,
    min_items: int | None = None,
    max_items: int | None = None,
) -> None:
    """Assert that a paginated response has valid structure.

    Args:
        data: Paginated response data
        total: Expected total count
        page: Expected current page
        page_size: Expected page size
        min_items: Minimum items in current page
        max_items: Maximum items in current page

    Raises:
        AssertionError: If validation fails

    Example:
        response = await client.get("/api/v1/decks?page=1&page_size=10")
        assert_pagination(response.json(), page=1, page_size=10, min_items=1)
    """
    # Check for pagination fields (support multiple patterns)
    pagination_patterns = [
        ("items", "total", "page", "page_size"),
        ("data", "total", "page", "per_page"),
        ("results", "count", "page", "limit"),
    ]

    items_key = None
    for items_k, total_k, page_k, size_k in pagination_patterns:
        if items_k in data:
            items_key = items_k
            break

    assert (
        items_key is not None
    ), f"No recognized pagination pattern in response: {list(data.keys())}"

    items = data[items_key]
    assert isinstance(items, list), f"Items must be a list, got {type(items)}"

    if total is not None and "total" in data:
        assert data["total"] == total, f"Expected total {total}, got {data['total']}"

    if page is not None and "page" in data:
        assert data["page"] == page, f"Expected page {page}, got {data['page']}"

    if page_size is not None:
        size_key = next((k for k in ["page_size", "per_page", "limit"] if k in data), None)
        if size_key:
            assert (
                data[size_key] == page_size
            ), f"Expected {size_key} {page_size}, got {data[size_key]}"

    if min_items is not None:
        assert len(items) >= min_items, f"Expected at least {min_items} items, got {len(items)}"

    if max_items is not None:
        assert len(items) <= max_items, f"Expected at most {max_items} items, got {len(items)}"


# =============================================================================
# SM-2 Algorithm Assertions
# =============================================================================


def assert_sm2_calculation(
    *,
    quality: int,
    old_ef: float,
    old_interval: int,
    old_repetitions: int,
    new_ef: float,
    new_interval: int,
    new_repetitions: int,
    tolerance: float = 0.01,
) -> None:
    """Assert that SM-2 algorithm calculation is correct.

    The SM-2 algorithm:
    - EF = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    - EF minimum = 1.3
    - If q < 3: reset repetitions to 0, interval to 1
    - If q >= 3: increment repetitions, calculate new interval

    Args:
        quality: Review quality rating (0-5)
        old_ef: Easiness factor before review
        old_interval: Interval before review (days)
        old_repetitions: Repetition count before review
        new_ef: Easiness factor after review (actual)
        new_interval: Interval after review (actual)
        new_repetitions: Repetition count after review (actual)
        tolerance: Tolerance for float comparison

    Raises:
        AssertionError: If calculation doesn't match expected SM-2 output

    Example:
        # After a quality=4 review on a new card
        assert_sm2_calculation(
            quality=4,
            old_ef=2.5, old_interval=0, old_repetitions=0,
            new_ef=2.5, new_interval=1, new_repetitions=1,
        )
    """
    # Calculate expected EF
    ef_delta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
    expected_ef = max(1.3, old_ef + ef_delta)

    # Calculate expected interval and repetitions
    if quality < 3:
        # Failed review: reset
        expected_repetitions = 0
        expected_interval = 1
    else:
        # Successful review
        expected_repetitions = old_repetitions + 1
        if expected_repetitions == 1:
            expected_interval = 1
        elif expected_repetitions == 2:
            expected_interval = 6
        else:
            expected_interval = round(old_interval * expected_ef)

    # Assert EF (with tolerance for floating point)
    assert abs(new_ef - expected_ef) <= tolerance, (
        f"SM-2 EF mismatch: expected {expected_ef:.2f}, got {new_ef:.2f} "
        f"(quality={quality}, old_ef={old_ef:.2f})"
    )

    # Assert interval
    assert new_interval == expected_interval, (
        f"SM-2 interval mismatch: expected {expected_interval}, got {new_interval} "
        f"(quality={quality}, old_interval={old_interval})"
    )

    # Assert repetitions
    assert new_repetitions == expected_repetitions, (
        f"SM-2 repetitions mismatch: expected {expected_repetitions}, got {new_repetitions} "
        f"(quality={quality}, old_repetitions={old_repetitions})"
    )


def assert_card_due(
    next_review_date: date,
    *,
    on_date: date | None = None,
    days_tolerance: int = 0,
) -> None:
    """Assert that a card is due for review.

    Args:
        next_review_date: Card's next review date
        on_date: Date to check against (default: today)
        days_tolerance: Allowed days difference

    Raises:
        AssertionError: If card is not due

    Example:
        assert_card_due(card_stats.next_review_date)  # Due today
        assert_card_due(card_stats.next_review_date, on_date=some_date)
    """
    check_date = on_date or date.today()
    days_diff = (next_review_date - check_date).days

    assert days_diff <= days_tolerance, (
        f"Card not due: next_review={next_review_date}, check_date={check_date}, "
        f"days_diff={days_diff}, tolerance={days_tolerance}"
    )


def assert_card_not_due(
    next_review_date: date,
    *,
    on_date: date | None = None,
    min_days: int = 1,
) -> None:
    """Assert that a card is not yet due for review.

    Args:
        next_review_date: Card's next review date
        on_date: Date to check against (default: today)
        min_days: Minimum days until due

    Raises:
        AssertionError: If card is due

    Example:
        assert_card_not_due(mastered_card.next_review_date, min_days=7)
    """
    check_date = on_date or date.today()
    days_until = (next_review_date - check_date).days

    assert days_until >= min_days, (
        f"Card is due: next_review={next_review_date}, check_date={check_date}, "
        f"days_until={days_until}, min_days={min_days}"
    )


# =============================================================================
# Deck/Card Assertions
# =============================================================================


def assert_valid_deck_response(
    data: dict[str, Any],
    *,
    name: str | None = None,
    level: str | None = None,
    is_active: bool = True,
) -> None:
    """Assert that a deck response has valid structure.

    Args:
        data: Deck response data
        name: Expected deck name
        level: Expected CEFR level (A1, A2, B1, B2, C1, C2)
        is_active: Expected active status

    Raises:
        AssertionError: If validation fails
    """
    required_fields = ["id", "name", "level", "is_active", "created_at"]
    for field in required_fields:
        assert field in data, f"Missing required field: {field}"

    # UUID validation
    try:
        UUID(data["id"])
    except (ValueError, TypeError):
        raise AssertionError(f"Invalid UUID format for id: {data['id']}")

    # Level validation
    valid_levels = ["A1", "A2", "B1", "B2", "C1", "C2"]
    assert (
        data["level"] in valid_levels
    ), f"Invalid level: {data['level']}, expected one of {valid_levels}"

    # Expected values
    if name is not None:
        assert data["name"] == name, f"Expected name '{name}', got '{data['name']}'"
    if level is not None:
        assert data["level"] == level, f"Expected level '{level}', got '{data['level']}'"
    assert (
        data["is_active"] == is_active
    ), f"Expected is_active={is_active}, got {data['is_active']}"


def assert_valid_card_response(
    data: dict[str, Any],
    *,
    deck_id: str | UUID | None = None,
    front_text: str | None = None,
    back_text: str | None = None,
) -> None:
    """Assert that a card response has valid structure.

    Args:
        data: Card response data
        deck_id: Expected parent deck ID
        front_text: Expected front text
        back_text: Expected back text

    Raises:
        AssertionError: If validation fails
    """
    required_fields = ["id", "deck_id", "front_text", "back_text", "difficulty", "order_index"]
    for field in required_fields:
        assert field in data, f"Missing required field: {field}"

    # UUID validation
    for uuid_field in ["id", "deck_id"]:
        try:
            UUID(data[uuid_field])
        except (ValueError, TypeError):
            raise AssertionError(f"Invalid UUID format for {uuid_field}: {data[uuid_field]}")

    # Difficulty validation
    valid_difficulties = ["easy", "medium", "hard", "EASY", "MEDIUM", "HARD"]
    assert (
        data["difficulty"] in valid_difficulties
    ), f"Invalid difficulty: {data['difficulty']}, expected one of {valid_difficulties}"

    # Expected values
    if deck_id is not None:
        assert str(data["deck_id"]) == str(
            deck_id
        ), f"Expected deck_id '{deck_id}', got '{data['deck_id']}'"
    if front_text is not None:
        assert (
            data["front_text"] == front_text
        ), f"Expected front_text '{front_text}', got '{data['front_text']}'"
    if back_text is not None:
        assert (
            data["back_text"] == back_text
        ), f"Expected back_text '{back_text}', got '{data['back_text']}'"


# =============================================================================
# Progress Assertions
# =============================================================================


def assert_valid_progress_response(
    data: dict[str, Any],
    *,
    user_id: str | UUID | None = None,
    deck_id: str | UUID | None = None,
    min_cards_studied: int | None = None,
    min_cards_mastered: int | None = None,
) -> None:
    """Assert that a progress response has valid structure.

    Args:
        data: Progress response data
        user_id: Expected user ID
        deck_id: Expected deck ID
        min_cards_studied: Minimum cards studied count
        min_cards_mastered: Minimum cards mastered count

    Raises:
        AssertionError: If validation fails
    """
    required_fields = ["id", "user_id", "deck_id", "cards_studied", "cards_mastered"]
    for field in required_fields:
        assert field in data, f"Missing required field: {field}"

    # Count validation
    assert (
        data["cards_studied"] >= 0
    ), f"cards_studied must be non-negative: {data['cards_studied']}"
    assert (
        data["cards_mastered"] >= 0
    ), f"cards_mastered must be non-negative: {data['cards_mastered']}"
    assert (
        data["cards_mastered"] <= data["cards_studied"]
    ), f"cards_mastered ({data['cards_mastered']}) > cards_studied ({data['cards_studied']})"

    # Expected values
    if user_id is not None:
        assert str(data["user_id"]) == str(
            user_id
        ), f"Expected user_id '{user_id}', got '{data['user_id']}'"
    if deck_id is not None:
        assert str(data["deck_id"]) == str(
            deck_id
        ), f"Expected deck_id '{deck_id}', got '{data['deck_id']}'"
    if min_cards_studied is not None:
        assert (
            data["cards_studied"] >= min_cards_studied
        ), f"Expected at least {min_cards_studied} cards_studied, got {data['cards_studied']}"
    if min_cards_mastered is not None:
        assert (
            data["cards_mastered"] >= min_cards_mastered
        ), f"Expected at least {min_cards_mastered} cards_mastered, got {data['cards_mastered']}"


# =============================================================================
# Module Exports
# =============================================================================

__all__ = [
    # API Response Assertions
    "assert_valid_user_response",
    "assert_valid_token_response",
    "assert_api_error",
    "assert_pagination",
    # SM-2 Algorithm Assertions
    "assert_sm2_calculation",
    "assert_card_due",
    "assert_card_not_due",
    # Deck/Card Assertions
    "assert_valid_deck_response",
    "assert_valid_card_response",
    # Progress Assertions
    "assert_valid_progress_response",
]
