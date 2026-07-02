"""Deck cover-image URL helpers, shared across the deck endpoints (PERF-15-02).

Extracted verbatim from ``src.api.v1.decks`` (``_deck_cover_url`` /
``_deck_cover_variants``, decks.py:78-92) so the same presigned-URL logic
isn't duplicated across the 5 deck response call sites.
"""

from __future__ import annotations

from src.db.models import Deck
from src.services.s3_service import S3Service


def deck_cover_url(deck: Deck, s3: S3Service) -> str | None:
    if not deck.cover_image_s3_key:
        return None
    # 30-day expiry (matches avatar URLs in auth.py). Cover images are stable,
    # long-lived assets. The default 24h expiry is only 600s longer than the
    # in-process URL cache window, so stale-cached URLs expire mid-flight and S3
    # returns 403 -> intermittently missing cover images.
    return s3.generate_presigned_url(deck.cover_image_s3_key, expiry_seconds=2592000)


def deck_cover_variants(deck: Deck, s3: S3Service) -> dict[int, str] | None:
    if not deck.cover_image_s3_key:
        return None
    raw = s3.get_derivative_presigned_urls(deck.cover_image_s3_key)
    return raw if isinstance(raw, dict) and raw else None


__all__ = ["deck_cover_url", "deck_cover_variants"]
