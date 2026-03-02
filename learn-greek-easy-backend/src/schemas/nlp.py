"""NLP verification Pydantic schemas for spellcheck and morphology results."""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class SpellcheckResult(BaseModel):
    """Result of a spellcheck operation on a Greek word."""

    input_word: str = Field(..., description="The Greek word that was checked")
    is_valid: bool = Field(
        ..., description="Whether the word is found in the el_GR Hunspell dictionary"
    )
    suggestions: list[str] = Field(
        default_factory=list,
        description="Spelling suggestions if the word is invalid",
    )


class MorphologyResult(BaseModel):
    """Result of morphological analysis on a Greek word using spaCy."""

    input_word: str = Field(..., description="The Greek word that was analyzed")
    lemma: str = Field(..., description="Lemmatized (dictionary) form of the word")
    pos: str = Field(
        ...,
        description="Universal POS tag from spaCy (NOUN, VERB, ADJ, ADV, etc.)",
    )
    morph_features: dict[str, str] = Field(
        default_factory=dict,
        description="Morphological features from spaCy token.morph (e.g., {'Case': 'Nom', 'Gender': 'Masc', 'Number': 'Sing'})",
    )
    is_known: bool = Field(
        ...,
        description="Whether spaCy recognized the word (lemma differs from input word)",
    )
    analysis_successful: bool = Field(
        ...,
        description="Whether the analysis completed. False if input was empty, not Greek script, or processing failed.",
    )


class NormalizedLemma(BaseModel):
    """Result of the full lemma normalization pipeline."""

    input_word: str = Field(..., description="Original word submitted for normalization")
    lemma: str = Field(..., description="Normalized lemma (dictionary form)")
    gender: str | None = Field(None, description='Gender: "masculine"/"feminine"/"neuter"/None')
    article: str | None = Field(None, description='Article: "ο"/"η"/"το"/None')
    pos: str = Field(..., description="Universal POS tag (NOUN, VERB, ADJ, etc.)")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score 0.0-1.0")


class WordEntrySnapshot(BaseModel):
    """Lightweight snapshot of a WordEntry for duplicate detection results."""

    id: UUID
    lemma: str
    part_of_speech: str
    translation_en: str
    translation_ru: str | None = None
    pronunciation: str | None = None
    grammar_data: dict | None = None
    examples: list[dict] | None = None


class DuplicateCheckResult(BaseModel):
    """Result of checking whether a word entry is a duplicate."""

    is_duplicate: bool
    existing_entry: WordEntrySnapshot | None = None
    matched_deck_id: UUID | None = None
    matched_deck_name: str | None = None


class OpenRouterResponse(BaseModel):
    """Response from an OpenRouter API call."""

    content: str = Field(..., description="Text content returned by the model")
    model: str = Field(..., description="Model ID that generated the response")
    usage: dict | None = Field(
        default=None,
        description="Token usage statistics (prompt_tokens, completion_tokens, total_tokens)",
    )
    latency_ms: float = Field(..., description="Request latency in milliseconds")


# ── Noun Generation Schemas ───────────────────────────────────────────


class GeneratedNounCaseSet(BaseModel):
    """Declension case forms for a single number (singular or plural)."""

    nominative: str = Field(..., min_length=1)
    genitive: str = Field(..., min_length=1)
    accusative: str = Field(..., min_length=1)
    vocative: str = Field(..., min_length=1)


class GeneratedNounCases(BaseModel):
    """Singular and plural declension cases for a noun."""

    singular: GeneratedNounCaseSet
    plural: GeneratedNounCaseSet


class GeneratedNounGrammar(BaseModel):
    """Grammar metadata for a generated noun: gender, declension group, and case forms."""

    gender: Literal["masculine", "feminine", "neuter"]
    declension_group: str = Field(..., min_length=1)
    cases: GeneratedNounCases


class GeneratedExample(BaseModel):
    """A trilingual example sentence for a generated noun."""

    id: int = Field(..., ge=1, le=2)
    greek: str = Field(..., min_length=1)
    english: str = Field(..., min_length=1)
    russian: str = Field(..., min_length=1)


class GeneratedNounData(BaseModel):
    """Complete generated noun entry from OpenRouter, ready for validation and DB insertion."""

    lemma: str = Field(..., min_length=1)
    part_of_speech: Literal["noun"]
    translation_en: str = Field(..., min_length=1)
    translation_en_plural: str | None = None
    translation_ru: str = Field(..., min_length=1)
    pronunciation: str = Field(..., min_length=1)
    grammar_data: GeneratedNounGrammar
    examples: list[GeneratedExample] = Field(..., min_length=2, max_length=2)


# ── Local Verification Schemas ─────────────────────────────────────────────


class CheckResult(BaseModel):
    """Result of a single verification check on a generated field."""

    check_name: str = Field(
        ..., description="Name of the check (e.g., 'spellcheck', 'morphology_pos')"
    )
    status: Literal["pass", "fail", "warn"] = Field(..., description="Check outcome")
    message: str | None = Field(None, description="Human-readable detail for non-pass results")


class FieldVerificationResult(BaseModel):
    """Aggregated verification result for a single field in the generated data."""

    field_path: str = Field(..., description="Dot-notation path (e.g., 'cases.singular.genitive')")
    status: Literal["pass", "fail", "warn", "skipped"] = Field(
        ..., description="Aggregate status derived from checks"
    )
    checks: list[CheckResult] = Field(
        default_factory=list, description="Individual check results for this field"
    )


class LocalVerificationResult(BaseModel):
    """Complete result of local verification pipeline run on generated noun data."""

    fields: list[FieldVerificationResult] = Field(..., description="Per-field verification results")
    tier: Literal["auto_approve", "quick_review", "manual_review"] = Field(
        ..., description="Aggregate confidence tier"
    )
    stages_skipped: list[str] = Field(
        default_factory=list, description="Stages that could not run (e.g., ['spellcheck'])"
    )
    summary: str = Field(
        ..., description="Human-readable summary (e.g., '9 pass, 2 warn, 0 fail -> auto_approve')"
    )


# ── Cross-AI Verification Schemas ─────────────────────────────────────────────


class FieldComparisonResult(BaseModel):
    """Result of comparing a single field between primary and secondary LLM generations."""

    field_path: str = Field(..., description="Dot-notation path (e.g., 'cases.singular.genitive')")
    primary_value: str = Field(..., description="Value from primary generation (Gemini)")
    secondary_value: str = Field(..., description="Value from secondary generation (GPT)")
    agrees: bool = Field(..., description="Whether primary and secondary values match")
    weight: float = Field(
        ..., description="Importance weight for this field (higher = more critical)"
    )


class CrossAIVerificationResult(BaseModel):
    """Result of cross-AI verification comparing two LLM generations of the same noun."""

    comparisons: list[FieldComparisonResult] = Field(
        default_factory=list, description="Per-field comparison results"
    )
    overall_agreement: float | None = Field(
        None, description="Weighted fraction of fields that agree (0.0-1.0), None if failed"
    )
    secondary_model: str = Field(
        default="openai/gpt-4.1-mini", description="Model used for secondary generation"
    )
    secondary_generation: GeneratedNounData | None = Field(
        None, description="Full secondary generation output for admin reference"
    )
    error: str | None = Field(None, description="Error message if cross-AI verification failed")
