"""Unit tests for ReverseLookupService."""

from unittest.mock import MagicMock

import pytest

from src.services.reverse_lookup_service import ReverseLookupService


def _make_translation(
    lemma: str,
    translation: str,
    part_of_speech: str | None,
    source: str = "kaikki",
    sense_index: int = 0,
    language: str = "en",
) -> MagicMock:
    row = MagicMock()
    row.lemma = lemma
    row.translation = translation
    row.part_of_speech = part_of_speech
    row.source = source
    row.sense_index = sense_index
    row.language = language
    return row


def _make_row(
    translation_mock: MagicMock,
    score: float = 2.0,
    match_type: str = "full",
) -> tuple:
    """Wrap a translation mock in a tuple as returned by the new single-pass query."""
    return (translation_mock, score, match_type)


def _make_session(
    translation_rows: list,
    lexicon_tuples: list[tuple[str, str]] | None = None,
) -> MagicMock:
    """Create a mock AsyncSession with up to three execute() calls.

    First call: SET pg_trgm.similarity_threshold → no-op MagicMock()
    Second call: returns tuples (Translation, score, match_type) via .all()
    Third call: returns tuples (lemma, gender) via .all()
    """
    mock_session = MagicMock()
    call_count = 0
    lexicon_tuples = lexicon_tuples or []

    # Second execute result (translations — uses .all() returning tuples)
    mock_translation_result = MagicMock()
    mock_translation_result.all.return_value = translation_rows

    # Third execute result (lexicon — uses .all() directly)
    mock_lexicon_result = MagicMock()
    mock_lexicon_result.all.return_value = lexicon_tuples

    async def mock_execute(stmt):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return MagicMock()  # SET statement — no-op
        if call_count == 2:
            return mock_translation_result
        return mock_lexicon_result

    mock_session.execute = mock_execute
    return mock_session


class TestReverseLookupServiceSearch:
    @pytest.mark.asyncio
    async def test_exact_match_returns_noun_with_article(self) -> None:
        t = _make_translation("σπίτι", "house", "NOUN")
        rows = [_make_row(t, score=3.0, match_type="full")]
        db = _make_session(rows, [("σπίτι", "Neut")])
        service = ReverseLookupService(db)
        results = await service.search("house", "en")
        assert len(results) == 1
        assert results[0].lemma == "σπίτι"
        assert results[0].pos == "NOUN"
        assert results[0].gender == "neuter"
        assert results[0].article == "το"
        assert results[0].actionable is True
        assert "house" in results[0].translations
        assert results[0].match_type == "full"
        assert results[0].score == 3.0

    @pytest.mark.asyncio
    async def test_case_insensitive_match(self) -> None:
        t = _make_translation("σπίτι", "house", "NOUN")
        rows = [_make_row(t, score=3.0, match_type="full")]
        db = _make_session(rows, [("σπίτι", "Neut")])
        service = ReverseLookupService(db)
        results = await service.search("House", "en")
        assert len(results) == 1
        assert results[0].lemma == "σπίτι"

    @pytest.mark.asyncio
    async def test_masculine_gender_from_lexicon(self) -> None:
        t = _make_translation("σκύλος", "dog", "NOUN")
        rows = [_make_row(t, score=3.0, match_type="full")]
        db = _make_session(rows, [("σκύλος", "Masc")])
        service = ReverseLookupService(db)
        results = await service.search("dog", "en")
        assert results[0].gender == "masculine"
        assert results[0].article == "ο"

    @pytest.mark.asyncio
    async def test_feminine_gender_from_lexicon(self) -> None:
        t = _make_translation("γάτα", "cat", "NOUN")
        rows = [_make_row(t, score=3.0, match_type="full")]
        db = _make_session(rows, [("γάτα", "Fem")])
        service = ReverseLookupService(db)
        results = await service.search("cat", "en")
        assert results[0].gender == "feminine"
        assert results[0].article == "η"

    @pytest.mark.asyncio
    async def test_noun_not_in_lexicon_uses_ending_fallback(self) -> None:
        """σπίτι ends in -ι → infer Neut gender when not in lexicon."""
        t = _make_translation("σπίτι", "house", "NOUN")
        rows = [_make_row(t, score=3.0, match_type="full")]
        db = _make_session(rows, [])  # empty lexicon
        service = ReverseLookupService(db)
        results = await service.search("house", "en")
        assert results[0].gender == "neuter"
        assert results[0].article == "το"
        assert results[0].actionable is True
        assert results[0].inferred_gender is True

    @pytest.mark.asyncio
    async def test_lexicon_gender_takes_priority_over_ending(self) -> None:
        """Lexicon gender wins over word-ending fallback."""
        t = _make_translation("γάτα", "cat", "NOUN")
        rows = [_make_row(t, score=3.0, match_type="full")]
        # Lexicon says masculine (unusual but let's test priority)
        lexicon_row = ("γάτα", "Masc")
        db = _make_session(rows, [lexicon_row])
        service = ReverseLookupService(db)
        results = await service.search("cat", "en")
        assert results[0].gender == "masculine"
        assert results[0].inferred_gender is False

    @pytest.mark.asyncio
    async def test_no_gender_when_unrecognized_ending_and_no_lexicon(self) -> None:
        """Lemma with unrecognized ending and no lexicon entry → gender=None."""
        t = _make_translation("τεστ", "test", "NOUN")
        rows = [_make_row(t, score=3.0, match_type="full")]
        db = _make_session(rows, [])  # empty lexicon
        service = ReverseLookupService(db)
        results = await service.search("test", "en")
        assert results[0].gender is None
        assert results[0].article is None
        assert results[0].inferred_gender is False

    @pytest.mark.asyncio
    async def test_inferred_gender_for_masculine_ending(self) -> None:
        """λόγος ends in -ος → infer Masc gender when not in lexicon."""
        t = _make_translation("λόγος", "word", "NOUN")
        rows = [_make_row(t, score=3.0, match_type="full")]
        db = _make_session(rows, [])  # empty lexicon
        service = ReverseLookupService(db)
        results = await service.search("word", "en")
        assert results[0].gender == "masculine"
        assert results[0].article == "ο"
        assert results[0].inferred_gender is True

    @pytest.mark.asyncio
    async def test_translations_aggregated_and_deduped(self) -> None:
        t1 = _make_translation("σπίτι", "house", "NOUN", source="kaikki", sense_index=0)
        t2 = _make_translation("σπίτι", "home", "NOUN", source="kaikki", sense_index=1)
        t3 = _make_translation("σπίτι", "house", "NOUN", source="freedict", sense_index=0)
        rows = [
            _make_row(t1, score=3.0, match_type="full"),
            _make_row(t2, score=3.0, match_type="full"),
            _make_row(t3, score=3.0, match_type="full"),
        ]
        db = _make_session(rows, [("σπίτι", "Neut")])
        service = ReverseLookupService(db)
        results = await service.search("house", "en")
        assert len(results) == 1
        # "house" appears only once despite two source rows
        assert results[0].translations.count("house") == 1
        assert "home" in results[0].translations

    @pytest.mark.asyncio
    async def test_source_priority_ordering(self) -> None:
        t1 = _make_translation("σπίτι", "house", "NOUN", source="kaikki", sense_index=0)
        t2 = _make_translation("σπίτι", "abode", "NOUN", source="pivot", sense_index=0)
        rows = [
            _make_row(t1, score=3.0, match_type="full"),
            _make_row(t2, score=3.0, match_type="full"),
        ]
        db = _make_session(rows, [("σπίτι", "Neut")])
        service = ReverseLookupService(db)
        results = await service.search("house", "en")
        # kaikki comes first, so "house" should appear before "abode"
        assert results[0].translations[0] == "house"

    @pytest.mark.asyncio
    async def test_results_capped_at_limit(self) -> None:
        rows = [
            _make_row(_make_translation(f"λέμμα{i}", "word", "NOUN"), score=3.0, match_type="full")
            for i in range(20)
        ]
        db = _make_session(rows, [])
        service = ReverseLookupService(db)
        results = await service.search("word", "en", limit=15)
        assert len(results) == 15

    @pytest.mark.asyncio
    async def test_empty_results_returns_empty_list(self) -> None:
        db = _make_session([])
        service = ReverseLookupService(db)
        results = await service.search("notfound", "en")
        assert results == []

    @pytest.mark.asyncio
    async def test_russian_language(self) -> None:
        t = _make_translation("σπίτι", "дом", "NOUN", language="ru")
        rows = [_make_row(t, score=3.0, match_type="full")]
        db = _make_session(rows, [("σπίτι", "Neut")])
        service = ReverseLookupService(db)
        results = await service.search("дом", "ru")
        assert len(results) == 1
        assert results[0].lemma == "σπίτι"

    @pytest.mark.asyncio
    async def test_alphabetical_within_pos_group(self) -> None:
        t1 = _make_translation("σπίτι", "place", "NOUN", source="kaikki", sense_index=0)
        t2 = _make_translation("αετός", "place", "NOUN", source="freedict", sense_index=0)
        rows = [
            _make_row(t1, score=3.0, match_type="full"),
            _make_row(t2, score=3.0, match_type="full"),
        ]
        db = _make_session(rows, [("σπίτι", "Neut"), ("αετός", "Masc")])
        service = ReverseLookupService(db)
        results = await service.search("place", "en")
        noun_results = [r for r in results if r.pos == "NOUN"]
        # αετός comes before σπίτι alphabetically
        assert noun_results[0].lemma == "αετός"
        assert noun_results[1].lemma == "σπίτι"

    @pytest.mark.asyncio
    async def test_comma_separated_translations_found(self) -> None:
        """A query matching one word within a comma-separated translation string is found."""
        t = _make_translation("γιαγιά", "grandmother, grandma, granny", "NOUN")
        rows = [_make_row(t, score=2.0, match_type="substring")]
        db = _make_session(rows, [("γιαγιά", "Fem")])
        service = ReverseLookupService(db)
        results = await service.search("grandmother", "en")
        assert len(results) == 1
        assert results[0].lemma == "γιαγιά"
        assert results[0].match_type == "substring"

    @pytest.mark.asyncio
    async def test_full_match_scores_3_0(self) -> None:
        """Translation exactly equal to query produces score=3.0 and match_type=full."""
        t = _make_translation("σπίτι", "house", "NOUN")
        rows = [_make_row(t, score=3.0, match_type="full")]
        db = _make_session(rows, [("σπίτι", "Neut")])
        service = ReverseLookupService(db)
        results = await service.search("house", "en")
        assert len(results) == 1
        assert results[0].lemma == "σπίτι"
        assert results[0].match_type == "full"
        assert results[0].score == 3.0

    @pytest.mark.asyncio
    async def test_full_ranked_above_substring(self) -> None:
        """Full matches (score 3.0) appear before substring matches (score 2.0) in results."""
        t_full = _make_translation("σπίτι", "house", "NOUN", source="kaikki", sense_index=0)
        t_substring = _make_translation(
            "σπιτάκι", "house warming", "NOUN", source="kaikki", sense_index=0
        )
        rows = [
            _make_row(t_full, score=3.0, match_type="full"),
            _make_row(t_substring, score=2.0, match_type="substring"),
        ]
        db = _make_session(rows, [("σπίτι", "Neut"), ("σπιτάκι", "Neut")])
        service = ReverseLookupService(db)
        results = await service.search("house", "en")
        assert results[0].lemma == "σπίτι"
        assert results[0].match_type == "full"
        assert results[1].lemma == "σπιτάκι"
        assert results[1].match_type == "substring"

    @pytest.mark.asyncio
    async def test_substring_short_scores_2_0(self) -> None:
        """Word boundary match in a short (<=40 char) translation → score=2.0, match_type=substring."""
        t = _make_translation("γιαγιά", "grandmother, grandma", "NOUN")
        rows = [_make_row(t, score=2.0, match_type="substring")]
        db = _make_session(rows, [("γιαγιά", "Fem")])
        service = ReverseLookupService(db)
        results = await service.search("grandmother", "en")
        assert len(results) == 1
        assert results[0].match_type == "substring"
        assert results[0].score == 2.0

    @pytest.mark.asyncio
    async def test_incidental_long_filtered_out(self) -> None:
        """Word boundary match in a >40 char translation → score=1.0, filtered out (returns [])."""
        t = _make_translation("σπίτι", "house", "NOUN")
        rows = [_make_row(t, score=1.0, match_type="incidental")]
        db = _make_session(rows, [("σπίτι", "Neut")])
        service = ReverseLookupService(db)
        results = await service.search("house", "en")
        assert results == []

    @pytest.mark.asyncio
    async def test_all_below_threshold_returns_empty(self) -> None:
        """All results with score < 2.0 are filtered out, returning empty list."""
        t1 = _make_translation("σπίτι", "house", "NOUN")
        t2 = _make_translation("αρχοντικό", "manor house building", "NOUN")
        rows = [
            _make_row(t1, score=1.0, match_type="incidental"),
            _make_row(t2, score=0.9, match_type="fuzzy"),
        ]
        db = _make_session(rows, [])
        service = ReverseLookupService(db)
        results = await service.search("house", "en")
        assert results == []

    @pytest.mark.asyncio
    async def test_lemma_with_mixed_scores_uses_highest(self) -> None:
        """When a lemma has two translations with different scores, the highest score wins."""
        t1 = _make_translation("σπίτι", "house", "NOUN", source="kaikki", sense_index=0)
        t2 = _make_translation(
            "σπίτι", "home and dwelling place here", "NOUN", source="kaikki", sense_index=1
        )
        rows = [
            _make_row(t1, score=2.0, match_type="substring"),
            _make_row(t2, score=1.0, match_type="incidental"),
        ]
        db = _make_session(rows, [("σπίτι", "Neut")])
        service = ReverseLookupService(db)
        results = await service.search("house", "en")
        # lemma kept because highest score is 2.0 >= threshold
        assert len(results) == 1
        assert results[0].lemma == "σπίτι"
        assert results[0].score == 2.0
        assert results[0].match_type == "substring"

    @pytest.mark.asyncio
    async def test_inferred_gender_field_defaults_false(self) -> None:
        """All results have inferred_gender=False in this subtask."""
        t = _make_translation("σπίτι", "house", "NOUN")
        rows = [_make_row(t, score=3.0, match_type="full")]
        db = _make_session(rows, [("σπίτι", "Neut")])
        service = ReverseLookupService(db)
        results = await service.search("house", "en")
        assert len(results) == 1
        assert results[0].inferred_gender is False

    @pytest.mark.asyncio
    async def test_non_noun_filtered_out(self) -> None:
        """Non-NOUN POS results are filtered out regardless of score."""
        t_verb = _make_translation("τρέχω", "run", "VERB")
        t_noun = _make_translation("δρόμος", "run", "NOUN")
        rows = [
            _make_row(t_verb, score=3.0, match_type="full"),
            _make_row(t_noun, score=3.0, match_type="full"),
        ]
        db = _make_session(rows, [("δρόμος", "Masc")])
        service = ReverseLookupService(db)
        results = await service.search("run", "en")
        assert all(r.pos == "NOUN" for r in results)
        assert len(results) == 1
        assert results[0].lemma == "δρόμος"
