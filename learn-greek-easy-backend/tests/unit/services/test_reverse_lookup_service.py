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
    match_type: str = "exact",
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
        rows = [_make_row(t, score=2.0, match_type="exact")]
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
        assert results[0].match_type == "exact"
        assert results[0].score == 2.0

    @pytest.mark.asyncio
    async def test_case_insensitive_match(self) -> None:
        t = _make_translation("σπίτι", "house", "NOUN")
        rows = [_make_row(t, score=2.0, match_type="exact")]
        db = _make_session(rows, [("σπίτι", "Neut")])
        service = ReverseLookupService(db)
        results = await service.search("House", "en")
        assert len(results) == 1
        assert results[0].lemma == "σπίτι"

    @pytest.mark.asyncio
    async def test_nouns_sorted_before_other_pos(self) -> None:
        t_verb = _make_translation("τρέχω", "run", "VERB", source="kaikki", sense_index=0)
        t_noun = _make_translation("τρέξιμο", "run", "NOUN", source="kaikki", sense_index=1)
        rows = [
            _make_row(t_verb, score=2.0, match_type="exact"),
            _make_row(t_noun, score=2.0, match_type="exact"),
        ]
        db = _make_session(rows, [("τρέξιμο", "Neut")])
        service = ReverseLookupService(db)
        results = await service.search("run", "en")
        assert results[0].pos == "NOUN"
        assert results[1].pos == "VERB"

    @pytest.mark.asyncio
    async def test_masculine_gender_from_lexicon(self) -> None:
        t = _make_translation("σκύλος", "dog", "NOUN")
        rows = [_make_row(t, score=2.0, match_type="exact")]
        db = _make_session(rows, [("σκύλος", "Masc")])
        service = ReverseLookupService(db)
        results = await service.search("dog", "en")
        assert results[0].gender == "masculine"
        assert results[0].article == "ο"

    @pytest.mark.asyncio
    async def test_feminine_gender_from_lexicon(self) -> None:
        t = _make_translation("γάτα", "cat", "NOUN")
        rows = [_make_row(t, score=2.0, match_type="exact")]
        db = _make_session(rows, [("γάτα", "Fem")])
        service = ReverseLookupService(db)
        results = await service.search("cat", "en")
        assert results[0].gender == "feminine"
        assert results[0].article == "η"

    @pytest.mark.asyncio
    async def test_noun_not_in_lexicon_has_none_gender(self) -> None:
        t = _make_translation("σπίτι", "house", "NOUN")
        rows = [_make_row(t, score=2.0, match_type="exact")]
        db = _make_session(rows, [])  # no lexicon results
        service = ReverseLookupService(db)
        results = await service.search("house", "en")
        assert results[0].gender is None
        assert results[0].article is None
        assert results[0].actionable is True  # still actionable

    @pytest.mark.asyncio
    async def test_translations_aggregated_and_deduped(self) -> None:
        t1 = _make_translation("σπίτι", "house", "NOUN", source="kaikki", sense_index=0)
        t2 = _make_translation("σπίτι", "home", "NOUN", source="kaikki", sense_index=1)
        t3 = _make_translation("σπίτι", "house", "NOUN", source="freedict", sense_index=0)
        rows = [
            _make_row(t1, score=2.0, match_type="exact"),
            _make_row(t2, score=2.0, match_type="exact"),
            _make_row(t3, score=2.0, match_type="exact"),
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
            _make_row(t1, score=2.0, match_type="exact"),
            _make_row(t2, score=2.0, match_type="exact"),
        ]
        db = _make_session(rows, [("σπίτι", "Neut")])
        service = ReverseLookupService(db)
        results = await service.search("house", "en")
        # kaikki comes first, so "house" should appear before "abode"
        assert results[0].translations[0] == "house"

    @pytest.mark.asyncio
    async def test_results_capped_at_limit(self) -> None:
        rows = [
            _make_row(_make_translation(f"λέμμα{i}", "word", "NOUN"), score=2.0, match_type="exact")
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
        rows = [_make_row(t, score=2.0, match_type="exact")]
        db = _make_session(rows, [("σπίτι", "Neut")])
        service = ReverseLookupService(db)
        results = await service.search("дом", "ru")
        assert len(results) == 1
        assert results[0].lemma == "σπίτι"

    @pytest.mark.asyncio
    async def test_non_noun_not_actionable(self) -> None:
        t = _make_translation("τρέχω", "run", "VERB")
        rows = [_make_row(t, score=2.0, match_type="exact")]
        db = _make_session(rows)  # no second call needed (no nouns)
        service = ReverseLookupService(db)
        results = await service.search("run", "en")
        assert results[0].actionable is False
        assert results[0].gender is None
        assert results[0].article is None

    @pytest.mark.asyncio
    async def test_alphabetical_within_pos_group(self) -> None:
        t1 = _make_translation("σπίτι", "place", "NOUN", source="kaikki", sense_index=0)
        t2 = _make_translation("αετός", "place", "NOUN", source="freedict", sense_index=0)
        rows = [
            _make_row(t1, score=2.0, match_type="exact"),
            _make_row(t2, score=2.0, match_type="exact"),
        ]
        db = _make_session(rows, [("σπίτι", "Neut"), ("αετός", "Masc")])
        service = ReverseLookupService(db)
        results = await service.search("place", "en")
        noun_results = [r for r in results if r.pos == "NOUN"]
        # αετός comes before σπίτι alphabetically
        assert noun_results[0].lemma == "αετός"
        assert noun_results[1].lemma == "σπίτι"

    @pytest.mark.asyncio
    async def test_null_pos_treated_as_non_noun(self) -> None:
        t = _make_translation("κάτι", "something", None)
        rows = [_make_row(t, score=2.0, match_type="exact")]
        db = _make_session(rows)
        service = ReverseLookupService(db)
        results = await service.search("something", "en")
        assert len(results) == 1
        assert results[0].pos == "X"
        assert results[0].actionable is False
        assert results[0].gender is None

    @pytest.mark.asyncio
    async def test_comma_separated_translations_found(self) -> None:
        """A query matching one word within a comma-separated translation string is found."""
        t = _make_translation("γιαγιά", "grandmother, grandma, granny", "NOUN")
        rows = [_make_row(t, score=2.0, match_type="exact")]
        db = _make_session(rows, [("γιαγιά", "Fem")])
        service = ReverseLookupService(db)
        results = await service.search("grandmother", "en")
        assert len(results) == 1
        assert results[0].lemma == "γιαγιά"
        assert results[0].match_type == "exact"

    @pytest.mark.asyncio
    async def test_fuzzy_match(self) -> None:
        """A close-but-not-exact word is found via word_similarity (score between 0 and 1)."""
        t = _make_translation("σπίτι", "house", "NOUN")
        rows = [_make_row(t, score=0.8, match_type="fuzzy")]
        db = _make_session(rows, [("σπίτι", "Neut")])
        service = ReverseLookupService(db)
        results = await service.search("hause", "en")
        assert len(results) == 1
        assert results[0].lemma == "σπίτι"
        assert results[0].match_type == "fuzzy"
        assert 0.0 < results[0].score < 2.0

    @pytest.mark.asyncio
    async def test_exact_ranked_above_fuzzy(self) -> None:
        """Exact matches (score 2.0) appear before fuzzy matches in results."""
        t_exact = _make_translation("σπίτι", "house", "NOUN", source="kaikki", sense_index=0)
        t_fuzzy = _make_translation("σπιτάκι", "louse", "NOUN", source="kaikki", sense_index=0)
        rows = [
            _make_row(t_exact, score=2.0, match_type="exact"),
            _make_row(t_fuzzy, score=0.75, match_type="fuzzy"),
        ]
        db = _make_session(rows, [("σπίτι", "Neut"), ("σπιτάκι", "Neut")])
        service = ReverseLookupService(db)
        results = await service.search("house", "en")
        assert results[0].lemma == "σπίτι"
        assert results[0].match_type == "exact"
        assert results[1].lemma == "σπιτάκι"
        assert results[1].match_type == "fuzzy"
