"""E2E (End-to-End) API Tests.

This package contains comprehensive end-to-end tests that validate
complete user workflows and business scenarios through the API.

Directory Structure:
    workflows/    - User journey tests (registration -> learning -> mastery)
    scenarios/    - Business scenario tests (multi-deck learning, etc.)
    edge_cases/   - Edge case tests (concurrent reviews, boundary conditions)

Usage:
    # Run all E2E tests
    pytest tests/e2e/ -v

    # Run specific test type
    pytest tests/e2e/workflows/ -v
    pytest tests/e2e/ -m scenario -v

    # Run with specific marker
    pytest -m e2e -v
"""
