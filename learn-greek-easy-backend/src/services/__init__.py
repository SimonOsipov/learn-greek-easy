"""Service layer for business logic implementation.

Services encapsulate complex business operations and coordinate
between multiple repositories/models. They handle transactions,
business rules validation, and domain logic.
"""

from src.services.auth_service import AuthService

__all__ = ["AuthService"]