"""News item factory for tests.

This module provides factory-boy based factories for generating test NewsItem data:
- NewsItemFactory: News items linked to a Situation + SituationDescription

Usage:
    from tests.factories import NewsItemFactory

    # Create a news item (auto-creates Situation+SituationDescription)
    news_item = await NewsItemFactory.create()

    # Create an old news item (30 days ago)
    old_news_item = await NewsItemFactory.create(old=True)
"""

from datetime import date, timedelta
from uuid import uuid4

import factory

from src.db.models import DescriptionSourceType, NewsItem
from tests.factories.base import BaseFactory
from tests.factories.situation import SituationFactory
from tests.factories.situation_description import SituationDescriptionFactory


class NewsItemFactory(BaseFactory):
    """Factory for NewsItem model.

    Creates news items linked to a Situation and SituationDescription.
    The create() classmethod auto-creates the linked Situation and
    SituationDescription when situation_id is not provided.

    Attributes:
        publication_date: Today's date by default
        original_article_url: Unique URL per instance

    Traits:
        old: Sets publication_date to 30 days ago
    """

    class Meta:
        model = NewsItem

    publication_date = factory.LazyFunction(date.today)
    original_article_url = factory.LazyAttribute(
        lambda o: f"https://example.com/article-{uuid4().hex[:8]}"
    )

    class Params:
        old = factory.Trait(
            publication_date=factory.LazyFunction(lambda: date.today() - timedelta(days=30))
        )

    @classmethod
    async def create(cls, session=None, **kwargs):
        if "original_article_url" not in kwargs:
            kwargs["original_article_url"] = f"https://example.com/article-{uuid4().hex[:8]}"
        if kwargs.get("situation_id") is None:
            situation = await SituationFactory.create(session=session, ready=True)
            kwargs["situation_id"] = situation.id
            await SituationDescriptionFactory.create(
                session=session,
                situation_id=situation.id,
                source_type=DescriptionSourceType.NEWS,
                source_url=kwargs["original_article_url"],
            )
        else:
            # Caller provided a situation_id — ensure a SituationDescription exists for it
            await SituationDescriptionFactory.create(
                session=session,
                situation_id=kwargs["situation_id"],
                source_type=DescriptionSourceType.NEWS,
                source_url=kwargs["original_article_url"],
            )
        return await super().create(session=session, **kwargs)


# ============================================================================
# Module Exports
# ============================================================================

__all__ = ["NewsItemFactory"]
