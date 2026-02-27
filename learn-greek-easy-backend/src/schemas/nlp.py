"""NLP verification Pydantic schemas for spellcheck and morphology results."""

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
