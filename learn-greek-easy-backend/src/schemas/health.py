"""Health check response schemas."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class HealthStatus(str, Enum):
    """Health status values."""

    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"
    DEGRADED = "degraded"


class ComponentStatus(str, Enum):
    """Individual component status values."""

    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"
    WARNING = "warning"


class ComponentHealth(BaseModel):
    """Health status of a single component."""

    status: ComponentStatus
    latency_ms: Optional[float] = Field(
        default=None,
        description="Response time in milliseconds",
    )
    message: str = Field(description="Human-readable status message")


class MemoryHealth(BaseModel):
    """Memory health information."""

    status: ComponentStatus
    used_mb: float = Field(description="Memory used in megabytes")
    percent: float = Field(description="Memory usage percentage")
    message: str = Field(description="Human-readable status message")


class HealthChecks(BaseModel):
    """Collection of component health checks."""

    database: ComponentHealth
    redis: ComponentHealth
    memory: MemoryHealth


class HealthResponse(BaseModel):
    """Full health check response."""

    status: HealthStatus = Field(description="Overall health status")
    version: str = Field(description="Application version")
    environment: str = Field(description="Current environment")
    timestamp: datetime = Field(description="Health check timestamp")
    uptime_seconds: float = Field(description="Application uptime in seconds")
    checks: HealthChecks = Field(description="Individual component checks")

    model_config = {
        "json_schema_extra": {
            "example": {
                "status": "healthy",
                "version": "0.1.0",
                "environment": "development",
                "timestamp": "2024-12-02T10:30:00Z",
                "uptime_seconds": 3600,
                "checks": {
                    "database": {
                        "status": "healthy",
                        "latency_ms": 5.2,
                        "message": "Connection successful",
                    },
                    "redis": {"status": "healthy", "latency_ms": 1.1, "message": "PONG received"},
                    "memory": {
                        "status": "healthy",
                        "used_mb": 128.5,
                        "percent": 45.2,
                        "message": "Memory usage normal",
                    },
                },
            }
        }
    }


class LivenessResponse(BaseModel):
    """Liveness probe response."""

    status: str = Field(default="alive", description="Liveness status")
    timestamp: datetime = Field(description="Check timestamp")

    model_config = {
        "json_schema_extra": {"example": {"status": "alive", "timestamp": "2024-12-02T10:30:00Z"}}
    }


class ReadinessChecks(BaseModel):
    """Readiness check results."""

    database: bool = Field(description="Database ready")
    redis: bool = Field(description="Redis ready")


class ReadinessResponse(BaseModel):
    """Readiness probe response."""

    status: str = Field(description="Readiness status: ready or not_ready")
    timestamp: datetime = Field(description="Check timestamp")
    checks: ReadinessChecks = Field(description="Component readiness")

    model_config = {
        "json_schema_extra": {
            "example": {
                "status": "ready",
                "timestamp": "2024-12-02T10:30:00Z",
                "checks": {"database": True, "redis": True},
            }
        }
    }
