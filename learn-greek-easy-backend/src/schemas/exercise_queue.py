from datetime import date
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.db.models import CardStatus, DeckLevel, ExerciseModality, ExerciseSourceType, ExerciseType


class ExerciseItemPayload(BaseModel):
    """Single exercise item with its positional index and raw payload."""

    item_index: int = Field(..., description="Zero-based index of this item within the exercise")
    payload: dict = Field(..., description="Exercise-type-specific payload data")


class ExerciseQueueItem(BaseModel):
    """A single exercise in the study queue with scheduling metadata and content."""

    model_config = ConfigDict(from_attributes=True)

    # Exercise identity
    exercise_id: UUID
    source_type: ExerciseSourceType
    exercise_type: ExerciseType
    modality: ExerciseModality | None = None
    audio_level: DeckLevel | None = None

    # SM-2 state
    status: CardStatus = Field(default=CardStatus.NEW)
    is_new: bool
    is_early_practice: bool = Field(default=False)
    due_date: date | None = None
    easiness_factor: float | None = None
    interval: int | None = None

    # Situation context (nullable -- only for description/dialog exercises linked to a situation)
    situation_id: UUID | None = None
    scenario_el: str | None = None
    scenario_en: str | None = None
    scenario_ru: str | None = None

    # Description content (nullable -- only for description-source exercises)
    description_text_el: str | None = None
    description_audio_url: str | None = None
    description_audio_duration: float | None = None
    word_timestamps: list | None = None

    # Exercise items
    items: list[ExerciseItemPayload] = Field(default_factory=list)


class ExerciseQueue(BaseModel):
    """Unified exercise queue response combining all exercise source types."""

    total_due: int = Field(..., ge=0, description="Number of exercises due for review")
    total_new: int = Field(..., ge=0, description="Number of new exercises available")
    total_early_practice: int = Field(
        default=0, ge=0, description="Number of early practice exercises"
    )
    total_in_queue: int = Field(..., ge=0, description="Total exercises in this queue")
    exercises: list[ExerciseQueueItem] = Field(default_factory=list)


class ExerciseReviewRequest(BaseModel):
    """Request payload for submitting a single exercise review with raw score."""

    exercise_id: UUID
    score: int = Field(..., ge=0, description="Points earned")
    max_score: int = Field(..., ge=1, description="Maximum possible points (must be >= 1)")

    @model_validator(mode="after")
    def score_lte_max_score(self) -> "ExerciseReviewRequest":
        if self.score > self.max_score:
            raise ValueError(f"score ({self.score}) must be <= max_score ({self.max_score})")
        return self


class ExerciseReviewResult(BaseModel):
    """Result of processing a single exercise review."""

    model_config = ConfigDict(from_attributes=True)

    exercise_id: UUID
    quality: int = Field(..., ge=0, le=5, description="SM-2 quality rating derived from score")
    score: int = Field(..., ge=0)
    max_score: int = Field(..., ge=1)
    previous_status: CardStatus
    new_status: CardStatus
    easiness_factor: float = Field(..., ge=1.3)
    interval: int = Field(..., ge=0)
    repetitions: int = Field(..., ge=0)
    next_review_date: date
    message: str | None = None
