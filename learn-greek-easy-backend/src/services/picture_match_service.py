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

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import load_only

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


async def load_distractor_pool(db: AsyncSession, exercise_type: ExerciseType) -> list[_Candidate]:
    """Load the full eligible distractor pool for ``exercise_type`` in one query.

    Returns every eligible (SituationPicture, SituationDescription) pair for the
    given exercise-type — the same eligibility filters as the former per-item
    distractor query MINUS the anchor-situation exclusion and MINUS
    ``ORDER BY random()``/``LIMIT``. The caller fetches this once per distinct
    exercise-type per queue build and passes it into ``assemble_picture_match_payload``
    via the ``pool`` kwarg, so no per-item distractor query is issued.

    Uses a full-entity ``select(SituationPicture, SituationDescription)`` with
    ``load_only`` (not raw columns) so the returned rows honour the ``_Candidate``
    tuple contract and the payload builders' ORM attribute access
    (``sp.image_s3_key`` / ``sd.text_el``) keeps working unchanged. ``load_only``
    trims to just the columns those builders read (avoiding a full-row fetch),
    mirroring the house pattern in ``card_record.py`` ``get_by_deck`` — so no
    relationship IO happens in the per-item loop.
    """
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
        )
        .options(
            load_only(SituationPicture.image_s3_key, SituationPicture.situation_id),
            load_only(SituationDescription.text_el, SituationDescription.situation_id),
        )
    )

    result = await db.execute(stmt)
    return [(sp, sd) for sp, sd in result.all()]


async def assemble_picture_match_payload(
    db: AsyncSession,
    exercise: PictureExercise,
    exercise_type: ExerciseType,
    *,
    pool: list[_Candidate],
) -> SelectPictureFromDescriptionPayload | SelectDescriptionFromPicturePayload:
    """Assemble a 4-option picture-match payload for the given anchor PictureExercise.

    Caller must eager-load ``exercise.picture``, ``exercise.picture.situation``,
    and ``exercise.picture.situation.description`` before calling this function,
    and pass the pre-fetched distractor ``pool`` (see ``load_distractor_pool``)
    for this exercise-type so no per-item distractor query is issued.

    Algorithm:
    1. Select 3 random distractor Situations from ``pool`` (excludes the anchor).
    2. Insert the anchor at a random position 0–3.
    3. Resolve presigned image URLs for picture options.
    4. Return the appropriate Pydantic payload model.

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

    candidates = _fetch_candidates(pool, anchor_situation_id, anchor_picture, anchor_description)
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


def _fetch_candidates(
    pool: list[_Candidate],
    anchor_situation_id: UUID,
    anchor_picture: SituationPicture,
    anchor_description: SituationDescription,
) -> list[_Candidate]:
    """Pick 3 random distractor pairs from ``pool``, then insert the anchor at a random slot.

    ``pool`` is the pre-fetched eligible (SituationPicture, SituationDescription)
    set for this exercise-type (see ``load_distractor_pool``). The anchor's own
    situation is excluded here in Python — the pool query is anchor-agnostic — and
    3 distractors are chosen via ``random.sample``, replacing the former per-item
    ``ORDER BY random()`` distractor query.

    Returns a 4-element list of (SituationPicture, SituationDescription) pairs
    where exactly one entry is the anchor.

    Raises:
        InsufficientDistractorPoolError: Fewer than 3 eligible distractors found.
    """
    eligible: list[_Candidate] = [
        (sp, sd) for (sp, sd) in pool if sp.situation_id != anchor_situation_id
    ]

    if len(eligible) < 3:
        logger.warning(
            "insufficient_distractor_pool",
            extra={
                "anchor_situation_id": str(anchor_situation_id),
                "candidate_count": len(eligible),
            },
        )
        raise InsufficientDistractorPoolError(
            f"only {len(eligible)} eligible distractors for anchor {anchor_situation_id}"
        )

    distractors = random.sample(eligible, 3)

    # Insert anchor at a random slot among the 4 positions.
    correct_index = random.randint(0, 3)
    candidates: list[_Candidate] = []
    distractor_iter = iter(distractors)
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
        _raw_variants = (
            s3.get_derivative_presigned_urls(sp.image_s3_key) if sp.image_s3_key else None
        )
        variants = _raw_variants if isinstance(_raw_variants, dict) else None
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
