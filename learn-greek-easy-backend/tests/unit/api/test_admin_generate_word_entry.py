"""Unit tests for admin generate-word-entry endpoint.

Tests cover:
- POST /api/v1/admin/word-entries/generate
- 200 success with normalization stage result
- Confidence tier mapping (high/medium/low boundaries)
- Response envelope shape (future stages are None)
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
        """Returns 200 with stage='normalization' and confidence_tier='high' for confidence=1.0."""
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
        assert data["stage"] == "normalization"
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
        """Future pipeline stages are all None in the response envelope."""
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
        assert data["duplicate_check"] is None
        assert data["generation"] is None
        assert data["local_verification"] is None
        assert data["cross_verification"] is None
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
