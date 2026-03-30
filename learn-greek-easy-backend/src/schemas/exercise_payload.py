from pydantic import BaseModel, Field, field_validator, model_validator

from src.db.models import ExerciseType


class MultilingualField(BaseModel):
    """Trilingual text field for exercise payloads."""

    el: str = Field(min_length=1)
    en: str = Field(min_length=1)
    ru: str = Field(min_length=1)


class FillGapsPayload(BaseModel):
    """Payload schema for a fill-in-the-gaps exercise item."""

    line_index: int
    correct_answer: str
    options: list[str]
    context_before: str
    context_after: str

    @field_validator("line_index")
    @classmethod
    def line_index_non_negative(cls, v: int) -> int:
        if v < 0:
            raise ValueError("line_index must be >= 0")
        return v

    @field_validator("options")
    @classmethod
    def options_length(cls, v: list[str]) -> list[str]:
        if not 3 <= len(v) <= 5:
            raise ValueError("options must have 3-5 items")
        return v

    @model_validator(mode="after")
    def correct_answer_in_options(self) -> "FillGapsPayload":
        if self.correct_answer not in self.options:
            raise ValueError("correct_answer must be one of the options")
        return self


class SelectHeardPayload(BaseModel):
    """Payload schema for a select-what-you-heard exercise item."""

    question_el: str
    question_en: str
    question_ru: str
    correct_answer: str
    options: list[str]

    @field_validator("options")
    @classmethod
    def options_length(cls, v: list[str]) -> list[str]:
        if not 3 <= len(v) <= 5:
            raise ValueError("options must have 3-5 items")
        return v

    @model_validator(mode="after")
    def correct_answer_in_options(self) -> "SelectHeardPayload":
        if self.correct_answer not in self.options:
            raise ValueError("correct_answer must be one of the options")
        return self


class TrueFalsePayload(BaseModel):
    """Payload schema for a true/false exercise item."""

    statement_el: str
    statement_en: str
    statement_ru: str
    correct_answer: bool
    explanation: str

    @field_validator("explanation")
    @classmethod
    def explanation_non_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("explanation must not be empty or whitespace")
        return v


class SelectCorrectAnswerPayload(BaseModel):
    """Payload schema for a select-correct-answer exercise item."""

    prompt: MultilingualField
    options: list[MultilingualField]
    correct_answer_index: int

    @field_validator("options")
    @classmethod
    def options_length(cls, v: list[MultilingualField]) -> list[MultilingualField]:
        if not 2 <= len(v) <= 4:
            raise ValueError("options must have 2-4 items")
        return v

    @field_validator("correct_answer_index")
    @classmethod
    def correct_answer_index_non_negative(cls, v: int) -> int:
        if v < 0:
            raise ValueError("correct_answer_index must be >= 0")
        return v

    @model_validator(mode="after")
    def correct_answer_in_range(self) -> "SelectCorrectAnswerPayload":
        if self.correct_answer_index >= len(self.options):
            raise ValueError(
                f"correct_answer_index ({self.correct_answer_index}) "
                f"must be < number of options ({len(self.options)})"
            )
        return self


PAYLOAD_SCHEMA_MAP: dict[ExerciseType, type[BaseModel]] = {
    ExerciseType.FILL_GAPS: FillGapsPayload,
    ExerciseType.SELECT_HEARD: SelectHeardPayload,
    ExerciseType.TRUE_FALSE: TrueFalsePayload,
    ExerciseType.SELECT_CORRECT_ANSWER: SelectCorrectAnswerPayload,
}


def validate_exercise_payload(exercise_type: ExerciseType, payload: dict) -> BaseModel:
    """Validate a raw payload dict against the schema for the given exercise type."""
    schema_cls = PAYLOAD_SCHEMA_MAP[exercise_type]
    return schema_cls.model_validate(payload)


class ExercisesPayload(BaseModel):
    """Top-level exercises payload attached to a dialog creation request."""

    fill_gaps: list[FillGapsPayload] = Field(min_length=1, max_length=6)
    select_heard: list[SelectHeardPayload] = Field(min_length=1, max_length=6)
    true_false: list[TrueFalsePayload] = Field(min_length=1, max_length=6)
