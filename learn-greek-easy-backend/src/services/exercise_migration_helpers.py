"""Helpers for migrating legacy exercise data to unified exercise payloads."""

from src.schemas.exercise_payload import SelectCorrectAnswerPayload


def build_select_correct_answer_payload(
    question_text: dict,
    option_a: dict,
    option_b: dict,
    option_c: dict | None,
    option_d: dict | None,
    correct_option: int,
) -> dict:
    """Build and validate a SelectCorrectAnswerPayload dict.

    Args:
        question_text: Multilingual dict {"el": ..., "en": ..., "ru": ...}
        option_a: Multilingual dict (always required)
        option_b: Multilingual dict (always required)
        option_c: Multilingual dict or None (skip for 2-option questions)
        option_d: Multilingual dict or None (skip for 2/3-option questions)
        correct_option: 1-indexed correct answer (1=A, 2=B, 3=C, 4=D)

    Returns:
        Validated payload dict ready for JSONB storage.

    Raises:
        ValueError: If correct_option is out of range or points to a null option.
        pydantic.ValidationError: If multilingual fields are missing/invalid.
    """
    options = [option_a, option_b]
    if option_c is not None:
        options.append(option_c)
    if option_d is not None:
        options.append(option_d)

    if correct_option == 3 and option_c is None:
        raise ValueError("correct_option=3 points to a null option (option_c is None)")
    if correct_option == 4 and option_d is None:
        raise ValueError("correct_option=4 points to a null option (option_d is None)")

    if correct_option < 1 or correct_option > len(options):
        raise ValueError(
            f"correct_option={correct_option} out of range for {len(options)} options "
            f"(must be 1-{len(options)})"
        )

    correct_answer_index = correct_option - 1
    payload = {
        "prompt": question_text,
        "options": options,
        "correct_answer_index": correct_answer_index,
    }
    SelectCorrectAnswerPayload.model_validate(payload)
    return payload
