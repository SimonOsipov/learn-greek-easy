"""Request validation utilities for complex scenarios beyond Pydantic.

This module provides:
- Regex patterns for common validations (email, UUID)
- Pagination parameter validation with offset/limit calculation
- Search query sanitization for safe database queries

These utilities complement Pydantic's automatic validation for scenarios
where manual validation or transformation is needed.

Usage:
    from src.utils.validation import (
        EMAIL_REGEX,
        UUID_REGEX,
        validate_pagination,
        sanitize_search_query,
    )

    # Validate email format outside of Pydantic
    if EMAIL_REGEX.match(user_input):
        process_email(user_input)

    # Convert pagination params to offset/limit
    offset, limit = validate_pagination(page=2, page_size=20)
    # Result: offset=20, limit=20

    # Sanitize search input
    clean_query = sanitize_search_query("  user%input_  ")
    # Result: "userinput"
"""

import re
from typing import Tuple

# ============================================================================
# Regex Patterns
# ============================================================================

# Email regex pattern - RFC 5322 simplified
# Matches: user@domain.com, user.name+tag@sub.domain.co.uk
# Does not match: invalid emails, missing TLD, special chars in wrong places
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")

# UUID v4 regex pattern (case-insensitive)
# Matches: 550e8400-e29b-41d4-a716-446655440000
# Also matches uppercase: 550E8400-E29B-41D4-A716-446655440000
UUID_REGEX = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


# ============================================================================
# Pagination Validation
# ============================================================================


def validate_pagination(
    page: int,
    page_size: int,
    max_page_size: int = 100,
) -> Tuple[int, int]:
    """Validate and normalize pagination parameters.

    Converts user-friendly page/page_size parameters to database-friendly
    offset/limit values. Enforces minimum and maximum constraints.

    Args:
        page: Page number (1-indexed). Must be >= 1.
        page_size: Number of items per page. Must be >= 1.
        max_page_size: Maximum allowed page size. Defaults to 100.
            If page_size exceeds this, it will be capped (not raise error).

    Returns:
        Tuple of (offset, limit) for database queries:
        - offset: Number of items to skip (0-indexed)
        - limit: Maximum items to return (capped at max_page_size)

    Raises:
        ValueError: If page < 1 or page_size < 1.

    Examples:
        >>> validate_pagination(page=1, page_size=20)
        (0, 20)

        >>> validate_pagination(page=2, page_size=20)
        (20, 20)

        >>> validate_pagination(page=3, page_size=50)
        (100, 50)

        >>> validate_pagination(page=1, page_size=500, max_page_size=100)
        (0, 100)  # Capped at max_page_size

        >>> validate_pagination(page=0, page_size=20)
        ValueError: Page must be >= 1
    """
    if page < 1:
        raise ValueError("Page must be >= 1")
    if page_size < 1:
        raise ValueError("Page size must be >= 1")

    # Cap page_size at maximum (don't raise, just cap)
    if page_size > max_page_size:
        page_size = max_page_size

    # Calculate offset (0-indexed)
    offset = (page - 1) * page_size

    return offset, page_size


def calculate_pagination_meta(
    page: int,
    page_size: int,
    total_items: int,
) -> dict:
    """Calculate pagination metadata from query parameters.

    Computes pagination metadata including total_pages, has_next, and
    has_previous based on the current page position and total item count.
    This is useful when building paginated response objects.

    Args:
        page: Current page number (1-indexed).
        page_size: Number of items per page.
        total_items: Total count of all items.

    Returns:
        Dictionary with pagination metadata fields:
        - page: Current page number
        - page_size: Items per page
        - total_items: Total count
        - total_pages: Calculated total pages
        - has_next: Whether more pages exist after current
        - has_previous: Whether pages exist before current

    Examples:
        >>> calculate_pagination_meta(page=1, page_size=20, total_items=150)
        {
            "page": 1,
            "page_size": 20,
            "total_items": 150,
            "total_pages": 8,
            "has_next": True,
            "has_previous": False,
        }

        >>> calculate_pagination_meta(page=4, page_size=20, total_items=150)
        {
            "page": 4,
            "page_size": 20,
            "total_items": 150,
            "total_pages": 8,
            "has_next": True,
            "has_previous": True,
        }

        >>> calculate_pagination_meta(page=1, page_size=20, total_items=0)
        {
            "page": 1,
            "page_size": 20,
            "total_items": 0,
            "total_pages": 0,
            "has_next": False,
            "has_previous": False,
        }
    """
    # Calculate total pages using ceiling division
    # Formula: (total + size - 1) // size handles edge cases correctly
    total_pages = (total_items + page_size - 1) // page_size if page_size > 0 else 0

    return {
        "page": page,
        "page_size": page_size,
        "total_items": total_items,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_previous": page > 1,
    }


# ============================================================================
# Search Query Sanitization
# ============================================================================


def sanitize_search_query(
    query: str,
    max_length: int = 100,
) -> str:
    """Sanitize user search query for safe database operations.

    Cleans user input by:
    1. Stripping leading/trailing whitespace
    2. Truncating to max_length
    3. Removing SQL LIKE wildcard characters (%, _, \\)

    Note: SQLAlchemy's parameterized queries already prevent SQL injection.
    This function specifically handles LIKE pattern injection where
    % and _ have special meaning.

    Args:
        query: Raw user search query.
        max_length: Maximum allowed length. Defaults to 100.
            Query is truncated AFTER stripping whitespace.

    Returns:
        Sanitized query string safe for LIKE operations.
        Returns empty string if input is empty after sanitization.

    Examples:
        >>> sanitize_search_query("  hello world  ")
        'hello world'

        >>> sanitize_search_query("search%term")
        'searchterm'

        >>> sanitize_search_query("user_input")
        'userinput'

        >>> sanitize_search_query("test\\query")
        'testquery'

        >>> sanitize_search_query("a" * 200, max_length=100)
        'a' * 100  # Truncated

        >>> sanitize_search_query("   ")
        ''  # Empty after strip
    """
    # Strip whitespace first
    query = query.strip()

    # Truncate to max length
    query = query[:max_length]

    # Remove SQL LIKE special characters
    # % - matches any sequence of characters
    # _ - matches any single character
    # \ - escape character
    query = re.sub(r"[%_\\]", "", query)

    return query
