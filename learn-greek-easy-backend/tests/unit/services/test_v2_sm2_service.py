from datetime import date, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.db.models import CardRecord, CardRecordStatistics, CardStatus, CardType, Deck, WordEntry
from src.schemas.v2_sm2 import V2ReviewResult, V2StudyQueueCard
from src.services.v2_sm2_service import V2SM2Service


def _create_mock_card_record_stats(
    card_type: CardType = CardType.MEANING_EL_TO_EN,
    deck_id=None,
    word_entry_id=None,
    status: CardStatus = CardStatus.REVIEW,
    next_review_date=None,
) -> MagicMock:
    deck_id = deck_id or uuid4()
    word_entry_id = word_entry_id or uuid4()
    next_review_date = next_review_date or date.today()

    mock_deck = MagicMock(spec=Deck)
    mock_deck.name_en = "Test Deck"

    mock_cr = MagicMock(spec=CardRecord)
    mock_cr.id = uuid4()
    mock_cr.card_type = card_type
    mock_cr.variant_key = "meaning"
    mock_cr.front_content = {"word": "σπίτι"}
    mock_cr.back_content = {"translation": "house"}
    mock_cr.deck_id = deck_id
    mock_cr.deck = mock_deck
    mock_cr.word_entry_id = word_entry_id

    mock_stats = MagicMock(spec=CardRecordStatistics)
    mock_stats.card_record = mock_cr
    mock_stats.status = status
    mock_stats.next_review_date = next_review_date
    mock_stats.easiness_factor = 2.5
    mock_stats.interval = 1
    return mock_stats


def _create_mock_new_card_record(
    card_type: CardType = CardType.MEANING_EL_TO_EN,
    deck_id=None,
    word_entry_id=None,
) -> MagicMock:
    deck_id = deck_id or uuid4()
    word_entry_id = word_entry_id or uuid4()

    mock_deck = MagicMock(spec=Deck)
    mock_deck.name_en = "Test Deck"

    mock_cr = MagicMock(spec=CardRecord)
    mock_cr.id = uuid4()
    mock_cr.card_type = card_type
    mock_cr.variant_key = "meaning"
    mock_cr.front_content = {"word": "γάτα"}
    mock_cr.back_content = {"translation": "cat"}
    mock_cr.deck_id = deck_id
    mock_cr.deck = mock_deck
    mock_cr.word_entry_id = word_entry_id
    return mock_cr


@pytest.mark.unit
@pytest.mark.sm2
class TestV2SM2ServiceGetStudyQueue:
    @pytest.mark.asyncio
    async def test_deck_scoped_mode_returns_due_and_new_cards(self, mock_db_session):
        deck_id = uuid4()
        due = [_create_mock_card_record_stats(deck_id=deck_id)]
        new = [_create_mock_new_card_record(deck_id=deck_id)]

        service = V2SM2Service(mock_db_session)
        service.stats_repo.get_due_cards = AsyncMock(return_value=due)
        service.stats_repo.get_new_cards = AsyncMock(return_value=new)
        service.stats_repo.get_early_practice_cards = AsyncMock(return_value=[])

        # mock _enrich_with_audio to be a no-op
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(
                scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))
            )
        )

        with patch("src.services.v2_sm2_service.get_s3_service"):
            result = await service.get_study_queue(user_id=uuid4(), deck_id=deck_id, card_type=None)

        assert result.total_due == 1
        assert result.total_new == 1
        assert result.total_in_queue == 2
        service.stats_repo.get_due_cards.assert_awaited_once()
        call_kwargs = service.stats_repo.get_due_cards.call_args
        assert call_kwargs.args[1] == deck_id

    @pytest.mark.asyncio
    async def test_card_type_scoped_mode_cross_deck(self, mock_db_session):
        due = [
            _create_mock_card_record_stats(card_type=CardType.CLOZE, deck_id=uuid4()),
            _create_mock_card_record_stats(card_type=CardType.CLOZE, deck_id=uuid4()),
        ]

        service = V2SM2Service(mock_db_session)
        service.stats_repo.get_due_cards = AsyncMock(return_value=due)
        service.stats_repo.get_new_cards = AsyncMock(return_value=[])
        service.stats_repo.get_early_practice_cards = AsyncMock(return_value=[])
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(
                scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))
            )
        )

        with patch("src.services.v2_sm2_service.get_s3_service"):
            result = await service.get_study_queue(
                user_id=uuid4(), deck_id=None, card_type=CardType.CLOZE
            )

        assert result.total_due == 2
        call_kwargs = service.stats_repo.get_due_cards.call_args
        assert call_kwargs.kwargs.get("card_type") == CardType.CLOZE
        assert call_kwargs.args[1] is None  # deck_id=None

    @pytest.mark.asyncio
    async def test_combined_mode_deck_and_card_type(self, mock_db_session):
        deck_id = uuid4()
        service = V2SM2Service(mock_db_session)
        service.stats_repo.get_due_cards = AsyncMock(return_value=[])
        service.stats_repo.get_new_cards = AsyncMock(return_value=[])
        service.stats_repo.get_early_practice_cards = AsyncMock(return_value=[])
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(
                scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))
            )
        )

        with patch("src.services.v2_sm2_service.get_s3_service"):
            await service.get_study_queue(
                user_id=uuid4(), deck_id=deck_id, card_type=CardType.CLOZE
            )

        for method in [
            service.stats_repo.get_due_cards,
            service.stats_repo.get_new_cards,
        ]:
            kwargs = method.call_args.kwargs
            assert kwargs.get("card_type") == CardType.CLOZE

    @pytest.mark.asyncio
    async def test_card_type_filter_narrows_results(self, mock_db_session):
        service = V2SM2Service(mock_db_session)
        service.stats_repo.get_due_cards = AsyncMock(return_value=[])
        service.stats_repo.get_new_cards = AsyncMock(return_value=[])
        service.stats_repo.get_early_practice_cards = AsyncMock(return_value=[])
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(
                scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))
            )
        )

        with patch("src.services.v2_sm2_service.get_s3_service"):
            await service.get_study_queue(
                user_id=uuid4(), deck_id=None, card_type=CardType.DECLENSION
            )

        assert service.stats_repo.get_due_cards.call_args.kwargs["card_type"] == CardType.DECLENSION

    @pytest.mark.asyncio
    async def test_inactive_card_records_excluded(self, mock_db_session):
        # Service trusts repo to handle is_active filtering; just verify repo is called
        service = V2SM2Service(mock_db_session)
        service.stats_repo.get_due_cards = AsyncMock(return_value=[])
        service.stats_repo.get_new_cards = AsyncMock(return_value=[])
        service.stats_repo.get_early_practice_cards = AsyncMock(return_value=[])
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(
                scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))
            )
        )

        with patch("src.services.v2_sm2_service.get_s3_service"):
            result = await service.get_study_queue(
                user_id=uuid4(), deck_id=None, card_type=CardType.CLOZE
            )

        service.stats_repo.get_due_cards.assert_awaited_once()
        assert result.total_in_queue == 0

    @pytest.mark.asyncio
    async def test_inactive_decks_excluded(self, mock_db_session):
        service = V2SM2Service(mock_db_session)
        service.stats_repo.get_due_cards = AsyncMock(return_value=[])
        service.stats_repo.get_new_cards = AsyncMock(return_value=[])
        service.stats_repo.get_early_practice_cards = AsyncMock(return_value=[])
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(
                scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))
            )
        )

        with patch("src.services.v2_sm2_service.get_s3_service"):
            result = await service.get_study_queue(
                user_id=uuid4(), deck_id=None, card_type=CardType.CLOZE
            )

        service.stats_repo.get_due_cards.assert_awaited_once()
        assert result.total_in_queue == 0

    @pytest.mark.asyncio
    async def test_premium_decks_excluded_for_free_users(self, mock_db_session):
        service = V2SM2Service(mock_db_session)
        service.stats_repo.get_due_cards = AsyncMock(return_value=[])
        service.stats_repo.get_new_cards = AsyncMock(return_value=[])
        service.stats_repo.get_early_practice_cards = AsyncMock(return_value=[])
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(
                scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))
            )
        )

        with patch("src.services.v2_sm2_service.get_s3_service"):
            await service.get_study_queue(
                user_id=uuid4(), deck_id=None, card_type=CardType.CLOZE, exclude_premium_decks=True
            )

        for method in [
            service.stats_repo.get_due_cards,
            service.stats_repo.get_new_cards,
        ]:
            assert method.call_args.kwargs["exclude_premium_decks"] is True

    @pytest.mark.asyncio
    async def test_empty_queue_returns_zero_totals(self, mock_db_session):
        service = V2SM2Service(mock_db_session)
        service.stats_repo.get_due_cards = AsyncMock(return_value=[])
        service.stats_repo.get_new_cards = AsyncMock(return_value=[])
        service.stats_repo.get_early_practice_cards = AsyncMock(return_value=[])
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(
                scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))
            )
        )

        with patch("src.services.v2_sm2_service.get_s3_service"):
            result = await service.get_study_queue(
                user_id=uuid4(), deck_id=None, card_type=CardType.CLOZE
            )

        assert result.total_due == 0
        assert result.total_new == 0
        assert result.total_early_practice == 0
        assert result.total_in_queue == 0
        assert result.cards == []

    @pytest.mark.asyncio
    async def test_early_practice_only_when_flag_true(self, mock_db_session):
        service = V2SM2Service(mock_db_session)
        service.stats_repo.get_due_cards = AsyncMock(return_value=[])
        service.stats_repo.get_new_cards = AsyncMock(return_value=[])
        service.stats_repo.get_early_practice_cards = AsyncMock(return_value=[])
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(
                scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))
            )
        )

        with patch("src.services.v2_sm2_service.get_s3_service"):
            await service.get_study_queue(
                user_id=uuid4(),
                deck_id=None,
                card_type=CardType.CLOZE,
                include_early_practice=False,
            )
        service.stats_repo.get_early_practice_cards.assert_not_awaited()

        service.stats_repo.get_early_practice_cards.reset_mock()
        with patch("src.services.v2_sm2_service.get_s3_service"):
            await service.get_study_queue(
                user_id=uuid4(), deck_id=None, card_type=CardType.CLOZE, include_early_practice=True
            )
        service.stats_repo.get_early_practice_cards.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_early_practice_ordered_nearest_first(self, mock_db_session):
        today = date.today()
        ep1 = _create_mock_card_record_stats(next_review_date=today + timedelta(days=1))
        ep2 = _create_mock_card_record_stats(next_review_date=today + timedelta(days=3))
        ep3 = _create_mock_card_record_stats(next_review_date=today + timedelta(days=7))

        service = V2SM2Service(mock_db_session)
        service.stats_repo.get_due_cards = AsyncMock(return_value=[])
        service.stats_repo.get_new_cards = AsyncMock(return_value=[])
        service.stats_repo.get_early_practice_cards = AsyncMock(return_value=[ep1, ep2, ep3])
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(
                scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))
            )
        )

        with patch("src.services.v2_sm2_service.get_s3_service"):
            result = await service.get_study_queue(
                user_id=uuid4(), deck_id=None, card_type=CardType.CLOZE, include_early_practice=True
            )

        assert len(result.cards) == 3
        assert result.cards[0].due_date == today + timedelta(days=1)
        assert result.cards[1].due_date == today + timedelta(days=3)
        assert result.cards[2].due_date == today + timedelta(days=7)

    @pytest.mark.asyncio
    async def test_early_practice_only_learning_and_review(self, mock_db_session):
        ep_learning = _create_mock_card_record_stats(
            status=CardStatus.LEARNING, next_review_date=date.today() + timedelta(days=1)
        )
        ep_review = _create_mock_card_record_stats(
            status=CardStatus.REVIEW, next_review_date=date.today() + timedelta(days=2)
        )

        service = V2SM2Service(mock_db_session)
        service.stats_repo.get_due_cards = AsyncMock(return_value=[])
        service.stats_repo.get_new_cards = AsyncMock(return_value=[])
        service.stats_repo.get_early_practice_cards = AsyncMock(
            return_value=[ep_learning, ep_review]
        )
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(
                scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))
            )
        )

        with patch("src.services.v2_sm2_service.get_s3_service"):
            result = await service.get_study_queue(
                user_id=uuid4(), deck_id=None, card_type=CardType.CLOZE, include_early_practice=True
            )

        assert result.total_early_practice == 2
        statuses = {c.status for c in result.cards}
        assert CardStatus.LEARNING in statuses
        assert CardStatus.REVIEW in statuses

    @pytest.mark.asyncio
    async def test_new_cards_excluded_when_include_new_false(self, mock_db_session):
        service = V2SM2Service(mock_db_session)
        service.stats_repo.get_due_cards = AsyncMock(return_value=[])
        service.stats_repo.get_new_cards = AsyncMock(return_value=[])
        service.stats_repo.get_early_practice_cards = AsyncMock(return_value=[])
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(
                scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))
            )
        )

        with patch("src.services.v2_sm2_service.get_s3_service"):
            result = await service.get_study_queue(
                user_id=uuid4(), deck_id=None, card_type=CardType.CLOZE, include_new=False
            )

        service.stats_repo.get_new_cards.assert_not_awaited()
        assert result.total_new == 0

    @pytest.mark.asyncio
    async def test_limit_new_cards_limit_early_practice_limit_respected(self, mock_db_session):
        service = V2SM2Service(mock_db_session)
        service.stats_repo.get_due_cards = AsyncMock(return_value=[])
        service.stats_repo.get_new_cards = AsyncMock(return_value=[])
        service.stats_repo.get_early_practice_cards = AsyncMock(return_value=[])
        mock_db_session.execute = AsyncMock(
            return_value=MagicMock(
                scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))
            )
        )

        with patch("src.services.v2_sm2_service.get_s3_service"):
            await service.get_study_queue(
                user_id=uuid4(),
                deck_id=None,
                card_type=CardType.CLOZE,
                include_early_practice=True,
                new_cards_limit=3,
                early_practice_limit=2,
            )

        new_call_args = service.stats_repo.get_new_cards.call_args
        assert new_call_args.args[2] == 3  # limit positional arg
        ep_call_args = service.stats_repo.get_early_practice_cards.call_args
        assert ep_call_args.kwargs["limit"] == 2


@pytest.mark.unit
@pytest.mark.sm2
class TestV2SM2ServiceAudioEnrichment:
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
        self, audio_key: str | None = "audio/spiti.mp3", examples: list | None = None
    ) -> MagicMock:
        we = MagicMock(spec=WordEntry)
        we.audio_key = audio_key
        we.examples = examples or []
        return we

    def _mock_db_execute(self, mock_db, word_entries: list) -> None:
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = word_entries
        mock_db.execute = AsyncMock(return_value=mock_result)

    @pytest.mark.asyncio
    async def test_audio_url_from_word_entry_audio_key(self, mock_db_session):
        card = self._make_card()
        we = self._make_word_entry(audio_key="audio/spiti.mp3")
        we.id = card.word_entry_id
        self._mock_db_execute(mock_db_session, [we])

        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.side_effect = lambda key: f"https://s3.example.com/{key}"

        service = V2SM2Service(mock_db_session)
        with patch("src.services.v2_sm2_service.get_s3_service", return_value=mock_s3):
            await service._enrich_with_audio([card])

        assert card.audio_url == "https://s3.example.com/audio/spiti.mp3"

    @pytest.mark.asyncio
    async def test_example_audio_url_sentence_translation_via_example_id(self, mock_db_session):
        card = self._make_card(
            card_type=CardType.SENTENCE_TRANSLATION,
            front_content={"example_id": "ex_spiti1"},
        )
        we = self._make_word_entry(
            audio_key="audio/spiti.mp3",
            examples=[
                {
                    "id": "ex_spiti1",
                    "audio_key": "audio/ex_spiti1.mp3",
                    "greek": "Το σπίτι είναι μεγάλο",
                }
            ],
        )
        we.id = card.word_entry_id
        self._mock_db_execute(mock_db_session, [we])

        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.side_effect = lambda key: (
            f"https://s3.example.com/{key}" if key else None
        )

        service = V2SM2Service(mock_db_session)
        with patch("src.services.v2_sm2_service.get_s3_service", return_value=mock_s3):
            await service._enrich_with_audio([card])

        assert card.example_audio_url == "https://s3.example.com/audio/ex_spiti1.mp3"

    @pytest.mark.asyncio
    async def test_example_audio_url_cloze_via_example_index(self, mock_db_session):
        card = self._make_card(
            card_type=CardType.CLOZE,
            front_content={"example_index": 0},
        )
        we = self._make_word_entry(
            audio_key="audio/spiti.mp3",
            examples=[{"audio_key": "audio/cloze0.mp3", "greek": "Το ___ είναι μεγάλο"}],
        )
        we.id = card.word_entry_id
        self._mock_db_execute(mock_db_session, [we])

        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.side_effect = lambda key: (
            f"https://s3.example.com/{key}" if key else None
        )

        service = V2SM2Service(mock_db_session)
        with patch("src.services.v2_sm2_service.get_s3_service", return_value=mock_s3):
            await service._enrich_with_audio([card])

        assert card.example_audio_url == "https://s3.example.com/audio/cloze0.mp3"

    @pytest.mark.asyncio
    async def test_example_audio_url_null_for_other_card_types(self, mock_db_session):
        card = self._make_card(card_type=CardType.MEANING_EL_TO_EN)
        we = self._make_word_entry(
            audio_key="audio/spiti.mp3",
            examples=[{"audio_key": "audio/ex.mp3"}],
        )
        we.id = card.word_entry_id
        self._mock_db_execute(mock_db_session, [we])

        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.side_effect = lambda key: f"https://s3.example.com/{key}"

        service = V2SM2Service(mock_db_session)
        with patch("src.services.v2_sm2_service.get_s3_service", return_value=mock_s3):
            await service._enrich_with_audio([card])

        assert card.example_audio_url is None

    @pytest.mark.asyncio
    async def test_example_audio_url_null_when_no_audio_key(self, mock_db_session):
        card = self._make_card(
            card_type=CardType.SENTENCE_TRANSLATION,
            front_content={"example_id": "ex1"},
        )
        we = self._make_word_entry(
            audio_key="audio/spiti.mp3",
            examples=[{"id": "ex1", "audio_key": None, "greek": "test"}],
        )
        we.id = card.word_entry_id
        self._mock_db_execute(mock_db_session, [we])

        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.side_effect = lambda key: (
            f"https://s3.example.com/{key}" if key else None
        )

        service = V2SM2Service(mock_db_session)
        with patch("src.services.v2_sm2_service.get_s3_service", return_value=mock_s3):
            await service._enrich_with_audio([card])

        assert card.example_audio_url is None


def _make_mock_stats(status: CardStatus = CardStatus.NEW) -> MagicMock:
    """Build a mock CardRecordStatistics with sensible defaults."""
    stats = MagicMock(spec=CardRecordStatistics)
    stats.id = uuid4()
    stats.status = status
    stats.easiness_factor = 2.5
    stats.interval = 1
    stats.repetitions = 0
    stats.created_at = None
    return stats


def _make_mock_card_record_for_review(
    card_type: CardType = CardType.MEANING_EL_TO_EN,
) -> MagicMock:
    """Build a mock CardRecord for compute/persist review tests."""
    mock_deck = MagicMock(spec=Deck)
    mock_deck.name_en = "Test Deck"

    cr = MagicMock(spec=CardRecord)
    cr.id = uuid4()
    cr.card_type = card_type
    cr.deck_id = uuid4()
    cr.deck = mock_deck
    return cr


@pytest.mark.unit
@pytest.mark.sm2
class TestV2SM2ServiceComputeReview:
    """Tests for compute_review() — pure computation, no DB writes."""

    EXPECTED_CONTEXT_KEYS = {
        "user_id",
        "card_record_id",
        "deck_id",
        "card_type_value",
        "quality",
        "time_taken",
        "stats_id",
        "stats_created_at_iso",
        "new_ef",
        "new_interval",
        "new_repetitions",
        "new_status_value",
        "next_review_date_iso",
        "previous_status_value",
        "is_newly_mastered",
    }

    @pytest.mark.asyncio
    async def test_compute_review_returns_result_and_context(self, mock_db_session):
        """compute_review should return a (V2ReviewResult, dict) 2-tuple."""
        card_record = _make_mock_card_record_for_review()
        mock_stats = _make_mock_stats()

        with patch("src.services.v2_sm2_service.CardRecordStatisticsRepository") as mock_repo_cls:
            mock_repo_cls.return_value.get_or_create = AsyncMock(return_value=mock_stats)

            service = V2SM2Service(mock_db_session)
            result, context = await service.compute_review(
                user_id=uuid4(),
                card_record=card_record,
                quality=4,
                time_taken=10,
            )

        assert isinstance(result, V2ReviewResult)
        assert isinstance(context, dict)

    @pytest.mark.asyncio
    async def test_compute_review_does_not_write_to_db(self, mock_db_session):
        """compute_review must not call update_sm2_data or db.add."""
        card_record = _make_mock_card_record_for_review()
        mock_stats = _make_mock_stats()

        with patch("src.services.v2_sm2_service.CardRecordStatisticsRepository") as mock_repo_cls:
            mock_stats_repo_instance = mock_repo_cls.return_value
            mock_stats_repo_instance.get_or_create = AsyncMock(return_value=mock_stats)

            service = V2SM2Service(mock_db_session)
            await service.compute_review(
                user_id=uuid4(),
                card_record=card_record,
                quality=4,
                time_taken=10,
            )

        mock_stats_repo_instance.update_sm2_data.assert_not_called()
        mock_db_session.add.assert_not_called()

    @pytest.mark.asyncio
    async def test_compute_review_context_keys(self, mock_db_session):
        """Context dict must contain exactly the 15 expected keys."""
        card_record = _make_mock_card_record_for_review()
        mock_stats = _make_mock_stats()

        with patch("src.services.v2_sm2_service.CardRecordStatisticsRepository") as mock_repo_cls:
            mock_repo_cls.return_value.get_or_create = AsyncMock(return_value=mock_stats)

            service = V2SM2Service(mock_db_session)
            _, context = await service.compute_review(
                user_id=uuid4(),
                card_record=card_record,
                quality=4,
                time_taken=10,
            )

        assert set(context.keys()) == self.EXPECTED_CONTEXT_KEYS

    @pytest.mark.asyncio
    async def test_compute_review_new_card_transitions_to_learning(self, mock_db_session):
        """NEW card with quality >= 3 should transition to LEARNING."""
        card_record = _make_mock_card_record_for_review()
        mock_stats = _make_mock_stats(status=CardStatus.NEW)

        with patch("src.services.v2_sm2_service.CardRecordStatisticsRepository") as mock_repo_cls:
            mock_repo_cls.return_value.get_or_create = AsyncMock(return_value=mock_stats)

            service = V2SM2Service(mock_db_session)
            result, context = await service.compute_review(
                user_id=uuid4(),
                card_record=card_record,
                quality=4,
                time_taken=10,
            )

        assert context["new_status_value"] == "learning"
        assert result.new_status == CardStatus.LEARNING

    @pytest.mark.asyncio
    async def test_compute_review_mastered_message(self, mock_db_session):
        """High quality + many repetitions should produce a mastery message."""
        card_record = _make_mock_card_record_for_review()
        mock_stats = _make_mock_stats(status=CardStatus.REVIEW)
        mock_stats.repetitions = 10
        mock_stats.interval = 21
        mock_stats.easiness_factor = 2.5

        with patch("src.services.v2_sm2_service.CardRecordStatisticsRepository") as mock_repo_cls:
            mock_repo_cls.return_value.get_or_create = AsyncMock(return_value=mock_stats)

            service = V2SM2Service(mock_db_session)
            result, context = await service.compute_review(
                user_id=uuid4(),
                card_record=card_record,
                quality=5,
                time_taken=5,
            )

        # With quality=5 and interval=21, new_status should be MASTERED
        if context["is_newly_mastered"]:
            assert result.message == "Congratulations! Card mastered!"


@pytest.mark.unit
@pytest.mark.sm2
class TestV2SM2ServicePersistReview:
    """Tests for persist_review() — DB writes using pre-computed context."""

    def _make_context(self, is_newly_mastered: bool = False) -> dict:
        return {
            "user_id": str(uuid4()),
            "card_record_id": str(uuid4()),
            "deck_id": str(uuid4()),
            "card_type_value": "meaning_el_to_en",
            "quality": 4,
            "time_taken": 10,
            "stats_id": str(uuid4()),
            "stats_created_at_iso": None,
            "new_ef": 2.5,
            "new_interval": 1,
            "new_repetitions": 1,
            "new_status_value": "learning",
            "next_review_date_iso": "2026-03-20",
            "previous_status_value": "new",
            "is_newly_mastered": is_newly_mastered,
        }

    @pytest.mark.asyncio
    async def test_persist_review_calls_update_sm2_data(self, mock_db_session):
        """persist_review should call update_sm2_data with values from context."""
        context = self._make_context()

        with patch("src.services.v2_sm2_service.CardRecordStatisticsRepository") as mock_repo_cls:
            mock_stats_repo = mock_repo_cls.return_value
            mock_stats_repo.update_sm2_data = AsyncMock()

            service = V2SM2Service(mock_db_session)
            await service.persist_review(context)

        mock_stats_repo.update_sm2_data.assert_awaited_once()
        call_kwargs = mock_stats_repo.update_sm2_data.call_args.kwargs
        assert call_kwargs["easiness_factor"] == context["new_ef"]
        assert call_kwargs["interval"] == context["new_interval"]
        assert call_kwargs["repetitions"] == context["new_repetitions"]

    @pytest.mark.asyncio
    async def test_persist_review_creates_review_record(self, mock_db_session):
        """persist_review should add a review record and flush the session."""
        context = self._make_context()

        with patch("src.services.v2_sm2_service.CardRecordStatisticsRepository") as mock_repo_cls:
            mock_repo_cls.return_value.update_sm2_data = AsyncMock()

            service = V2SM2Service(mock_db_session)
            await service.persist_review(context)

        mock_db_session.add.assert_called_once()
        mock_db_session.flush.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_persist_review_does_not_recalculate_sm2(self, mock_db_session):
        """persist_review must not call calculate_sm2 — values come from context."""
        context = self._make_context()

        with patch("src.services.v2_sm2_service.CardRecordStatisticsRepository") as mock_repo_cls:
            mock_repo_cls.return_value.update_sm2_data = AsyncMock()

            with patch("src.core.sm2.calculate_sm2") as mock_calc:
                service = V2SM2Service(mock_db_session)
                await service.persist_review(context)

        mock_calc.assert_not_called()

    @pytest.mark.asyncio
    async def test_persist_review_fires_posthog_on_mastery(self, mock_db_session):
        """persist_review should fire a PostHog event when is_newly_mastered=True."""
        context = self._make_context(is_newly_mastered=True)

        with patch("src.services.v2_sm2_service.CardRecordStatisticsRepository") as mock_repo_cls:
            mock_repo_cls.return_value.update_sm2_data = AsyncMock()

            with patch("src.services.v2_sm2_service.capture_event") as mock_capture:
                service = V2SM2Service(mock_db_session)
                await service.persist_review(context)

        mock_capture.assert_called_once()
        call_kwargs = mock_capture.call_args.kwargs
        assert call_kwargs["event"] == "card_mastered_v2"
