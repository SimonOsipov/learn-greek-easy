"""Unit tests for src/utils/greek_articles.py"""

from src.utils.greek_articles import (
    ACCUSATIVE_ARTICLES,
    ARTICLE_MAP,
    GENDER_MAP,
    GENITIVE_ARTICLES,
    NOMINATIVE_ARTICLES,
    get_nominative_article,
    infer_gender_from_ending,
)


class TestGetNominativeArticle:
    def test_masculine(self) -> None:
        assert get_nominative_article("Masc") == "ο "

    def test_feminine(self) -> None:
        assert get_nominative_article("Fem") == "η "

    def test_neuter(self) -> None:
        assert get_nominative_article("Neut") == "το "

    def test_unknown_returns_none(self) -> None:
        assert get_nominative_article("Unknown") is None

    def test_empty_string_returns_none(self) -> None:
        assert get_nominative_article("") is None


class TestGenderMap:
    def test_has_three_keys(self) -> None:
        assert len(GENDER_MAP) == 3

    def test_masc_maps_to_masculine(self) -> None:
        assert GENDER_MAP["Masc"] == "masculine"

    def test_fem_maps_to_feminine(self) -> None:
        assert GENDER_MAP["Fem"] == "feminine"

    def test_neut_maps_to_neuter(self) -> None:
        assert GENDER_MAP["Neut"] == "neuter"


class TestNominativeArticles:
    def test_has_all_three_genders(self) -> None:
        assert set(NOMINATIVE_ARTICLES.keys()) == {"masculine", "feminine", "neuter"}

    def test_each_gender_has_singular_and_plural(self) -> None:
        for gender, forms in NOMINATIVE_ARTICLES.items():
            assert "singular" in forms, f"{gender} missing singular"
            assert "plural" in forms, f"{gender} missing plural"

    def test_all_values_have_trailing_space(self) -> None:
        for gender, forms in NOMINATIVE_ARTICLES.items():
            for number, article in forms.items():
                assert article.endswith(" "), f"{gender}/{number} article missing trailing space"


class TestArticleMap:
    def test_has_three_cases(self) -> None:
        assert set(ARTICLE_MAP.keys()) == {"nominative", "genitive", "accusative"}

    def test_nominative_points_to_nominative_articles(self) -> None:
        assert ARTICLE_MAP["nominative"] is NOMINATIVE_ARTICLES

    def test_genitive_points_to_genitive_articles(self) -> None:
        assert ARTICLE_MAP["genitive"] is GENITIVE_ARTICLES

    def test_accusative_points_to_accusative_articles(self) -> None:
        assert ARTICLE_MAP["accusative"] is ACCUSATIVE_ARTICLES


class TestInferGenderFromEnding:
    def test_neuter_o(self) -> None:
        assert infer_gender_from_ending("βιβλίο") == "Neut"

    def test_neuter_o_accented(self) -> None:
        assert infer_gender_from_ending("δρόμο") == "Neut"

    def test_neuter_i(self) -> None:
        assert infer_gender_from_ending("παιδί") == "Neut"

    def test_neuter_i_accented(self) -> None:
        assert infer_gender_from_ending("ταξί") == "Neut"

    def test_masculine_os(self) -> None:
        assert infer_gender_from_ending("λόγος") == "Masc"

    def test_masculine_os_accented(self) -> None:
        assert infer_gender_from_ending("καιρός") == "Masc"

    def test_masculine_is(self) -> None:
        assert infer_gender_from_ending("μαθητής") == "Masc"

    def test_masculine_is_accented(self) -> None:
        assert infer_gender_from_ending("αθλητής") == "Masc"

    def test_masculine_as(self) -> None:
        assert infer_gender_from_ending("άντρας") == "Masc"

    def test_masculine_as_accented(self) -> None:
        assert infer_gender_from_ending("μπαμπάς") == "Masc"

    def test_feminine_i(self) -> None:
        assert infer_gender_from_ending("γυναίκη") == "Fem"

    def test_feminine_i_accented(self) -> None:
        assert infer_gender_from_ending("μητέρη") == "Fem"

    def test_feminine_a(self) -> None:
        assert infer_gender_from_ending("γάτα") == "Fem"

    def test_feminine_a_accented(self) -> None:
        assert infer_gender_from_ending("μαμά") == "Fem"

    def test_priority_os_before_o(self) -> None:
        # -ος must match as Masc, not -ο as Neut
        assert infer_gender_from_ending("λόγος") == "Masc"

    def test_priority_is_before_i(self) -> None:
        # -ης must match as Masc, not -η as Fem
        assert infer_gender_from_ending("μαθητής") == "Masc"

    def test_priority_as_before_a(self) -> None:
        # -ας must match as Masc, not -α as Fem
        assert infer_gender_from_ending("άντρας") == "Masc"

    def test_empty_string_returns_none(self) -> None:
        assert infer_gender_from_ending("") is None

    def test_single_char_returns_none(self) -> None:
        assert infer_gender_from_ending("α") is None

    def test_unrecognized_ending_returns_none(self) -> None:
        # "τεστ" ends in consonant τ — no match
        assert infer_gender_from_ending("τεστ") is None

    def test_two_char_word_neuter_o(self) -> None:
        # Shortest possible word that matches -ο
        assert infer_gender_from_ending("νο") == "Neut"

    def test_two_char_word_masculine_os_not_matched(self) -> None:
        # Single char word (just "ς") returns None, not Masc
        assert infer_gender_from_ending("ς") is None
