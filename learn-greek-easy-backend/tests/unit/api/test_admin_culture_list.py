"""Tests for list_deck_questions endpoint with new fields, search, and sort."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories.culture import CultureDeckFactory, CultureQuestionFactory


class TestListDeckQuestions:
    """Tests for GET /api/v1/admin/culture/decks/{deck_id}/questions endpoint."""

    @pytest.mark.asyncio
    async def test_list_questions_returns_new_fields(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        deck = await CultureDeckFactory.create(session=db_session)
        await CultureQuestionFactory.create(
            session=db_session,
            deck_id=deck.id,
            audio_s3_key="culture/audio/test.mp3",
            original_article_url="https://example.com/article",
            order_index=5,
        )
        await db_session.flush()

        resp = await client.get(
            f"/api/v1/admin/culture/decks/{deck.id}/questions",
            headers=superuser_auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        q = data["questions"][0]
        assert "audio_s3_key" in q
        assert "original_article_url" in q
        assert "order_index" in q
        assert q["audio_s3_key"] == "culture/audio/test.mp3"
        assert q["original_article_url"] == "https://example.com/article"
        assert q["order_index"] == 5

    @pytest.mark.asyncio
    async def test_list_questions_without_news_item(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        deck = await CultureDeckFactory.create(session=db_session)
        await CultureQuestionFactory.create(session=db_session, deck_id=deck.id)
        await db_session.flush()

        resp = await client.get(
            f"/api/v1/admin/culture/decks/{deck.id}/questions",
            headers=superuser_auth_headers,
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_search_by_greek_text(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        deck = await CultureDeckFactory.create(session=db_session)
        await CultureQuestionFactory.create(
            session=db_session,
            deck_id=deck.id,
            question_text={
                "el": "Αθήνα είναι η πρωτεύουσα",
                "en": "Other question",
                "ru": "Другой вопрос",
            },
        )
        await CultureQuestionFactory.create(
            session=db_session,
            deck_id=deck.id,
            question_text={"el": "Θεσσαλονίκη", "en": "Another", "ru": "Ещё один"},
        )
        await db_session.flush()

        resp = await client.get(
            f"/api/v1/admin/culture/decks/{deck.id}/questions?search=Αθήνα",
            headers=superuser_auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert "Αθήνα" in data["questions"][0]["question_text"]["el"]

    @pytest.mark.asyncio
    async def test_search_by_english_text(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        deck = await CultureDeckFactory.create(session=db_session)
        await CultureQuestionFactory.create(
            session=db_session,
            deck_id=deck.id,
            question_text={"el": "Ελλάδα", "en": "Athens is the capital", "ru": "Другой"},
        )
        await CultureQuestionFactory.create(
            session=db_session,
            deck_id=deck.id,
            question_text={"el": "Κύπρος", "en": "Cyprus question", "ru": "Кипр"},
        )
        await db_session.flush()

        resp = await client.get(
            f"/api/v1/admin/culture/decks/{deck.id}/questions?search=Athens",
            headers=superuser_auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert "Athens" in data["questions"][0]["question_text"]["en"]

    @pytest.mark.asyncio
    async def test_search_case_insensitive(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        deck = await CultureDeckFactory.create(session=db_session)
        await CultureQuestionFactory.create(
            session=db_session,
            deck_id=deck.id,
            question_text={"el": "Αθήνα", "en": "ATHENS capital city", "ru": "Афины"},
        )
        await db_session.flush()

        resp = await client.get(
            f"/api/v1/admin/culture/decks/{deck.id}/questions?search=athens",
            headers=superuser_auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["total"] == 1

    @pytest.mark.asyncio
    async def test_sort_by_order_index(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        deck = await CultureDeckFactory.create(session=db_session)
        await CultureQuestionFactory.create(session=db_session, deck_id=deck.id, order_index=10)
        await CultureQuestionFactory.create(session=db_session, deck_id=deck.id, order_index=1)
        await CultureQuestionFactory.create(session=db_session, deck_id=deck.id, order_index=5)
        await db_session.flush()

        resp = await client.get(
            f"/api/v1/admin/culture/decks/{deck.id}/questions",
            headers=superuser_auth_headers,
        )
        assert resp.status_code == 200
        questions = resp.json()["questions"]
        assert len(questions) == 3
        order_indices = [q["order_index"] for q in questions]
        assert order_indices == sorted(order_indices)

    @pytest.mark.asyncio
    async def test_sort_by_created_at_desc(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        deck = await CultureDeckFactory.create(session=db_session)
        await CultureQuestionFactory.create(session=db_session, deck_id=deck.id)
        await CultureQuestionFactory.create(session=db_session, deck_id=deck.id)
        await db_session.flush()

        resp = await client.get(
            f"/api/v1/admin/culture/decks/{deck.id}/questions?sort_by=created_at&sort_order=desc",
            headers=superuser_auth_headers,
        )
        assert resp.status_code == 200
        questions = resp.json()["questions"]
        assert len(questions) == 2
        # First item should be newer (created later)
        created_ats = [q["created_at"] for q in questions]
        assert created_ats == sorted(created_ats, reverse=True)

    @pytest.mark.asyncio
    async def test_search_with_pagination(
        self,
        client: AsyncClient,
        superuser_auth_headers: dict,
        db_session: AsyncSession,
    ):
        deck = await CultureDeckFactory.create(session=db_session)
        for i in range(5):
            await CultureQuestionFactory.create(
                session=db_session,
                deck_id=deck.id,
                question_text={
                    "el": f"Αθήνα ερώτηση {i}",
                    "en": f"Athens question {i}",
                    "ru": f"Афины {i}",
                },
            )
        for i in range(3):
            await CultureQuestionFactory.create(
                session=db_session,
                deck_id=deck.id,
                question_text={
                    "el": f"Θεσσαλονίκη {i}",
                    "en": f"Thessaloniki {i}",
                    "ru": f"Салоники {i}",
                },
            )
        await db_session.flush()

        resp = await client.get(
            f"/api/v1/admin/culture/decks/{deck.id}/questions?search=Athens&page=1&page_size=2",
            headers=superuser_auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 5
        assert len(data["questions"]) == 2
