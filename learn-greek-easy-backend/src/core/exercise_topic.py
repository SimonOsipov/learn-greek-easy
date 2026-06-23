"""Deterministic exercise topic taxonomy (SIT-27-03).

Public surface:
  ExerciseTopic           — str-enum of the four learner-facing topics
  derive_exercise_topic   — pure (source_type, modality) -> ExerciseTopic

The mapping is total and deterministic: every (source_type, modality) pair —
including ``modality=None`` (which the exercises endpoint passes for
dialog/picture items that are not enriched) — resolves to exactly one topic.

Derivation rule (SIT-27 architecture Decision #4):
  1. modality == LISTENING                            -> Listening  (wins over source)
  2. else source_type == DIALOG                       -> Dialogue
  3. else source_type == PICTURE                      -> Visual
  4. else (DESCRIPTION / WORD_ORDER / anything else)  -> Reading

Listening modality takes priority over source_type because an audio-bearing
exercise is a listening task regardless of where its content came from.
"""

from __future__ import annotations

import enum

from src.db.models import ExerciseModality, ExerciseSourceType


class ExerciseTopic(str, enum.Enum):
    """Learner-facing topic grouping for exercises (filter chips + comprehension bars)."""

    LISTENING = "Listening"
    READING = "Reading"
    DIALOGUE = "Dialogue"
    VISUAL = "Visual"

    def __str__(self) -> str:  # ensures str(topic) == the value, not "ExerciseTopic.LISTENING"
        return self.value


def derive_exercise_topic(
    source_type: ExerciseSourceType,
    modality: ExerciseModality | None,
) -> ExerciseTopic:
    """Map an exercise's source type + modality to exactly one topic.

    Total and deterministic over every (source_type, modality) combination,
    including ``modality is None`` (treated as non-listening).

    Args:
        source_type: The exercise source discriminator.
        modality: The exercise modality, or None when unknown / not enriched.

    Returns:
        The single ExerciseTopic for this exercise.
    """
    # 1. Listening modality wins over any source type.
    if modality == ExerciseModality.LISTENING:
        return ExerciseTopic.LISTENING
    # 2-3. Otherwise the source type decides.
    if source_type == ExerciseSourceType.DIALOG:
        return ExerciseTopic.DIALOGUE
    if source_type == ExerciseSourceType.PICTURE:
        return ExerciseTopic.VISUAL
    # 4. Description / word-order / fallback -> Reading.
    return ExerciseTopic.READING
