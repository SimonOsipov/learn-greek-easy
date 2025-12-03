"""Test helpers for Learn Greek Easy.

This package provides utility functions and helpers for testing:
- database: Database utilities (existing)
- assertions: Custom assertion helpers
- time: Time manipulation utilities
- api: API testing helpers
- mocks: Mock builders

Usage:
    from tests.helpers import (
        # Assertions
        assert_valid_user_response,
        assert_valid_token_response,
        assert_api_error,

        # Time utilities
        freeze_time,
        create_expired_token,

        # API helpers
        make_authenticated_request,
        create_auth_headers,

        # Mocks
        mock_redis_client,
        mock_async_session,

        # Database utilities
        count_table_rows,
        utc_now,
    )
"""

# =============================================================================
# Assertion Helpers
# =============================================================================

from tests.helpers.assertions import (
    assert_api_error,
    assert_card_due,
    assert_card_not_due,
    assert_pagination,
    assert_sm2_calculation,
    assert_valid_card_response,
    assert_valid_deck_response,
    assert_valid_progress_response,
    assert_valid_token_response,
    assert_valid_user_response,
)

# =============================================================================
# API Helpers
# =============================================================================

from tests.helpers.api import (
    assert_json_response,
    assert_status_code,
    assert_success_response,
    build_filter_params,
    build_pagination_params,
    build_query_params,
    build_url_with_params,
    create_auth_headers,
    extract_tokens_from_response,
    extract_user_id_from_response,
    make_authenticated_request,
    make_request_without_auth,
)

# =============================================================================
# Database Helpers
# =============================================================================

from tests.helpers.database import (
    clear_table,
    count_table_rows,
    days_ago,
    days_from_now,
    get_database_info,
    get_enum_values,
    get_table_names,
    get_test_database_url,
    reset_sequences,
    table_exists,
    utc_now,
    verify_connection,
    verify_extensions,
)

# =============================================================================
# Mock Helpers
# =============================================================================

from tests.helpers.mocks import (
    configure_redis_cache,
    mock_async_session,
    mock_auth_service,
    mock_email_service,
    mock_external_api,
    mock_http_response,
    mock_redis_client,
)

# =============================================================================
# Time Helpers
# =============================================================================

from tests.helpers.time import (
    advance_time,
    calculate_sm2_interval,
    create_due_date,
    create_expired_token,
    create_future_date,
    create_future_token,
    create_overdue_date,
    freeze_time,
    get_month_range,
    get_today_range,
    get_token_expiration,
    get_week_range,
    past_time,
)

# =============================================================================
# Module Exports
# =============================================================================

__all__ = [
    # assertions
    "assert_api_error",
    "assert_card_due",
    "assert_card_not_due",
    "assert_pagination",
    "assert_sm2_calculation",
    "assert_valid_card_response",
    "assert_valid_deck_response",
    "assert_valid_progress_response",
    "assert_valid_token_response",
    "assert_valid_user_response",
    # api
    "assert_json_response",
    "assert_status_code",
    "assert_success_response",
    "build_filter_params",
    "build_pagination_params",
    "build_query_params",
    "build_url_with_params",
    "create_auth_headers",
    "extract_tokens_from_response",
    "extract_user_id_from_response",
    "make_authenticated_request",
    "make_request_without_auth",
    # database
    "clear_table",
    "count_table_rows",
    "days_ago",
    "days_from_now",
    "get_database_info",
    "get_enum_values",
    "get_table_names",
    "get_test_database_url",
    "reset_sequences",
    "table_exists",
    "utc_now",
    "verify_connection",
    "verify_extensions",
    # mocks
    "configure_redis_cache",
    "mock_async_session",
    "mock_auth_service",
    "mock_email_service",
    "mock_external_api",
    "mock_http_response",
    "mock_redis_client",
    # time
    "advance_time",
    "calculate_sm2_interval",
    "create_due_date",
    "create_expired_token",
    "create_future_date",
    "create_future_token",
    "create_overdue_date",
    "freeze_time",
    "get_month_range",
    "get_today_range",
    "get_token_expiration",
    "get_week_range",
    "past_time",
]
