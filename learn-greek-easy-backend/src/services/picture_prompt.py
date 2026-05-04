"""Shared picture-prompt composition helpers.

Used by both the news-create flow (``news_item_service.create``) and the
admin picture-edit endpoint (``PATCH /api/v1/admin/situations/{id}/picture``)
so that the house-style fallback rule lives in exactly one place.

The "house-style default" (``DEFAULT_PICTURE_STYLE_EN``) is env-var-driven
via ``settings.picture_house_style_default``; it is NOT frozen at import time
so that tests can ``monkeypatch.setattr(settings, "picture_house_style_default",
...)`` and the new value is honoured by every consumer.
"""

from __future__ import annotations

from src.config import settings


def get_default_picture_style_en() -> str:
    """Return the env-driven house-style default, resolved at call time."""
    return settings.picture_house_style_default


def resolve_picture_style_en(provided: str | None) -> str:
    """Return *provided* when non-empty after trim, else the house-style default.

    Mirrors the create-flow rule:
        style_en = data.style_en if (data.style_en and data.style_en.strip())
                                  else settings.picture_house_style_default
    """
    if provided and provided.strip():
        return provided
    return get_default_picture_style_en()
