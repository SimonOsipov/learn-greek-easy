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


class PictureMatchOption(BaseModel):
    """One option in a picture-match exercise (mutually exclusive image_url XOR description_text)."""

    option_index: int = Field(ge=0, le=3)
    image_url: str | None = None
    description_text: str | None = None

    @model_validator(mode="after")
    def exactly_one_of(self) -> "PictureMatchOption":
        if (self.image_url is None) == (self.description_text is None):
            raise ValueError("exactly one of image_url or description_text must be set")
        return self


class _PictureMatchBase(BaseModel):
    options: list[PictureMatchOption]
    correct_index: int = Field(ge=0, le=3)

    @field_validator("options")
    @classmethod
    def _four_options(cls, v: list[PictureMatchOption]) -> list[PictureMatchOption]:
        if len(v) != 4:
            raise ValueError("options must have exactly 4 items")
        return v

    @model_validator(mode="after")
    def _option_indices_unique_0_to_3(self) -> "_PictureMatchBase":
        idxs = sorted(o.option_index for o in self.options)
        if idxs != [0, 1, 2, 3]:
            raise ValueError("option_index values must be exactly {0,1,2,3}")
        return self


class SelectPictureFromDescriptionPayload(_PictureMatchBase):
    """Show description text, pick the correct picture from 4."""

    prompt_description: str = Field(min_length=1)

    @model_validator(mode="after")
    def _options_are_pictures(self) -> "SelectPictureFromDescriptionPayload":
        if any(o.image_url is None for o in self.options):
            raise ValueError("all options must have image_url")
        return self


class SelectDescriptionFromPicturePayload(_PictureMatchBase):
    """Show anchor picture, pick the correct description from 4."""

    anchor_image_url: str = Field(min_length=1)

    @model_validator(mode="after")
    def _options_are_descriptions(self) -> "SelectDescriptionFromPicturePayload":
        if any(o.description_text is None for o in self.options):
            raise ValueError("all options must have description_text")
        return self


PAYLOAD_SCHEMA_MAP: dict[ExerciseType, type[BaseModel]] = {
    ExerciseType.FILL_GAPS: FillGapsPayload,
    ExerciseType.SELECT_HEARD: SelectHeardPayload,
    ExerciseType.TRUE_FALSE: TrueFalsePayload,
    ExerciseType.SELECT_CORRECT_ANSWER: SelectCorrectAnswerPayload,
    ExerciseType.SELECT_PICTURE_FROM_DESCRIPTION: SelectPictureFromDescriptionPayload,
    ExerciseType.SELECT_DESCRIPTION_FROM_PICTURE: SelectDescriptionFromPicturePayload,
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
