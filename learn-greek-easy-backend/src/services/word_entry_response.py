from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING, Optional

from src.schemas.word_entry import WordEntryResponse
from src.services.s3_service import S3Service, get_s3_service

if TYPE_CHECKING:
    from src.db.models import AudioStatus, WordEntry

STALE_GENERATING_THRESHOLD = timedelta(minutes=5)


def _resolve_audio_status(
    status: "AudioStatus",
    generating_since: datetime | None,
) -> str:
    from src.db.models import AudioStatus

    if status == AudioStatus.GENERATING:
        if generating_since is not None:
            elapsed = datetime.now(timezone.utc) - generating_since
            if elapsed > STALE_GENERATING_THRESHOLD:
                return str(AudioStatus.FAILED.value)
        return str(AudioStatus.GENERATING.value)
    return str(status.value)


def _resolve_example_audio_status(
    example_audio_status: str | None,
    example_audio_key: str | None,
    generating_since: datetime | None,
) -> str:
    if example_audio_status is not None:
        if example_audio_status.lower() == "generating":
            if generating_since is not None:
                elapsed = datetime.now(timezone.utc) - generating_since
                if elapsed > STALE_GENERATING_THRESHOLD:
                    return "failed"
            return "generating"
        return example_audio_status.lower()
    return "ready" if example_audio_key else "missing"


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
    response.audio_status = _resolve_audio_status(
        entry.audio_status,
        entry.audio_generating_since,
    )

    if response.examples:
        raw_examples = entry.examples or []
        for i, example in enumerate(response.examples):
            example.audio_url = s3.generate_presigned_url(example.audio_key)
            raw_ex = raw_examples[i] if i < len(raw_examples) else {}
            example.audio_status = _resolve_example_audio_status(
                raw_ex.get("audio_status"),
                raw_ex.get("audio_key"),
                entry.audio_generating_since,
            )

    return response
