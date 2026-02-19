from __future__ import annotations

from typing import TYPE_CHECKING, Optional

from src.schemas.word_entry import WordEntryResponse
from src.services.s3_service import S3Service, get_s3_service

if TYPE_CHECKING:
    from src.db.models import WordEntry


def word_entry_to_response(
    entry: "WordEntry",
    s3_service: Optional[S3Service] = None,
) -> WordEntryResponse:
    """Convert WordEntry ORM model to WordEntryResponse with presigned audio URLs.

    Follows the same pattern as NewsItemService._to_response() in news_item_service.py.
    The S3 service handles all edge cases internally (None key, empty key, unavailable S3)
    by returning None, so we call generate_presigned_url() unconditionally.

    Args:
        entry: WordEntry ORM model instance.
        s3_service: Optional injectable S3Service for testing. Defaults to singleton.

    Returns:
        WordEntryResponse with audio_url fields populated from S3 presigned URLs.
    """
    s3 = s3_service or get_s3_service()
    response = WordEntryResponse.model_validate(entry)

    response.audio_url = s3.generate_presigned_url(entry.audio_key)

    if response.examples:
        for example in response.examples:
            example.audio_url = s3.generate_presigned_url(example.audio_key)

    return response
