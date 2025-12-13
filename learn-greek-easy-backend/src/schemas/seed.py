"""Schemas for seed API endpoints."""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class SeedOptions(BaseModel):
    """Options for seed operations."""

    skip_truncate: bool = Field(
        default=False,
        description="Skip table truncation before seeding (use for additive seeding)",
    )


class SeedRequest(BaseModel):
    """Request body for seed operations (optional)."""

    options: Optional[SeedOptions] = Field(
        default=None,
        description="Optional seed operation configuration",
    )


class SeedStatusResponse(BaseModel):
    """Response for GET /status endpoint."""

    enabled: bool = Field(
        description="Whether seeding is currently available",
    )
    environment: str = Field(
        description="Current application environment (development/staging/production)",
    )
    requires_secret: bool = Field(
        description="Whether X-Test-Seed-Secret header is required",
    )
    validation_errors: List[str] = Field(
        default_factory=list,
        description="List of issues preventing seeding (empty if enabled)",
    )


class SeedResultResponse(BaseModel):
    """Response for POST seed operation endpoints."""

    success: bool = Field(
        description="Whether the operation completed successfully",
    )
    operation: str = Field(
        description="Name of the seed operation performed",
    )
    timestamp: datetime = Field(
        description="When the operation completed",
    )
    duration_ms: float = Field(
        description="Operation duration in milliseconds",
    )
    results: Dict[str, Any] = Field(
        description="Operation-specific result data",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "success": True,
                "operation": "all",
                "timestamp": "2024-12-13T10:30:00Z",
                "duration_ms": 1523.45,
                "results": {
                    "tables_truncated": 8,
                    "users_created": 4,
                    "decks_created": 6,
                    "cards_created": 60,
                },
            }
        }
    }
