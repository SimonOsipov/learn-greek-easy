from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.db.models import CardType, WordEntry
from src.schemas.v2_sm2 import V2StudyQueueCard
from src.services.v2_sm2_service import V2SM2Service


@pytest.mark.unit
@pytest.mark.sm2
class TestV2SM2ServiceRussianEnrichment:
    def _make_card(
        self, card_type: CardType = CardType.MEANING_EL_TO_EN, front_content: dict | None = None
    ) -> V2StudyQueueCard:
        return V2StudyQueueCard(
            card_record_id=uuid4(),
            word_entry_id=uuid4(),
            deck_id=uuid4(),
            deck_name="Test Deck",
            card_type=card_type,
            variant_key="meaning",
            front_content=front_content or {},
            back_content={"translation": "house"},
            is_new=False,
        )

    def _make_word_entry(
        self,
        audio_key: str | None = "audio/spiti.mp3",
        examples: list | None = None,
        translation_ru: str | None = None,
        translation_ru_plural: str | None = None,
    ) -> MagicMock:
        we = MagicMock(spec=WordEntry)
        we.audio_key = audio_key
        we.examples = examples or []
        we.translation_ru = translation_ru
        we.translation_ru_plural = translation_ru_plural
        return we

    def _mock_db_execute(self, mock_db, word_entries: list) -> None:
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = word_entries
        mock_db.execute = AsyncMock(return_value=mock_result)

    @pytest.mark.asyncio
    async def test_translation_ru_populated_from_word_entry(self, mock_db_session):
        card = self._make_card()
        we = self._make_word_entry(translation_ru="дом")
        we.id = card.word_entry_id
        self._mock_db_execute(mock_db_session, [we])

        service = V2SM2Service(mock_db_session)
        with patch("src.services.v2_sm2_service.get_s3_service"):
            await service._enrich_with_audio([card])

        assert card.translation_ru == "дом"

    @pytest.mark.asyncio
    async def test_translation_ru_plural_populated_from_word_entry(self, mock_db_session):
        card = self._make_card()
        we = self._make_word_entry(translation_ru="дом", translation_ru_plural="дома")
        we.id = card.word_entry_id
        self._mock_db_execute(mock_db_session, [we])

        service = V2SM2Service(mock_db_session)
        with patch("src.services.v2_sm2_service.get_s3_service"):
            await service._enrich_with_audio([card])

        assert card.translation_ru_plural == "дома"

    @pytest.mark.asyncio
    async def test_translation_ru_none_when_word_entry_has_no_russian(self, mock_db_session):
        card = self._make_card()
        we = self._make_word_entry(translation_ru=None, translation_ru_plural=None)
        we.id = card.word_entry_id
        self._mock_db_execute(mock_db_session, [we])

        service = V2SM2Service(mock_db_session)
        with patch("src.services.v2_sm2_service.get_s3_service"):
            await service._enrich_with_audio([card])

        assert card.translation_ru is None
        assert card.translation_ru_plural is None

    @pytest.mark.asyncio
    async def test_sentence_ru_populated_for_target_to_el(self, mock_db_session):
        card = self._make_card(
            card_type=CardType.SENTENCE_TRANSLATION,
            front_content={"example_id": "ex1", "direction": "target_to_el"},
        )
        we = self._make_word_entry(
            examples=[
                {
                    "id": "ex1",
                    "greek": "Το σπίτι είναι μεγάλο",
                    "english": "The house is big",
                    "russian": "Дом большой",
                }
            ]
        )
        we.id = card.word_entry_id
        self._mock_db_execute(mock_db_session, [we])

        service = V2SM2Service(mock_db_session)
        with patch("src.services.v2_sm2_service.get_s3_service"):
            await service._enrich_with_audio([card])

        assert card.sentence_ru == "Дом большой"

    @pytest.mark.asyncio
    async def test_sentence_ru_none_for_el_to_target(self, mock_db_session):
        card = self._make_card(
            card_type=CardType.SENTENCE_TRANSLATION,
            front_content={"example_id": "ex1", "direction": "el_to_target"},
        )
        we = self._make_word_entry(
            examples=[
                {
                    "id": "ex1",
                    "greek": "Το σπίτι είναι μεγάλο",
                    "english": "The house is big",
                    "russian": "Дом большой",
                }
            ]
        )
        we.id = card.word_entry_id
        self._mock_db_execute(mock_db_session, [we])

        service = V2SM2Service(mock_db_session)
        with patch("src.services.v2_sm2_service.get_s3_service"):
            await service._enrich_with_audio([card])

        assert card.sentence_ru is None

    @pytest.mark.asyncio
    async def test_sentence_ru_none_for_non_sentence_card(self, mock_db_session):
        card = self._make_card(
            card_type=CardType.MEANING_EL_TO_EN,
            front_content={"direction": "target_to_el", "example_id": "ex1"},
        )
        we = self._make_word_entry(examples=[{"id": "ex1", "russian": "Дом большой"}])
        we.id = card.word_entry_id
        self._mock_db_execute(mock_db_session, [we])

        service = V2SM2Service(mock_db_session)
        with patch("src.services.v2_sm2_service.get_s3_service"):
            await service._enrich_with_audio([card])

        assert card.sentence_ru is None

    @pytest.mark.asyncio
    async def test_sentence_ru_none_when_example_has_no_russian(self, mock_db_session):
        card = self._make_card(
            card_type=CardType.SENTENCE_TRANSLATION,
            front_content={"example_id": "ex1", "direction": "target_to_el"},
        )
        we = self._make_word_entry(
            examples=[
                {
                    "id": "ex1",
                    "greek": "Το σπίτι είναι μεγάλο",
                    "english": "The house is big",
                }
            ]
        )
        we.id = card.word_entry_id
        self._mock_db_execute(mock_db_session, [we])

        service = V2SM2Service(mock_db_session)
        with patch("src.services.v2_sm2_service.get_s3_service"):
            await service._enrich_with_audio([card])

        assert card.sentence_ru is None
