from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.db.models import (
    DeckLevel,
    DescriptionSourceType,
    DescriptionStatus,
    DialogStatus,
    ExerciseModality,
    ExerciseSourceType,
    ExerciseStatus,
    ExerciseType,
    PictureStatus,
    SituationStatus,
)
from src.schemas.admin import DialogLineDetail, DialogSpeakerDetail, WordTimestamp


class SituationCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    scenario_el: str = Field(min_length=1, max_length=500)
    scenario_en: str = Field(min_length=1, max_length=500)
    scenario_ru: str = Field(min_length=1, max_length=500)


class SituationUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    scenario_el: Optional[str] = Field(default=None, min_length=1, max_length=500)
    scenario_en: Optional[str] = Field(default=None, min_length=1, max_length=500)
    scenario_ru: Optional[str] = Field(default=None, min_length=1, max_length=500)

    @model_validator(mode="after")
    def check_at_least_one_field(self) -> "SituationUpdate":
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided for update")
        for field_name in self.model_fields_set:
            if getattr(self, field_name) is None:
                raise ValueError(f"{field_name} cannot be null")
        return self


class SituationListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    scenario_el: str
    scenario_en: str
    scenario_ru: str
    status: SituationStatus
    created_at: datetime
    has_dialog: bool
    has_description: bool
    has_picture: bool
    has_dialog_audio: bool
    has_description_audio: bool
    description_timestamps_count: int


class SituationListResponse(BaseModel):
    items: list[SituationListItem]
    total: int
    page: int
    page_size: int
    status_counts: dict[str, int] = {}


class SituationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    scenario_el: str
    scenario_en: str
    scenario_ru: str
    status: SituationStatus
    created_at: datetime
    updated_at: datetime


class DialogNested(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: DialogStatus
    num_speakers: int
    audio_duration_seconds: float | None
    audio_url: str | None = None
    created_at: datetime
    speakers: list[DialogSpeakerDetail]
    lines: list[DialogLineDetail]


class DescriptionNested(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    text_el: str
    text_el_a2: str | None
    source_type: DescriptionSourceType
    status: DescriptionStatus
    audio_duration_seconds: float | None
    audio_a2_duration_seconds: float | None
    audio_url: str | None = None
    audio_a2_url: str | None = None
    word_timestamps: list[WordTimestamp] | None = None
    word_timestamps_a2: list[WordTimestamp] | None = None
    created_at: datetime


class PictureNested(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    image_prompt: str
    status: PictureStatus
    created_at: datetime


class SituationDetailResponse(SituationResponse):
    dialog: DialogNested | None = None
    description: DescriptionNested | None = None
    picture: PictureNested | None = None


class SituationExerciseItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    item_index: int = Field(..., description="Zero-based position of this item")
    payload: dict = Field(..., description="Exercise-type-specific JSONB content")


class SituationExerciseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    exercise_type: ExerciseType
    status: ExerciseStatus
    items: list[SituationExerciseItemResponse]
    audio_level: DeckLevel | None = None
    modality: ExerciseModality | None = None
    audio_url: str | None = None
    reading_text: str | None = None


class SituationExerciseGroupResponse(BaseModel):
    source_type: ExerciseSourceType
    exercises: list[SituationExerciseResponse]
    exercise_count: int = Field(..., ge=0, description="Number of exercises in this group")


class SituationExercisesResponse(BaseModel):
    groups: list[SituationExerciseGroupResponse]
    total_count: int = Field(..., ge=0, description="Total exercises across all groups")


class AdminExerciseListItem(BaseModel):
    """A single exercise in the flat admin exercise list."""

    id: UUID
    exercise_type: ExerciseType
    status: ExerciseStatus
    source_type: ExerciseSourceType
    modality: ExerciseModality
    audio_level: DeckLevel | None = None
    situation_id: UUID
    situation_title_el: str
    situation_title_en: str
    audio_url: str | None = None
    reading_text: str | None = None
    item_count: int
    items: list[SituationExerciseItemResponse]


class AdminExerciseListResponse(BaseModel):
    items: list[AdminExerciseListItem]
    total: int
    page: int
    page_size: int
