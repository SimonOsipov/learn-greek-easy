"""Unit tests for admin generate-word-entry endpoint.

Tests cover:
- POST /api/v1/admin/word-entries/generate
- 200 success with normalization + duplicate check stages
- Confidence tier mapping (high/medium/low boundaries)
- Response envelope shape (future stages are None)
- Duplicate check: is_duplicate=False for new words, True for existing
- Service called with correct word argument
- 404 for unknown or inactive deck
- 400 for V1 deck
- 403 for non-superuser requests
- 401 for unauthenticated requests
- 422 for invalid / missing request fields
"""

from unittest.mock import ANY, MagicMock, patch
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CardSystemVersion, Deck, DeckLevel
from src.schemas.nlp import MorphologyResult, NormalizedLemma
from src.services.lemma_normalization_service import (
    NormalizationCandidate,
    SmartNormalizationResult,
)

# =============================================================================
# Helpers
# =============================================================================

ENDPOINT = "/api/v1/admin/word-entries/generate"


def _mock_normalized(
    confidence: float = 1.0,
    gender: str | None = "masculine",
    pos: str = "NOUN",
) -> NormalizedLemma:
    return NormalizedLemma(
        input_word="γάτα",
        lemma="γάτα",
        gender=gender,
        article=(
            "η"
            if gender == "feminine"
            else ("ο" if gender == "masculine" else "το" if gender == "neuter" else None)
        ),
        pos=pos,
        confidence=confidence,
    )


def _mock_smart_result(
    confidence: float = 1.0,
    gender: str | None = "masculine",
    pos: str = "NOUN",
    strategy: str = "direct",
    corrected_from: str | None = None,
    suggestions: list[NormalizationCandidate] | None = None,
) -> SmartNormalizationResult:
    gender_to_spacy = {"masculine": "Masc", "feminine": "Fem", "neuter": "Neut"}
    morph_features: dict[str, str] = {}
    if gender:
        morph_features["Gender"] = gender_to_spacy[gender]

    primary = NormalizationCandidate(
        input_form="γάτα",
        strategy=strategy,
        morphology=MorphologyResult(
            input_word="γάτα",
            lemma="γάτα",
            pos=pos,
            morph_features=morph_features,
            is_known=True,
            analysis_successful=True,
        ),
        confidence=confidence,
        corrected_from=corrected_from,
    )
    return SmartNormalizationResult(
        primary=primary,
        suggestions=suggestions or [],
        detected_article=None,
    )


# =============================================================================
# Fixtures: deck variants
# =============================================================================


@pytest.fixture
async def v2_deck(db_session: AsyncSession) -> Deck:
    """Active V2 vocabulary deck — the happy path deck."""
    deck = Deck(
        id=uuid4(),
        name_en="Generate Word Entry Test Deck",
        name_el="Τεστ παραγωγής",
        name_ru="Тест генерации",
        description_en="Test",
        description_el="Τεστ",
        description_ru="Тест",
        level=DeckLevel.A1,
        is_active=True,
        card_system=CardSystemVersion.V2,
    )
    db_session.add(deck)
    await db_session.commit()
    await db_session.refresh(deck)
    return deck


@pytest.fixture
async def v1_deck(db_session: AsyncSession) -> Deck:
    """Active V1 vocabulary deck — should be rejected with 400."""
    deck = Deck(
        id=uuid4(),
        name_en="V1 Test Deck",
        name_el="Τεστ V1",
        name_ru="Тест V1",
        description_en="Test",
        description_el="Τεστ",
        description_ru="Тест",
        level=DeckLevel.A1,
        is_active=True,
        card_system=CardSystemVersion.V1,
    )
    db_session.add(deck)
    await db_session.commit()
    await db_session.refresh(deck)
    return deck


@pytest.fixture
async def inactive_v2_deck(db_session: AsyncSession) -> Deck:
    """Inactive V2 deck — should be rejected with 404."""
    deck = Deck(
        id=uuid4(),
        name_en="Inactive V2 Deck",
        name_el="Ανενεργό V2",
        name_ru="Неактивный V2",
        description_en="Test",
        description_el="Τεστ",
        description_ru="Тест",
        level=DeckLevel.A1,
        is_active=False,
        card_system=CardSystemVersion.V2,
    )
    db_session.add(deck)
    await db_session.commit()
    await db_session.refresh(deck)
    return deck


# =============================================================================
# Tests
# =============================================================================


@pytest.mark.unit
class TestGenerateWordEntry:
    """Tests for POST /api/v1/admin/word-entries/generate."""

    # -------------------------------------------------------------------------
    # 200 Happy path and confidence tier mapping
    # -------------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_200_happy_path(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        v2_deck: Deck,
    ):
        """Returns 200 with stage='translation_lookup' and confidence_tier='high' for confidence=1.0."""
        with patch("src.api.v1.admin.get_lemma_normalization_service") as mock_factory:
            mock_svc = MagicMock()
            mock_svc.normalize_smart.return_value = _mock_smart_result(confidence=1.0)
            mock_factory.return_value = mock_svc

            response = await client.post(
                ENDPOINT,
                json={"word": "γάτα", "deck_id": str(v2_deck.id)},
                headers=superuser_auth_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["stage"] == "translation_lookup"
        norm = data["normalization"]
        assert norm is not None
        assert norm["confidence_tier"] == "high"

    @pytest.mark.asyncio
    async def test_200_medium_confidence(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        v2_deck: Deck,
    ):
        """confidence=0.6 maps to confidence_tier='medium'."""
        with patch("src.api.v1.admin.get_lemma_normalization_service") as mock_factory:
            mock_svc = MagicMock()
            mock_svc.normalize_smart.return_value = _mock_smart_result(confidence=0.6)
            mock_factory.return_value = mock_svc

            response = await client.post(
                ENDPOINT,
                json={"word": "γάτα", "deck_id": str(v2_deck.id)},
                headers=superuser_auth_headers,
            )

        assert response.status_code == 200
        assert response.json()["normalization"]["confidence_tier"] == "medium"

    @pytest.mark.asyncio
    async def test_200_low_confidence(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        v2_deck: Deck,
    ):
        """confidence=0.2 maps to confidence_tier='low'."""
        with patch("src.api.v1.admin.get_lemma_normalization_service") as mock_factory:
            mock_svc = MagicMock()
            mock_svc.normalize_smart.return_value = _mock_smart_result(confidence=0.2)
            mock_factory.return_value = mock_svc

            response = await client.post(
                ENDPOINT,
                json={"word": "γάτα", "deck_id": str(v2_deck.id)},
                headers=superuser_auth_headers,
            )

        assert response.status_code == 200
        assert response.json()["normalization"]["confidence_tier"] == "low"

    @pytest.mark.asyncio
    async def test_200_zero_confidence(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        v2_deck: Deck,
    ):
        """confidence=0.0 still returns 200 with confidence_tier='low'."""
        with patch("src.api.v1.admin.get_lemma_normalization_service") as mock_factory:
            mock_svc = MagicMock()
            mock_svc.normalize_smart.return_value = _mock_smart_result(confidence=0.0)
            mock_factory.return_value = mock_svc

            response = await client.post(
                ENDPOINT,
                json={"word": "γάτα", "deck_id": str(v2_deck.id)},
                headers=superuser_auth_headers,
            )

        assert response.status_code == 200
        assert response.json()["normalization"]["confidence_tier"] == "low"

    @pytest.mark.asyncio
    async def test_200_boundary_high(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        v2_deck: Deck,
    ):
        """confidence=0.8 (exact boundary) maps to confidence_tier='high'."""
        with patch("src.api.v1.admin.get_lemma_normalization_service") as mock_factory:
            mock_svc = MagicMock()
            mock_svc.normalize_smart.return_value = _mock_smart_result(confidence=0.8)
            mock_factory.return_value = mock_svc

            response = await client.post(
                ENDPOINT,
                json={"word": "γάτα", "deck_id": str(v2_deck.id)},
                headers=superuser_auth_headers,
            )

        assert response.status_code == 200
        assert response.json()["normalization"]["confidence_tier"] == "high"

    @pytest.mark.asyncio
    async def test_200_boundary_medium(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        v2_deck: Deck,
    ):
        """confidence=0.5 (exact boundary) maps to confidence_tier='medium'."""
        with patch("src.api.v1.admin.get_lemma_normalization_service") as mock_factory:
            mock_svc = MagicMock()
            mock_svc.normalize_smart.return_value = _mock_smart_result(confidence=0.5)
            mock_factory.return_value = mock_svc

            response = await client.post(
                ENDPOINT,
                json={"word": "γάτα", "deck_id": str(v2_deck.id)},
                headers=superuser_auth_headers,
            )

        assert response.status_code == 200
        assert response.json()["normalization"]["confidence_tier"] == "medium"

    @pytest.mark.asyncio
    async def test_200_response_envelope_shape(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        v2_deck: Deck,
    ):
        """duplicate_check is populated, future pipeline stages are all None."""
        with patch("src.api.v1.admin.get_lemma_normalization_service") as mock_factory:
            mock_svc = MagicMock()
            mock_svc.normalize_smart.return_value = _mock_smart_result()
            mock_factory.return_value = mock_svc

            response = await client.post(
                ENDPOINT,
                json={"word": "γάτα", "deck_id": str(v2_deck.id)},
                headers=superuser_auth_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["duplicate_check"] is not None
        assert data["duplicate_check"]["is_duplicate"] is False
        assert data["translation_lookup"] is not None
        assert data["generation"] is None
        assert data["verification"] is None
        assert data["persist"] is None

    @pytest.mark.asyncio
    async def test_200_normalize_called_with_word(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        v2_deck: Deck,
    ):
        """normalize_smart() is called exactly once with the submitted word."""
        with patch("src.api.v1.admin.get_lemma_normalization_service") as mock_factory:
            mock_svc = MagicMock()
            mock_svc.normalize_smart.return_value = _mock_smart_result()
            mock_factory.return_value = mock_svc

            await client.post(
                ENDPOINT,
                json={"word": "γάτα", "deck_id": str(v2_deck.id)},
                headers=superuser_auth_headers,
            )

        mock_svc.normalize_smart.assert_called_once_with(
            "γάτα", expected_pos="NOUN", lexicon_entry=ANY
        )

    # -------------------------------------------------------------------------
    # 404 / 400 — deck validation errors
    # -------------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_404_deck_not_found(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Random UUID returns 404."""
        response = await client.post(
            ENDPOINT,
            json={"word": "γάτα", "deck_id": str(uuid4())},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_404_inactive_deck(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        inactive_v2_deck: Deck,
    ):
        """Inactive deck returns 404."""
        response = await client.post(
            ENDPOINT,
            json={"word": "γάτα", "deck_id": str(inactive_v2_deck.id)},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_400_v1_deck(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        v1_deck: Deck,
    ):
        """V1 deck returns 400."""
        response = await client.post(
            ENDPOINT,
            json={"word": "γάτα", "deck_id": str(v1_deck.id)},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 400

    # -------------------------------------------------------------------------
    # Auth errors
    # -------------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_403_non_superuser(
        self,
        client: AsyncClient,
        auth_headers: dict,
        v2_deck: Deck,
    ):
        """Non-superuser receives 403."""
        response = await client.post(
            ENDPOINT,
            json={"word": "γάτα", "deck_id": str(v2_deck.id)},
            headers=auth_headers,
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_401_unauthenticated(
        self,
        client: AsyncClient,
        v2_deck: Deck,
    ):
        """Unauthenticated request receives 401."""
        response = await client.post(
            ENDPOINT,
            json={"word": "γάτα", "deck_id": str(v2_deck.id)},
        )

        assert response.status_code == 401

    # -------------------------------------------------------------------------
    # 422 Validation errors
    # -------------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_422_empty_word(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        v2_deck: Deck,
    ):
        """Empty string word fails validation with 422."""
        response = await client.post(
            ENDPOINT,
            json={"word": "", "deck_id": str(v2_deck.id)},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_422_word_too_long(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        v2_deck: Deck,
    ):
        """Word longer than 50 chars fails validation with 422."""
        response = await client.post(
            ENDPOINT,
            json={"word": "α" * 51, "deck_id": str(v2_deck.id)},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_422_missing_deck_id(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
    ):
        """Request body without deck_id fails validation with 422."""
        response = await client.post(
            ENDPOINT,
            json={"word": "γάτα"},
            headers=superuser_auth_headers,
        )

        assert response.status_code == 422

    # -------------------------------------------------------------------------
    # Smart normalization: strategy, corrected_from, suggestions, 400
    # -------------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_200_strategy_direct(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        v2_deck: Deck,
    ):
        """Strategy field is 'direct' for direct normalization."""
        with patch("src.api.v1.admin.get_lemma_normalization_service") as mock_factory:
            mock_svc = MagicMock()
            mock_svc.normalize_smart.return_value = _mock_smart_result(strategy="direct")
            mock_factory.return_value = mock_svc
            resp = await client.post(
                ENDPOINT,
                json={"word": "γάτα", "deck_id": str(v2_deck.id)},
                headers=superuser_auth_headers,
            )
        assert resp.status_code == 200
        assert resp.json()["normalization"]["strategy"] == "direct"

    @pytest.mark.asyncio
    async def test_200_strategy_spellcheck(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        v2_deck: Deck,
    ):
        """Strategy field is 'spellcheck' when correction was needed."""
        with patch("src.api.v1.admin.get_lemma_normalization_service") as mock_factory:
            mock_svc = MagicMock()
            mock_svc.normalize_smart.return_value = _mock_smart_result(
                strategy="spellcheck", corrected_from="γατα"
            )
            mock_factory.return_value = mock_svc
            resp = await client.post(
                ENDPOINT,
                json={"word": "γατα", "deck_id": str(v2_deck.id)},
                headers=superuser_auth_headers,
            )
        assert resp.status_code == 200
        assert resp.json()["normalization"]["strategy"] == "spellcheck"
        assert resp.json()["normalization"]["corrected_from"] == "γατα"

    @pytest.mark.asyncio
    async def test_200_corrected_from_null_for_perfect_input(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        v2_deck: Deck,
    ):
        """corrected_from is null when no correction needed."""
        with patch("src.api.v1.admin.get_lemma_normalization_service") as mock_factory:
            mock_svc = MagicMock()
            mock_svc.normalize_smart.return_value = _mock_smart_result()
            mock_factory.return_value = mock_svc
            resp = await client.post(
                ENDPOINT,
                json={"word": "γάτα", "deck_id": str(v2_deck.id)},
                headers=superuser_auth_headers,
            )
        assert resp.status_code == 200
        assert resp.json()["normalization"]["corrected_from"] is None

    @pytest.mark.asyncio
    async def test_200_suggestions_empty(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        v2_deck: Deck,
    ):
        """Suggestions array empty when no alternatives."""
        with patch("src.api.v1.admin.get_lemma_normalization_service") as mock_factory:
            mock_svc = MagicMock()
            mock_svc.normalize_smart.return_value = _mock_smart_result()
            mock_factory.return_value = mock_svc
            resp = await client.post(
                ENDPOINT,
                json={"word": "γάτα", "deck_id": str(v2_deck.id)},
                headers=superuser_auth_headers,
            )
        assert resp.status_code == 200
        assert resp.json()["suggestions"] == []

    @pytest.mark.asyncio
    async def test_200_suggestions_with_items(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        v2_deck: Deck,
    ):
        """Suggestions populated with alternative candidates."""
        suggestion = NormalizationCandidate(
            input_form="ο σπίτι",
            strategy="article_prefix",
            morphology=MorphologyResult(
                input_word="ο σπίτι",
                lemma="σπίτι",
                pos="NOUN",
                morph_features={"Gender": "Neut"},
                is_known=True,
                analysis_successful=True,
            ),
            confidence=0.8,
            corrected_from=None,
        )
        with patch("src.api.v1.admin.get_lemma_normalization_service") as mock_factory:
            mock_svc = MagicMock()
            mock_svc.normalize_smart.return_value = _mock_smart_result(suggestions=[suggestion])
            mock_factory.return_value = mock_svc
            resp = await client.post(
                ENDPOINT,
                json={"word": "γάτα", "deck_id": str(v2_deck.id)},
                headers=superuser_auth_headers,
            )
        assert resp.status_code == 200
        suggs = resp.json()["suggestions"]
        assert len(suggs) == 1
        assert suggs[0]["lemma"] == "σπίτι"
        assert suggs[0]["pos"] == "NOUN"
        assert suggs[0]["confidence"] == 0.8
        assert suggs[0]["strategy"] == "article_prefix"
        assert suggs[0]["confidence_tier"] == "high"

    @pytest.mark.asyncio
    async def test_400_bare_article_input(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        v2_deck: Deck,
    ):
        """Just-article input returns HTTP 400."""
        with patch("src.api.v1.admin.get_lemma_normalization_service") as mock_factory:
            mock_svc = MagicMock()
            mock_svc.normalize_smart.side_effect = ValueError(
                "No word provided after article detection"
            )
            mock_factory.return_value = mock_svc
            resp = await client.post(
                ENDPOINT,
                json={"word": "το", "deck_id": str(v2_deck.id)},
                headers=superuser_auth_headers,
            )
        assert resp.status_code == 400
        assert "No word provided" in resp.json()["error"]["message"]

    # -------------------------------------------------------------------------
    # Lexicon strategy tests (NGEN-09)
    # -------------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_200_strategy_lexicon(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        v2_deck: Deck,
    ):
        """strategy='lexicon' appears in response for known lexicon words."""
        with patch("src.api.v1.admin.get_lemma_normalization_service") as mock_factory:
            mock_svc = MagicMock()
            mock_svc.normalize_smart.return_value = _mock_smart_result(
                strategy="lexicon", confidence=1.0
            )
            mock_factory.return_value = mock_svc
            resp = await client.post(
                ENDPOINT,
                json={"word": "σπίτι", "deck_id": str(v2_deck.id)},
                headers=superuser_auth_headers,
            )
        assert resp.status_code == 200
        norm = resp.json()["normalization"]
        assert norm["strategy"] == "lexicon"
        assert norm["confidence"] == 1.0
        assert norm["confidence_tier"] == "high"

    @pytest.mark.asyncio
    async def test_200_fallback_when_not_in_lexicon(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        v2_deck: Deck,
    ):
        """When word is not in lexicon, falls back to direct strategy."""
        with patch("src.api.v1.admin.get_lemma_normalization_service") as mock_factory:
            mock_svc = MagicMock()
            mock_svc.normalize_smart.return_value = _mock_smart_result(
                strategy="direct", confidence=0.8
            )
            mock_factory.return_value = mock_svc
            resp = await client.post(
                ENDPOINT,
                json={"word": "γάτα", "deck_id": str(v2_deck.id)},
                headers=superuser_auth_headers,
            )
        assert resp.status_code == 200
        assert resp.json()["normalization"]["strategy"] == "direct"

    @pytest.mark.asyncio
    async def test_lexicon_entry_passed_to_normalize_smart(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        v2_deck: Deck,
        db_session: AsyncSession,
    ):
        """Endpoint passes lexicon_entry to normalize_smart when found in DB."""
        from sqlalchemy import text as sa_text

        await db_session.execute(
            sa_text(
                "INSERT INTO reference.greek_lexicon (form, lemma, pos, gender, ptosi, number) "
                "VALUES (:form, :lemma, :pos, :gender, :ptosi, :number)"
            ),
            {
                "form": "σπίτι",
                "lemma": "σπίτι",
                "pos": "NOUN",
                "gender": "Neut",
                "ptosi": "Nom",
                "number": "Sing",
            },
        )
        await db_session.flush()

        with patch("src.api.v1.admin.get_lemma_normalization_service") as mock_factory:
            mock_svc = MagicMock()
            mock_svc.normalize_smart.return_value = _mock_smart_result(strategy="lexicon")
            mock_factory.return_value = mock_svc
            resp = await client.post(
                ENDPOINT,
                json={"word": "σπίτι", "deck_id": str(v2_deck.id)},
                headers=superuser_auth_headers,
            )

        assert resp.status_code == 200
        call_kwargs = mock_svc.normalize_smart.call_args
        lexicon_arg = call_kwargs.kwargs.get("lexicon_entry") or call_kwargs[1].get("lexicon_entry")
        assert lexicon_arg is not None
        assert lexicon_arg.lemma == "σπίτι"
        assert lexicon_arg.gender == "Neut"

    # -------------------------------------------------------------------------
    # Duplicate check (NGEN-08-03)
    # -------------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_200_duplicate_check_no_duplicate(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        v2_deck: Deck,
    ):
        """duplicate_check.is_duplicate is False when word is new."""
        with patch("src.api.v1.admin.get_lemma_normalization_service") as mock_factory:
            mock_svc = MagicMock()
            mock_svc.normalize_smart.return_value = _mock_smart_result()
            mock_factory.return_value = mock_svc
            resp = await client.post(
                ENDPOINT,
                json={"word": "γάτα", "deck_id": str(v2_deck.id)},
                headers=superuser_auth_headers,
            )
        assert resp.status_code == 200
        dup = resp.json()["duplicate_check"]
        assert dup["is_duplicate"] is False
        assert dup["existing_entry"] is None
        assert dup["matched_decks"] == []

    @pytest.mark.asyncio
    async def test_200_duplicate_check_found(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        v2_deck: Deck,
        db_session: AsyncSession,
    ):
        """duplicate_check.is_duplicate is True when lemma already exists in a deck."""
        from src.db.models import DeckWordEntry, PartOfSpeech, WordEntry

        existing = WordEntry(
            id=uuid4(),
            owner_id=None,
            lemma="γάτα",
            part_of_speech=PartOfSpeech.NOUN,
            translation_en="cat",
            is_active=True,
        )
        db_session.add(existing)
        await db_session.flush()
        db_session.add(DeckWordEntry(deck_id=v2_deck.id, word_entry_id=existing.id))
        await db_session.commit()

        with patch("src.api.v1.admin.get_lemma_normalization_service") as mock_factory:
            mock_svc = MagicMock()
            mock_svc.normalize_smart.return_value = _mock_smart_result()
            mock_factory.return_value = mock_svc
            resp = await client.post(
                ENDPOINT,
                json={"word": "γάτα", "deck_id": str(v2_deck.id)},
                headers=superuser_auth_headers,
            )
        assert resp.status_code == 200
        dup = resp.json()["duplicate_check"]
        assert dup["is_duplicate"] is True
        assert dup["existing_entry"] is not None
        assert dup["existing_entry"]["lemma"] == "γάτα"
        assert len(dup["matched_decks"]) > 0
        assert dup["matched_decks"][0]["deck_name"] == v2_deck.name_en

    # -------------------------------------------------------------------------
    # Translation Lookup Stage (Stage 2.5)
    # -------------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_generate_includes_dictionary_translations(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        v2_deck: Deck,
    ):
        """translation_lookup contains source='dictionary' when kaikki/freedict rows exist."""
        from unittest.mock import AsyncMock

        from src.services.translation_service import TranslationEntry, TranslationResult

        mock_en = TranslationResult(
            translations=[
                TranslationEntry(
                    lemma="γάτα",
                    language="en",
                    sense_index=0,
                    translation="cat",
                    part_of_speech="NOUN",
                    source="kaikki",
                )
            ],
            source="dictionary",
            combined_text="cat",
        )
        mock_ru = TranslationResult(
            translations=[
                TranslationEntry(
                    lemma="γάτα",
                    language="ru",
                    sense_index=0,
                    translation="кошка",
                    part_of_speech="NOUN",
                    source="freedict",
                )
            ],
            source="dictionary",
            combined_text="кошка",
        )

        with (
            patch("src.api.v1.admin.get_lemma_normalization_service") as mock_factory,
            patch("src.api.v1.admin.TranslationLookupService") as mock_tl_cls,
        ):
            mock_svc = MagicMock()
            mock_svc.normalize_smart.return_value = _mock_smart_result()
            mock_factory.return_value = mock_svc

            mock_tl_instance = MagicMock()
            mock_tl_instance.lookup_bilingual = AsyncMock(
                return_value={"en": mock_en, "ru": mock_ru}
            )
            mock_tl_cls.return_value = mock_tl_instance

            resp = await client.post(
                ENDPOINT,
                json={"word": "γάτα", "deck_id": str(v2_deck.id)},
                headers=superuser_auth_headers,
            )

        assert resp.status_code == 200
        data = resp.json()
        tl = data["translation_lookup"]
        assert tl is not None
        assert tl["en"]["source"] == "dictionary"
        assert tl["ru"]["source"] == "dictionary"
        assert "cat" in tl["en"]["combined_text"]
        assert tl["en"]["sense_count"] == 1

    @pytest.mark.asyncio
    async def test_generate_includes_pivot_translations(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        v2_deck: Deck,
    ):
        """translation_lookup contains source='pivot' when only pivot rows exist."""
        from unittest.mock import AsyncMock

        from src.services.translation_service import TranslationEntry, TranslationResult

        mock_pivot = TranslationResult(
            translations=[
                TranslationEntry(
                    lemma="γάτα",
                    language="ru",
                    sense_index=0,
                    translation="кот",
                    part_of_speech="NOUN",
                    source="pivot",
                )
            ],
            source="pivot",
            combined_text="кот",
        )
        mock_empty = TranslationResult(translations=[], source="none", combined_text="")

        with (
            patch("src.api.v1.admin.get_lemma_normalization_service") as mock_factory,
            patch("src.api.v1.admin.TranslationLookupService") as mock_tl_cls,
        ):
            mock_svc = MagicMock()
            mock_svc.normalize_smart.return_value = _mock_smart_result()
            mock_factory.return_value = mock_svc

            mock_tl_instance = MagicMock()
            mock_tl_instance.lookup_bilingual = AsyncMock(
                return_value={"en": mock_empty, "ru": mock_pivot}
            )
            mock_tl_cls.return_value = mock_tl_instance

            resp = await client.post(
                ENDPOINT,
                json={"word": "γάτα", "deck_id": str(v2_deck.id)},
                headers=superuser_auth_headers,
            )

        assert resp.status_code == 200
        data = resp.json()
        tl = data["translation_lookup"]
        assert tl is not None
        assert tl["en"]["source"] == "none"
        assert tl["ru"]["source"] == "pivot"
        assert tl["ru"]["combined_text"] == "кот"

    @pytest.mark.asyncio
    async def test_generate_no_translations_source_none(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        v2_deck: Deck,
    ):
        """translation_lookup has source='none' for both languages when table is empty."""
        from unittest.mock import AsyncMock

        from src.services.translation_service import TranslationResult

        mock_empty = TranslationResult(translations=[], source="none", combined_text="")

        with (
            patch("src.api.v1.admin.get_lemma_normalization_service") as mock_factory,
            patch("src.api.v1.admin.TranslationLookupService") as mock_tl_cls,
        ):
            mock_svc = MagicMock()
            mock_svc.normalize_smart.return_value = _mock_smart_result()
            mock_factory.return_value = mock_svc

            mock_tl_instance = MagicMock()
            mock_tl_instance.lookup_bilingual = AsyncMock(
                return_value={"en": mock_empty, "ru": mock_empty}
            )
            mock_tl_cls.return_value = mock_tl_instance

            resp = await client.post(
                ENDPOINT,
                json={"word": "γάτα", "deck_id": str(v2_deck.id)},
                headers=superuser_auth_headers,
            )

        assert resp.status_code == 200
        data = resp.json()
        tl = data["translation_lookup"]
        assert tl is not None
        assert tl["en"]["source"] == "none"
        assert tl["ru"]["source"] == "none"
        assert tl["en"]["sense_count"] == 0
        assert tl["ru"]["sense_count"] == 0
