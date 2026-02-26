"""News item factory for tests.

This module provides factory-boy based factories for generating test NewsItem data:
- NewsItemFactory: News items with bilingual content

Usage:
    from tests.factories import NewsItemFactory

    # Create a news item
    news_item = await NewsItemFactory.create()

    # Create an old news item (30 days ago)
    old_news_item = await NewsItemFactory.create(old=True)
"""

from datetime import date, timedelta
from uuid import uuid4

import factory

from src.db.models import NewsItem
from tests.factories.base import BaseFactory


class NewsItemFactory(BaseFactory):
    """Factory for NewsItem model.

    Creates news items with trilingual titles and descriptions.

    Attributes:
        title_el: Greek title (sequential)
        title_en: English title (sequential)
        title_ru: Russian title (sequential)
        description_el: Greek description (sequential)
        description_en: English description (sequential)
        description_ru: Russian description (sequential)
        publication_date: Today's date by default
        original_article_url: Unique URL with sequential number
        image_s3_key: S3 key for the news image
        audio_s3_key: S3 key for the news audio (None by default)

    Traits:
        old: Sets publication_date to 30 days ago
        with_audio: Adds audio S3 key for testing audio features
    """

    class Meta:
        model = NewsItem

    title_el = factory.Sequence(lambda n: f"Ελληνικός Τίτλος {n}")
    title_en = factory.Sequence(lambda n: f"English Title {n}")
    title_ru = factory.Sequence(lambda n: f"Русский Заголовок {n}")
    description_el = factory.Sequence(lambda n: f"Ελληνική περιγραφή για το άρθρο {n}")
    description_en = factory.Sequence(lambda n: f"English description for article {n}")
    description_ru = factory.Sequence(lambda n: f"Русское описание для статьи {n}")
    publication_date = factory.LazyFunction(date.today)
    original_article_url = factory.Sequence(
        lambda n: f"https://example.com/article-{n}-{uuid4().hex[:8]}"
    )
    image_s3_key = factory.Sequence(lambda n: f"news-images/test-{n}.jpg")
    audio_s3_key = None
    country = "cyprus"

    class Params:
        old = factory.Trait(
            publication_date=factory.LazyFunction(lambda: date.today() - timedelta(days=30))
        )
        with_audio = factory.Trait(
            audio_s3_key=factory.Sequence(lambda n: f"news-audio/test-{n}.mp3")
        )
        greece = factory.Trait(country="greece")
        world = factory.Trait(country="world")


# ============================================================================
# Module Exports
# ============================================================================

__all__ = ["NewsItemFactory"]
