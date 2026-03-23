from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.db.models import (
    DescriptionSourceType,
    DescriptionStatus,
    DialogStatus,
    PictureStatus,
    SituationStatus,
)
from src.schemas.admin import DialogLineDetail, DialogSpeakerDetail


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


class SituationListResponse(BaseModel):
    items: list[SituationListItem]
    total: int
    page: int
    page_size: int


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
