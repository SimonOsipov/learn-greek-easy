"""Standard API response formatting utilities.

This module provides consistent response wrappers for all API endpoints:
- SuccessResponse[T]: Wrap successful single-item responses
- PaginatedResponse[T]: Wrap paginated list responses
- ErrorDetail / ErrorResponse: Error structure (matches middleware format)
- Helper functions for creating standardized responses

These utilities ensure a uniform response format across the API, making it
easier for clients to parse responses and handle errors consistently.

Target Response Formats:
    Success Response:
        {
            "success": true,
            "data": { ... }
        }

    Paginated Response:
        {
            "success": true,
            "data": [ ... ],
            "pagination": {
                "page": 1,
                "page_size": 20,
                "total_items": 150,
                "total_pages": 8,
                "has_next": true,
                "has_previous": false
            }
        }

    Error Response (matches middleware format):
        {
            "success": false,
            "error": {
                "code": "ERROR_CODE",
                "message": "Human-readable message",
                "request_id": "abc12345"
            }
        }

Usage:
    from src.utils.responses import (
        SuccessResponse,
        PaginatedResponse,
        create_success_response,
        create_paginated_response,
    )

    # Single item response
    return create_success_response(data=user)

    # Paginated list response
    return create_paginated_response(
        data=users,
        page=1,
        page_size=20,
        total_items=150,
    )
"""

from typing import Generic, List, Literal, Optional, TypeVar

from pydantic import BaseModel, ConfigDict, Field

# ============================================================================
# Type Variables
# ============================================================================

T = TypeVar("T")

# ============================================================================
# Pagination Models
# ============================================================================


class PaginationMeta(BaseModel):
    """Pagination metadata for list responses.

    Contains all information needed by clients to implement pagination UI:
    - Current position (page, page_size)
    - Total counts (total_items, total_pages)
    - Navigation flags (has_next, has_previous)

    Example:
        {
            "page": 2,
            "page_size": 20,
            "total_items": 150,
            "total_pages": 8,
            "has_next": true,
            "has_previous": true
        }
    """

    model_config = ConfigDict(frozen=True)

    page: int = Field(..., ge=1, description="Current page number (1-indexed)")
    page_size: int = Field(..., ge=1, le=100, description="Items per page")
    total_items: int = Field(..., ge=0, description="Total number of items")
    total_pages: int = Field(..., ge=0, description="Total number of pages")
    has_next: bool = Field(..., description="Whether more pages exist")
    has_previous: bool = Field(..., description="Whether previous pages exist")


# ============================================================================
# Success Response Models
# ============================================================================


class SuccessResponse(BaseModel, Generic[T]):
    """Standard success response wrapper.

    Wraps successful API responses with a consistent structure.
    The generic type T represents the type of the data payload.

    Example:
        {
            "success": true,
            "data": {"id": "123", "name": "Example"}
        }

    Usage:
        # In endpoint type hints for OpenAPI docs:
        @router.get("/users/{id}", response_model=SuccessResponse[UserResponse])
        async def get_user(id: UUID) -> SuccessResponse[UserResponse]:
            ...
    """

    success: Literal[True] = True
    data: T


class PaginatedResponse(BaseModel, Generic[T]):
    """Paginated list response wrapper.

    Wraps paginated API responses with data list and pagination metadata.
    The generic type T represents the type of items in the data list.

    Example:
        {
            "success": true,
            "data": [{"id": "1"}, {"id": "2"}],
            "pagination": {
                "page": 1,
                "page_size": 20,
                "total_items": 150,
                "total_pages": 8,
                "has_next": true,
                "has_previous": false
            }
        }

    Usage:
        # In endpoint type hints for OpenAPI docs:
        @router.get("/users", response_model=PaginatedResponse[UserResponse])
        async def list_users(page: int = 1) -> PaginatedResponse[UserResponse]:
            ...
    """

    success: Literal[True] = True
    data: List[T]
    pagination: PaginationMeta


# ============================================================================
# Error Response Models (for OpenAPI documentation)
# ============================================================================


class ErrorDetail(BaseModel):
    """Error detail structure matching middleware format.

    This model is primarily used for OpenAPI documentation to describe
    the error response format. Actual error responses are typically
    generated by the ErrorHandlingMiddleware or exception handlers.

    Attributes:
        code: Error code identifier (e.g., "VALIDATION_ERROR", "NOT_FOUND")
        message: Human-readable error message
        request_id: Correlation ID for tracking/debugging
        debug: Optional debug information (only in debug mode)
    """

    code: str = Field(..., description="Error code identifier")
    message: str = Field(..., description="Human-readable error message")
    request_id: str = Field(..., description="Request correlation ID")
    debug: Optional[dict] = Field(None, description="Debug information (only in debug mode)")


class ErrorResponse(BaseModel):
    """Standard error response wrapper.

    Used for OpenAPI documentation to describe error response format.
    Matches the format produced by ErrorHandlingMiddleware.

    Example:
        {
            "success": false,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Invalid input data",
                "request_id": "abc12345"
            }
        }

    Usage in OpenAPI:
        @router.post(
            "/users",
            responses={
                400: {"model": ErrorResponse, "description": "Validation error"},
                500: {"model": ErrorResponse, "description": "Internal error"},
            }
        )
    """

    success: Literal[False] = False
    error: ErrorDetail


# ============================================================================
# Helper Functions
# ============================================================================


def create_success_response(data: T) -> dict:
    """Create a success response dictionary.

    Wraps data in the standard success response format. The returned
    dictionary will be serialized by FastAPI's JSONResponse.

    Args:
        data: The response data. Can be any JSON-serializable type:
            - dict
            - list
            - Pydantic model (FastAPI serializes automatically)
            - scalar values

    Returns:
        Dictionary with structure: {"success": True, "data": <data>}

    Examples:
        >>> create_success_response({"id": 1, "name": "Test"})
        {'success': True, 'data': {'id': 1, 'name': 'Test'}}

        >>> create_success_response([1, 2, 3])
        {'success': True, 'data': [1, 2, 3]}

        >>> create_success_response(None)
        {'success': True, 'data': None}
    """
    return {"success": True, "data": data}


def create_paginated_response(
    data: List[T],
    page: int,
    page_size: int,
    total_items: int,
) -> dict:
    """Create a paginated response dictionary.

    Wraps list data with pagination metadata. Automatically calculates
    total_pages, has_next, and has_previous based on the provided parameters.

    Args:
        data: List of items for the current page.
        page: Current page number (1-indexed).
        page_size: Number of items per page.
        total_items: Total count of all items across all pages.

    Returns:
        Dictionary with structure:
        {
            "success": True,
            "data": [...],
            "pagination": {
                "page": <page>,
                "page_size": <page_size>,
                "total_items": <total_items>,
                "total_pages": <calculated>,
                "has_next": <calculated>,
                "has_previous": <calculated>
            }
        }

    Examples:
        >>> create_paginated_response([1, 2, 3], page=1, page_size=20, total_items=150)
        {
            'success': True,
            'data': [1, 2, 3],
            'pagination': {
                'page': 1,
                'page_size': 20,
                'total_items': 150,
                'total_pages': 8,
                'has_next': True,
                'has_previous': False
            }
        }

        >>> create_paginated_response([], page=1, page_size=20, total_items=0)
        {
            'success': True,
            'data': [],
            'pagination': {
                'page': 1,
                'page_size': 20,
                'total_items': 0,
                'total_pages': 0,
                'has_next': False,
                'has_previous': False
            }
        }
    """
    # Calculate total pages using ceiling division
    # Formula: (total + size - 1) // size handles edge cases correctly
    total_pages = (total_items + page_size - 1) // page_size if page_size > 0 else 0

    return {
        "success": True,
        "data": data,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total_items": total_items,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_previous": page > 1,
        },
    }


def create_error_response(
    code: str,
    message: str,
    request_id: str = "unknown",
    debug: Optional[dict] = None,
) -> dict:
    """Create an error response dictionary.

    Creates an error response matching the format used by ErrorHandlingMiddleware.
    This function is provided for edge cases where manual error responses are
    needed outside of the normal exception handling flow.

    Note:
        For most error handling, prefer raising exceptions and letting the
        exception handlers/middleware format the response. This function is
        for special cases like streaming responses or custom error scenarios.

    Args:
        code: Error code identifier (e.g., "VALIDATION_ERROR", "NOT_FOUND").
            Should be uppercase with underscores.
        message: Human-readable error message describing what went wrong.
        request_id: Request correlation ID for tracking. Defaults to "unknown"
            if not provided.
        debug: Optional dictionary with debug information. Only include in
            development/debug mode to avoid leaking sensitive details.

    Returns:
        Dictionary with structure:
        {
            "success": False,
            "error": {
                "code": <code>,
                "message": <message>,
                "request_id": <request_id>,
                "debug": <debug>  # Only if provided
            }
        }

    Examples:
        >>> create_error_response("NOT_FOUND", "User not found", "req-123")
        {
            'success': False,
            'error': {
                'code': 'NOT_FOUND',
                'message': 'User not found',
                'request_id': 'req-123'
            }
        }

        >>> create_error_response(
        ...     "INTERNAL_ERROR",
        ...     "Something went wrong",
        ...     "req-456",
        ...     debug={"traceback": ["line1", "line2"]}
        ... )
        {
            'success': False,
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': 'Something went wrong',
                'request_id': 'req-456',
                'debug': {'traceback': ['line1', 'line2']}
            }
        }
    """
    error: dict = {
        "code": code,
        "message": message,
        "request_id": request_id,
    }

    # Only include debug field if explicitly provided
    if debug is not None:
        error["debug"] = debug

    return {"success": False, "error": error}
