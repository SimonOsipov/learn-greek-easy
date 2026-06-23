from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

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
    # SIT-27-02: human-facing topic label for the hub card kicker (nullable).
    domain: str | None = None
    # SIT-27-02: news-vs-everyday section discriminator, sourced from
    # SituationDescription.source_type ("news" | "original"); null when the
    # situation has no description.
    description_source_type: str | None = None


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
    # SIT-27-02: human-facing topic label for the hub card kicker (nullable).
    domain: str | None = None
    source_url: str | None = None
    source_image_url: str | None = None
    picture_url: str | None = None
    source_title: str | None = None
    # WebP derivative URLs keyed by pixel-width (PERF-10).
    # None / empty dict = derivatives not yet generated (PERF-11 will backfill).
    # Frontend falls back to picture_url / source_image_url when absent.
    picture_variants: dict[int, str] | None = None
    source_image_variants: dict[int, str] | None = None


# ============================================================================
# SIT-27-04: Comprehension / stats schemas
# ============================================================================


class SituationStatsResponse(BaseModel):
    """Per-situation exercise counts for the detail metric strip (SIT-27-04 AC-1).

    Partition over the user's ExerciseRecord status for this situation's exercises:
      to_practice = NEW (or no record — never started)
      in_review   = LEARNING + REVIEW
      mastered    = MASTERED
    audio = count of audio-bearing (LISTENING modality) exercises in the situation.
    """

    to_practice: int = Field(..., ge=0, description="Exercises not yet started (NEW / no record)")
    in_review: int = Field(..., ge=0, description="Exercises in LEARNING or REVIEW")
    mastered: int = Field(..., ge=0, description="Exercises with MASTERED status")
    audio: int = Field(..., ge=0, description="Audio-bearing (LISTENING modality) exercise count")


class TopicConfidence(BaseModel):
    """Per-topic comprehension confidence for the overview bars (SIT-27-04 AC-3)."""

    topic: str = Field(..., description="Topic: Listening | Reading | Dialogue | Visual")
    confidence_percentage: float = Field(
        ..., ge=0, le=100, description="Weighted SRS-stage confidence 0-100 for this topic"
    )
    accuracy: float | None = Field(
        None,
        ge=0,
        le=100,
        description="Review accuracy 0-100 for this topic; null when no attempts yet",
    )


class RecentSession(BaseModel):
    """A single recent exercise review entry for the overview (SIT-27-04 AC-5)."""

    model_config = ConfigDict(from_attributes=True)

    reviewed_at: datetime = Field(..., description="When the review happened (UTC)")
    score: int = Field(..., ge=0, description="Points earned in the review")
    max_score: int = Field(..., ge=1, description="Maximum possible points")
    quality: int = Field(..., ge=0, le=5, description="SM-2 quality rating")


class SituationComprehensionResponse(BaseModel):
    """Account-wide situations comprehension overview (SIT-27-04 AC-2..5).

    Modelled on CultureReadinessResponse: weighted SRS-stage comprehension mapped
    to a shared verdict, plus per-topic bars, the global exercise streak, recent
    sessions, and a what's-new count.
    """

    comprehension_percentage: float = Field(
        ..., ge=0, le=100, description="Overall weighted comprehension 0-100"
    )
    verdict: str = Field(..., description="Verdict from ReadinessConstants.VERDICT_THRESHOLDS")
    topic_confidence: list[TopicConfidence] = Field(
        default_factory=list, description="Per-topic confidence; all four topics always present"
    )
    streak: int = Field(..., ge=0, description="Global exercise streak (compute_exercise_streak)")
    recent_sessions: list[RecentSession] = Field(
        default_factory=list, description="Up to 5 most recent reviews, newest first"
    )
    whats_new_count: int = Field(
        ..., ge=0, description="READY situations created within the last 7 days"
    )
