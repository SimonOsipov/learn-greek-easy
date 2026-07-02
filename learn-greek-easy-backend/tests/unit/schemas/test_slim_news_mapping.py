"""Mode A RED tests for the SlimNews.from_full mapper (PERF-15-02, AC-3).

SlimNews (src/schemas/dashboard.py, PERF-15-01) is deliberately a slim
subset of NewsItemResponse for the dashboard feed. This module locks the
mapping contract: from_full must carry the card-rendering fields and must
never grow the heavy reader-only fields (word_timestamps, word_timestamps_a2,
description_el, linked_situation, audio_url).

RED reason: SlimNews.from_full is currently a stub that raises
NotImplementedError (src/schemas/dashboard.py) until the PERF-15-02 executor
implements the real field mapping.
"""

from datetime import date, datetime, timezone
from uuid import uuid4

import pytest

from src.db.models import NewsItemStatus
from src.schemas.dashboard import SlimNews
from src.schemas.news_item import LinkedSituationSummary, NewsItemResponse


def _full_news_item_response() -> NewsItemResponse:
    """Build a full NewsItemResponse with every heavy field populated."""
    linked = LinkedSituationSummary(
        id=uuid4(),
        title_en="English title",
        title_el="Ελληνικός τίτλος",
        status="ready",
        levels=["B1"],
        country="cyprus",
        role_count=2,
        role_names=["Alex", "Maria"],
        turn_count=4,
        exercise_count=6,
        audio_seconds=42.0,
    )
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return NewsItemResponse(
        id=uuid4(),
        situation_id=uuid4(),
        title_el="Τίτλος",
        title_en="Title",
        title_ru="Заголовок",
        description_el="Πλήρης περιγραφή του άρθρου.",
        description_en="Full article description.",
        description_ru="Полное описание статьи.",
        publication_date=date(2026, 1, 1),
        original_article_url="https://example.com/article",
        country="cyprus",
        image_url="https://example.com/image.jpg",
        audio_url="https://example.com/audio.mp3",
        audio_duration_seconds=30.0,
        audio_file_size_bytes=1024,
        title_el_a2="Απλός τίτλος",
        description_el_a2="Απλή περιγραφή.",
        audio_a2_url="https://example.com/audio-a2.mp3",
        audio_a2_duration_seconds=25.0,
        audio_a2_file_size_bytes=900,
        word_timestamps=[{"word": "Τίτλος", "start_ms": 0, "end_ms": 400}],
        word_timestamps_a2=[{"word": "Απλός", "start_ms": 0, "end_ms": 300}],
        status=NewsItemStatus.PUBLISHED,
        image_variants={320: "https://example.com/image-320.webp"},
        linked_situation=linked,
        created_at=now,
        updated_at=now,
    )


@pytest.mark.unit
class TestSlimNewsFromFull:
    """AC-3: SlimNews.from_full maps a full NewsItemResponse onto the slim DTO."""

    def test_slim_news_mapping_from_full(self) -> None:
        """from_full carries only the card-rendering fields, values intact.

        RED: from_full is a stub that raises NotImplementedError.
        """
        full = _full_news_item_response()

        slim = SlimNews.from_full(full)

        assert slim.id == full.id
        assert slim.situation_id == full.situation_id
        assert slim.title_el == full.title_el
        assert slim.title_en == full.title_en
        assert slim.title_ru == full.title_ru
        assert slim.publication_date == full.publication_date
        assert slim.country == full.country
        assert slim.audio_duration_seconds == full.audio_duration_seconds
        assert slim.image_url == full.image_url
        assert slim.image_variants == full.image_variants

    def test_slim_news_has_no_heavy_fields(self) -> None:
        """Structural guard: SlimNews must never grow the heavy reader-only
        fields carried by the full NewsItemResponse DTO.

        Independent of the mapper — passes today and stays green; it exists
        to catch future schema drift (e.g. someone adding word_timestamps
        back onto SlimNews "for convenience").
        """
        heavy_fields = {
            "word_timestamps",
            "word_timestamps_a2",
            "description_el",
            "linked_situation",
            "audio_url",
        }
        assert heavy_fields.isdisjoint(SlimNews.model_fields.keys())
