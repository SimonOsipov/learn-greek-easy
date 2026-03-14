"""Unit tests for src/utils/greek_articles.py"""

from src.utils.greek_articles import (
    ACCUSATIVE_ARTICLES,
    ARTICLE_MAP,
    GENDER_MAP,
    GENITIVE_ARTICLES,
    NOMINATIVE_ARTICLES,
    get_nominative_article,
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
