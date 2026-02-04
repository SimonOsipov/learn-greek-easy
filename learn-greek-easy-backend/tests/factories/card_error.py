"""Card error report model factories.

This module provides factories for card error report models:
- CardErrorReportFactory: User-submitted error reports for vocabulary cards or culture questions

Usage:
    # Create a PENDING vocabulary card error report
    report = await CardErrorReportFactory.create(user_id=user.id)

    # Create a culture question error report
    culture_report = await CardErrorReportFactory.create(user_id=user.id, culture=True)

    # Create a reviewed report
    reviewed = await CardErrorReportFactory.create(user_id=user.id, reviewed=True)

    # Create a fixed report with resolver
    fixed = await CardErrorReportFactory.create(
        user_id=user.id,
        resolved_by=admin.id,
        fixed=True,
    )

    # Create a dismissed report
    dismissed = await CardErrorReportFactory.create(user_id=user.id, dismissed=True)
"""

from datetime import datetime, timezone
from uuid import uuid4

import factory

from src.db.models import CardErrorCardType, CardErrorReport, CardErrorStatus
from tests.factories.base import BaseFactory, fake


class CardErrorReportFactory(BaseFactory):
    """Factory for CardErrorReport model.

    Creates user-submitted error reports for flashcards or culture questions.

    Traits:
        culture: Sets card_type to CULTURE (default is VOCABULARY)
        reviewed: Sets status to REVIEWED with resolved_by/resolved_at
        fixed: Sets status to FIXED with resolved_by/resolved_at
        dismissed: Sets status to DISMISSED with resolved_by/resolved_at

    Example:
        # Basic vocabulary error report
        report = await CardErrorReportFactory.create(user_id=user.id)

        # Culture question error report
        culture_report = await CardErrorReportFactory.create(user_id=user.id, culture=True)

        # Fixed report (requires resolved_by)
        fixed = await CardErrorReportFactory.create(
            user_id=user.id,
            resolved_by=admin.id,
            fixed=True,
        )
    """

    class Meta:
        model = CardErrorReport

    # Required: Must be provided
    user_id = None  # Must be set explicitly

    # Default values
    card_id = factory.LazyFunction(uuid4)
    card_type = CardErrorCardType.VOCABULARY
    description = factory.LazyAttribute(
        lambda _: fake.paragraph(nb_sentences=2)  # Generates description text
    )
    status = CardErrorStatus.PENDING
    admin_notes = None
    resolved_by = None
    resolved_at = None

    class Params:
        """Factory traits for common variations."""

        # Card type trait
        culture = factory.Trait(
            card_type=CardErrorCardType.CULTURE,
        )

        # Status traits with resolution info
        reviewed = factory.Trait(
            status=CardErrorStatus.REVIEWED,
            resolved_at=factory.LazyFunction(lambda: datetime.now(timezone.utc)),
        )

        fixed = factory.Trait(
            status=CardErrorStatus.FIXED,
            resolved_at=factory.LazyFunction(lambda: datetime.now(timezone.utc)),
        )

        dismissed = factory.Trait(
            status=CardErrorStatus.DISMISSED,
            resolved_at=factory.LazyFunction(lambda: datetime.now(timezone.utc)),
        )
