"""Distractor-assembly service for picture-match exercises.

Given an anchor PictureExercise, this service selects 3 random distractor
Situations from the eligible pool, resolves presigned image URLs, randomises
the correct-answer position (0–3), and returns a typed Pydantic payload ready
for serialisation.

Raises InsufficientDistractorPoolError (HTTP 409 at the API layer) when fewer
than 3 eligible distractor Situations exist for the anchor.
"""

from __future__ import annotations

import random
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.logging import get_logger
from src.db.models import (
    DescriptionStatus,
    ExerciseStatus,
    ExerciseType,
    PictureExercise,
    PictureStatus,
    Situation,
    SituationDescription,
    SituationPicture,
)
from src.schemas.exercise_payload import (
    PictureMatchOption,
    SelectDescriptionFromPicturePayload,
    SelectPictureFromDescriptionPayload,
)
from src.services.s3_service import IMAGE_PRESIGN_EXPIRY_SECONDS, get_s3_service

logger = get_logger(__name__)

# Type alias for the (picture, description) candidate pair used internally.
_Candidate = tuple[SituationPicture, SituationDescription]


class InsufficientDistractorPoolError(Exception):
    """Service-layer signal: fewer than 3 eligible distractor Situations exist for the anchor.

    The API layer maps this to InsufficientDistractorPoolException (HTTP 409).
    """


async def assemble_picture_match_payload(
    db: AsyncSession,
    exercise: PictureExercise,
    exercise_type: ExerciseType,
) -> SelectPictureFromDescriptionPayload | SelectDescriptionFromPicturePayload:
    """Assemble a 4-option picture-match payload for the given anchor PictureExercise.

    Caller must eager-load ``exercise.picture``, ``exercise.picture.situation``,
    and ``exercise.picture.situation.description`` before calling this function.

    Algorithm:
    1. Pull 3 random distractor Situations via ORDER BY random() (excludes anchor).
    2. Insert the anchor at a random position 0–3.
    3. Resolve presigned image URLs for picture options.
    4. Return the appropriate Pydantic payload model.

    TODO(perf): When eligible pool exceeds ~10k Situations, replace ORDER BY random()
    with TABLESAMPLE SYSTEM or a randomized-offset strategy to avoid O(N) full scan.

    Raises:
        ValueError: For unsupported exercise_type values.
        InsufficientDistractorPoolError: When fewer than 3 eligible distractors exist,
            or when a presigned URL cannot be generated for a required image.
    """
    if exercise_type not in (
        ExerciseType.SELECT_PICTURE_FROM_DESCRIPTION,
        ExerciseType.SELECT_DESCRIPTION_FROM_PICTURE,
    ):
        raise ValueError(f"unsupported exercise_type for picture match: {exercise_type!r}")

    anchor_picture: SituationPicture = exercise.picture
    anchor_situation: Situation = anchor_picture.situation
    anchor_situation_id = anchor_picture.situation_id

    # Caller must guarantee description is eagerly loaded and not None.
    anchor_description = anchor_situation.description
    if anchor_description is None:
        raise InsufficientDistractorPoolError(
            f"anchor situation {anchor_situation_id} has no description"
        )

    candidates = await _fetch_candidates(
        db, anchor_situation_id, anchor_picture, anchor_description, exercise_type
    )
    correct_index = candidates.index((anchor_picture, anchor_description))

    if exercise_type == ExerciseType.SELECT_PICTURE_FROM_DESCRIPTION:
        payload: SelectPictureFromDescriptionPayload | SelectDescriptionFromPicturePayload = (
            _build_select_picture_payload(anchor_description, candidates, correct_index)
        )
    else:
        payload = _build_select_description_payload(
            anchor_picture, anchor_situation_id, candidates, correct_index
        )

    logger.info(
        "assembled_picture_match_payload",
        extra={
            "anchor_situation_id": str(anchor_situation_id),
            "exercise_type": exercise_type.value,
            "correct_index": correct_index,
        },
    )
    return payload


async def _fetch_candidates(
    db: AsyncSession,
    anchor_situation_id: UUID,
    anchor_picture: SituationPicture,
    anchor_description: SituationDescription,
    exercise_type: ExerciseType,
) -> list[_Candidate]:
    """Fetch 3 random distractor pairs, then insert the anchor at a random slot.

    Returns a 4-element list of (SituationPicture, SituationDescription) pairs
    where exactly one entry is the anchor.

    Raises:
        InsufficientDistractorPoolError: Fewer than 3 eligible distractors found.
    """
    # TODO(perf): When eligible pool exceeds ~10k Situations, replace ORDER BY random()
    # with TABLESAMPLE SYSTEM or a randomized-offset strategy to avoid O(N) full scan.
    stmt = (
        select(SituationPicture, SituationDescription)
        .join(Situation, SituationPicture.situation_id == Situation.id)
        .join(SituationDescription, SituationDescription.situation_id == Situation.id)
        .join(PictureExercise, PictureExercise.picture_id == SituationPicture.id)
        .where(
            SituationPicture.status == PictureStatus.GENERATED,
            SituationDescription.status == DescriptionStatus.AUDIO_READY,
            PictureExercise.exercise_type == exercise_type,
            PictureExercise.status == ExerciseStatus.APPROVED,
            Situation.id != anchor_situation_id,
        )
        .order_by(func.random())
        .limit(3)
    )

    result = await db.execute(stmt)
    rows = result.all()

    if len(rows) < 3:
        logger.warning(
            "insufficient_distractor_pool",
            extra={
                "anchor_situation_id": str(anchor_situation_id),
                "exercise_type": exercise_type.value,
                "candidate_count": len(rows),
            },
        )
        raise InsufficientDistractorPoolError(
            f"only {len(rows)} eligible distractors for anchor {anchor_situation_id}"
        )

    # Insert anchor at a random slot among the 4 positions.
    correct_index = random.randint(0, 3)
    candidates: list[_Candidate] = []
    distractor_iter = iter(rows)
    for slot in range(4):
        if slot == correct_index:
            candidates.append((anchor_picture, anchor_description))
        else:
            sp, sd = next(distractor_iter)
            candidates.append((sp, sd))

    return candidates


def _build_select_picture_payload(
    anchor_description: SituationDescription,
    candidates: list[_Candidate],
    correct_index: int,
) -> SelectPictureFromDescriptionPayload:
    """Build SELECT_PICTURE_FROM_DESCRIPTION payload: prompt = description text, options = images."""
    s3 = get_s3_service()
    options: list[PictureMatchOption] = []
    for idx, (sp, _sd) in enumerate(candidates):
        url = s3.generate_presigned_url(
            sp.image_s3_key, expiry_seconds=IMAGE_PRESIGN_EXPIRY_SECONDS
        )
        if not url:
            raise InsufficientDistractorPoolError(
                f"failed to presign image for situation {sp.situation_id}"
            )
        variants = (
            s3.get_derivative_presigned_urls(sp.image_s3_key) or None if sp.image_s3_key else None
        )
        options.append(PictureMatchOption(option_index=idx, image_url=url, image_variants=variants))
    return SelectPictureFromDescriptionPayload(
        prompt_description=anchor_description.text_el,
        options=options,
        correct_index=correct_index,
    )


def _build_select_description_payload(
    anchor_picture: SituationPicture,
    anchor_situation_id: UUID,
    candidates: list[_Candidate],
    correct_index: int,
) -> SelectDescriptionFromPicturePayload:
    """Build SELECT_DESCRIPTION_FROM_PICTURE payload: prompt = anchor image, options = texts."""
    s3 = get_s3_service()
    anchor_url = s3.generate_presigned_url(
        anchor_picture.image_s3_key, expiry_seconds=IMAGE_PRESIGN_EXPIRY_SECONDS
    )
    if not anchor_url:
        raise InsufficientDistractorPoolError(
            f"failed to presign anchor image for situation {anchor_situation_id}"
        )
    desc_options: list[PictureMatchOption] = []
    for idx, (_sp, sd) in enumerate(candidates):
        desc_options.append(
            PictureMatchOption(
                option_index=idx,
                description_text=sd.text_el,
            )
        )
    return SelectDescriptionFromPicturePayload(
        anchor_image_url=anchor_url,
        options=desc_options,
        correct_index=correct_index,
    )
