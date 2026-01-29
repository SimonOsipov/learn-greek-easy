"""Utility modules for Learn Greek Easy backend.

This package contains utility functions and helpers for:
- Request validation (validation.py)
- Response formatting (responses.py)
- Greek text processing (greek_text.py)
"""

from src.utils.greek_text import (
    extract_searchable_forms,
    generate_normalized_forms,
    normalize_greek_accents,
)
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
from src.utils.validation import (
    EMAIL_REGEX,
    UUID_REGEX,
    calculate_pagination_meta,
    sanitize_search_query,
    validate_pagination,
)

__all__ = [
    # Validation utilities
    "EMAIL_REGEX",
    "UUID_REGEX",
    "sanitize_search_query",
    "validate_pagination",
    "calculate_pagination_meta",
    # Response models
    "SuccessResponse",
    "PaginatedResponse",
    "PaginationMeta",
    "ErrorResponse",
    "ErrorDetail",
    # Response helper functions
    "create_success_response",
    "create_paginated_response",
    "create_error_response",
    # Greek text utilities
    "normalize_greek_accents",
    "extract_searchable_forms",
    "generate_normalized_forms",
]
