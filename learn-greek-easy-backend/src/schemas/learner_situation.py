from uuid import UUID

from pydantic import BaseModel, ConfigDict

from src.db.models import SituationStatus
from src.schemas.admin import DialogLineDetail, DialogSpeakerDetail, WordTimestamp


class LearnerDescriptionNested(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    text_el: str
    text_el_a2: str | None = None
    audio_url: str | None = None
    audio_a2_url: str | None = None
    audio_duration_seconds: float | None = None
    audio_a2_duration_seconds: float | None = None
    word_timestamps: list[WordTimestamp] | None = None
    word_timestamps_a2: list[WordTimestamp] | None = None


class LearnerDialogNested(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    speakers: list[DialogSpeakerDetail]
    lines: list[DialogLineDetail]
    audio_url: str | None = None
    audio_duration_seconds: float | None = None


class LearnerSituationListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    scenario_el: str
    scenario_en: str
    scenario_ru: str
    status: SituationStatus
    has_audio: bool
    has_dialog: bool
    exercise_total: int
    exercise_completed: int
    source_image_url: str | None = None


class LearnerSituationListResponse(BaseModel):
    items: list[LearnerSituationListItem]
    total: int
    page: int
    page_size: int


class LearnerSituationDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    scenario_el: str
    scenario_en: str
    scenario_ru: str
    status: SituationStatus
    description: LearnerDescriptionNested | None = None
    dialog: LearnerDialogNested | None = None
    exercise_total: int
    exercise_completed: int
    source_url: str | None = None
    source_image_url: str | None = None
    source_title: str | None = None
