from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.logging import get_logger
from src.core.posthog import capture_event
from src.core.sm2 import calculate_next_review_date, calculate_sm2
from src.db.models import (
    CardRecord,
    CardRecordReview,
    CardRecordStatistics,
    CardStatus,
    CardType,
    WordEntry,
)
from src.repositories.card_record_statistics import CardRecordStatisticsRepository
from src.schemas.v2_sm2 import V2ReviewResult, V2StudyQueue, V2StudyQueueCard
from src.services.s3_service import get_s3_service

logger = get_logger(__name__)


class V2SM2Service:
    """Orchestrates V2 study queue assembly and audio enrichment."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.stats_repo = CardRecordStatisticsRepository(db)

    async def get_study_queue(
        self,
        user_id: UUID,
        deck_id: UUID | None,
        card_type: CardType | None = None,
        word_entry_id: UUID | None = None,
        limit: int = 20,
        include_new: bool = True,
        new_cards_limit: int = 10,
        include_early_practice: bool = False,
        early_practice_limit: int = 5,
        exclude_premium_decks: bool = False,
    ) -> V2StudyQueue:
        logger.debug(
            "Building V2 study queue",
            extra={
                "user_id": str(user_id),
                "deck_id": str(deck_id) if deck_id else None,
                "limit": limit,
                "card_type": card_type.value if card_type else None,
            },
        )

        # 1. Due cards first
        due_stats = await self.stats_repo.get_due_cards(
            user_id,
            deck_id,
            card_type=card_type,
            word_entry_id=word_entry_id,
            limit=limit,
            exclude_premium_decks=exclude_premium_decks,
        )
        logger.debug(
            "Found due cards",
            extra={"user_id": str(user_id), "due_count": len(due_stats)},
        )

        due_cards: list[V2StudyQueueCard] = [
            self._build_card_from_stats(stats, is_early_practice=False) for stats in due_stats
        ]

        # 2. New cards if room
        new_cards: list[V2StudyQueueCard] = []
        if include_new and len(due_cards) < limit:
            remaining_slots = min(new_cards_limit, limit - len(due_cards))
            new_records = await self.stats_repo.get_new_cards(
                user_id,
                deck_id,
                remaining_slots,
                card_type=card_type,
                word_entry_id=word_entry_id,
                exclude_premium_decks=exclude_premium_decks,
            )
            new_cards = [self._build_card_from_record(record) for record in new_records]
            logger.debug(
                "Added new cards",
                extra={"user_id": str(user_id), "new_count": len(new_cards)},
            )

        # 3. Early practice if room
        early_practice_cards: list[V2StudyQueueCard] = []
        current_count = len(due_cards) + len(new_cards)
        if include_early_practice and current_count < limit:
            remaining_slots = min(early_practice_limit, limit - current_count)
            early_stats = await self.stats_repo.get_early_practice_cards(
                user_id,
                deck_id,
                card_type=card_type,
                word_entry_id=word_entry_id,
                limit=remaining_slots,
                exclude_premium_decks=exclude_premium_decks,
            )
            early_practice_cards = [
                self._build_card_from_stats(stats, is_early_practice=True) for stats in early_stats
            ]
            logger.debug(
                "Added early practice cards",
                extra={
                    "user_id": str(user_id),
                    "early_practice_count": len(early_practice_cards),
                },
            )

        queue_cards = due_cards + new_cards + early_practice_cards
        await self._enrich_with_audio(queue_cards)

        logger.info(
            "V2 study queue built",
            extra={
                "user_id": str(user_id),
                "total_due": len(due_cards),
                "total_new": len(new_cards),
                "total_early_practice": len(early_practice_cards),
                "total_in_queue": len(queue_cards),
            },
        )

        return V2StudyQueue(
            total_due=len(due_cards),
            total_new=len(new_cards),
            total_early_practice=len(early_practice_cards),
            total_in_queue=len(queue_cards),
            cards=queue_cards,
        )

    def _build_card_from_stats(
        self,
        stats: CardRecordStatistics,
        *,
        is_early_practice: bool,
    ) -> V2StudyQueueCard:
        card_record = stats.card_record
        return V2StudyQueueCard(
            card_record_id=card_record.id,
            card_type=card_record.card_type,
            variant_key=card_record.variant_key,
            front_content=card_record.front_content,
            back_content=card_record.back_content,
            deck_id=card_record.deck_id,
            deck_name=card_record.deck.name_en,
            word_entry_id=card_record.word_entry_id,
            status=stats.status,
            is_new=False,
            is_early_practice=is_early_practice,
            due_date=stats.next_review_date,
            easiness_factor=stats.easiness_factor,
            interval=stats.interval,
            audio_url=None,
            example_audio_url=None,
        )

    def _build_card_from_record(self, card_record: CardRecord) -> V2StudyQueueCard:
        return V2StudyQueueCard(
            card_record_id=card_record.id,
            card_type=card_record.card_type,
            variant_key=card_record.variant_key,
            front_content=card_record.front_content,
            back_content=card_record.back_content,
            deck_id=card_record.deck_id,
            deck_name=card_record.deck.name_en,
            word_entry_id=card_record.word_entry_id,
            status=CardStatus.NEW,
            is_new=True,
            is_early_practice=False,
            due_date=None,
            easiness_factor=None,
            interval=None,
            audio_url=None,
            example_audio_url=None,
        )

    async def _enrich_with_audio(self, cards: list[V2StudyQueueCard]) -> None:
        if not cards:
            return

        we_ids = {c.word_entry_id for c in cards if c.word_entry_id}
        if not we_ids:
            return

        query = select(WordEntry).where(WordEntry.id.in_(we_ids))
        result = await self.db.execute(query)
        we_map: dict[UUID, WordEntry] = {we.id: we for we in result.scalars().all()}

        s3 = get_s3_service()
        for card in cards:
            we = we_map.get(card.word_entry_id)
            if not we:
                continue
            card.translation_ru = we.translation_ru
            card.translation_ru_plural = we.translation_ru_plural
            card.sentence_ru = self._get_sentence_ru(card, we)
            if we.audio_key:
                card.audio_url = s3.generate_presigned_url(we.audio_key)
                card.example_audio_url = self._get_example_audio_key(card, we)
                if card.example_audio_url:
                    card.example_audio_url = s3.generate_presigned_url(card.example_audio_url)

    def _get_sentence_ru(self, card: V2StudyQueueCard, we: WordEntry) -> str | None:
        """Return Russian sentence text for target_to_el sentence_translation cards."""
        if card.card_type != CardType.SENTENCE_TRANSLATION:
            return None
        direction = card.front_content.get("direction")
        if direction != "target_to_el":
            return None
        example_id = card.front_content.get("example_id")
        if not example_id or not we.examples:
            return None
        for ex in we.examples:
            if ex.get("id") == example_id:
                return ex.get("russian")
        return None

    def _get_example_audio_key(self, card: V2StudyQueueCard, we: WordEntry) -> str | None:
        if card.card_type == CardType.SENTENCE_TRANSLATION:
            example_id = card.front_content.get("example_id")
            if example_id and we.examples:
                for ex in we.examples:
                    if ex.get("id") == example_id:
                        return str(ex["audio_key"]) if ex.get("audio_key") else None
        elif card.card_type == CardType.CLOZE:
            example_index = card.front_content.get("example_index")
            if example_index is not None and we.examples and example_index < len(we.examples):
                ex = we.examples[example_index]
                return str(ex["audio_key"]) if ex.get("audio_key") else None
        return None

    async def process_review(
        self,
        user_id: UUID,
        card_record: CardRecord,
        quality: int,
        time_taken: int,
        user_email: str | None = None,
    ) -> V2ReviewResult:
        """Process a single V2 card review using the SM2 algorithm."""
        logger.debug(
            "Processing V2 review",
            extra={"card_record_id": str(card_record.id), "user_id": str(user_id)},
        )

        # Step 1: Get or create statistics
        stats = await self.stats_repo.get_or_create(user_id, card_record.id)

        # Step 2: Track previous state
        previous_status = stats.status
        is_first_review = stats.status == CardStatus.NEW
        was_mastered = stats.status == CardStatus.MASTERED

        # Step 3: Calculate SM2
        sm2_result = calculate_sm2(
            current_ef=stats.easiness_factor,
            current_interval=stats.interval,
            current_repetitions=stats.repetitions,
            quality=quality,
        )

        # Step 4: Calculate next review date
        next_review_date = calculate_next_review_date(sm2_result.new_interval)

        # Step 5: Update SM2 data
        await self.stats_repo.update_sm2_data(
            stats_id=stats.id,
            easiness_factor=sm2_result.new_easiness_factor,
            interval=sm2_result.new_interval,
            repetitions=sm2_result.new_repetitions,
            next_review_date=next_review_date,
            status=sm2_result.new_status,
        )

        # Step 6: Create review record
        review = CardRecordReview(
            user_id=user_id,
            card_record_id=card_record.id,
            quality=quality,
            time_taken=time_taken,
            reviewed_at=datetime.now(timezone.utc),
        )
        self.db.add(review)
        await self.db.flush()

        # Step 7: Fire PostHog event if newly mastered
        if sm2_result.new_status == CardStatus.MASTERED and previous_status != CardStatus.MASTERED:
            days_to_master = 0
            if stats.created_at:
                created_at = stats.created_at
                if created_at.tzinfo is not None:
                    created_at = created_at.replace(tzinfo=None)
                days_to_master = (datetime.now(timezone.utc).replace(tzinfo=None) - created_at).days
            capture_event(
                distinct_id=str(user_id),
                event="card_mastered_v2",
                properties={
                    "deck_id": str(card_record.deck_id),
                    "card_record_id": str(card_record.id),
                    "card_type": card_record.card_type.value,
                    "reviews_to_master": sm2_result.new_repetitions,
                    "days_to_master": days_to_master,
                },
                user_email=user_email,
            )

        # Step 8: Generate message
        message = self._get_review_message(
            quality=quality,
            is_first_review=is_first_review,
            was_mastered=was_mastered,
            is_now_mastered=sm2_result.new_status == CardStatus.MASTERED,
        )

        logger.info(
            "V2 review processed",
            extra={
                "card_record_id": str(card_record.id),
                "new_status": sm2_result.new_status.value,
            },
        )

        # Step 9: Return result
        return V2ReviewResult(
            card_record_id=card_record.id,
            quality=quality,
            previous_status=previous_status,
            new_status=sm2_result.new_status,
            easiness_factor=sm2_result.new_easiness_factor,
            interval=sm2_result.new_interval,
            repetitions=sm2_result.new_repetitions,
            next_review_date=next_review_date,
            message=message,
        )

    async def compute_review(
        self,
        user_id: UUID,
        card_record: CardRecord,
        quality: int,
        time_taken: int,
    ) -> tuple[V2ReviewResult, dict[str, Any]]:
        """Compute SM2 review result without persisting to DB.

        Returns a (result, context) tuple where context contains all serializable
        data needed for the persist phase (background or synchronous).
        """
        stats_repo = CardRecordStatisticsRepository(self.db)
        stats = await stats_repo.get_or_create(user_id, card_record.id)

        previous_status = stats.status
        is_first_review = stats.status == CardStatus.NEW
        was_mastered = stats.status == CardStatus.MASTERED

        sm2_result = calculate_sm2(
            current_ef=stats.easiness_factor,
            current_interval=stats.interval,
            current_repetitions=stats.repetitions,
            quality=quality,
        )

        next_review_date = calculate_next_review_date(sm2_result.new_interval)

        is_newly_mastered = not was_mastered and sm2_result.new_status == CardStatus.MASTERED

        message = self._get_review_message(
            quality=quality,
            is_first_review=is_first_review,
            was_mastered=was_mastered,
            is_now_mastered=sm2_result.new_status == CardStatus.MASTERED,
        )

        result = V2ReviewResult(
            card_record_id=card_record.id,
            quality=quality,
            previous_status=previous_status,
            new_status=sm2_result.new_status,
            easiness_factor=sm2_result.new_easiness_factor,
            interval=sm2_result.new_interval,
            repetitions=sm2_result.new_repetitions,
            next_review_date=next_review_date,
            message=message,
        )

        context: dict[str, Any] = {
            "user_id": str(user_id),
            "card_record_id": str(card_record.id),
            "deck_id": str(card_record.deck_id),
            "card_type_value": card_record.card_type.value,
            "quality": quality,
            "time_taken": time_taken,
            "stats_id": str(stats.id),
            "stats_created_at_iso": stats.created_at.isoformat() if stats.created_at else None,
            "new_ef": sm2_result.new_easiness_factor,
            "new_interval": sm2_result.new_interval,
            "new_repetitions": sm2_result.new_repetitions,
            "new_status_value": sm2_result.new_status.value,
            "next_review_date_iso": next_review_date.isoformat(),
            "previous_status_value": previous_status.value,
            "is_newly_mastered": is_newly_mastered,
        }

        return result, context

    async def persist_review(self, context: dict[str, Any]) -> None:
        """Persist a previously computed review to the DB (synchronous fallback path).

        Performs the DB writes (update SM2 data, create review record) and fires
        the PostHog mastery event when background tasks are disabled.
        """
        stats_repo = CardRecordStatisticsRepository(self.db)
        await stats_repo.update_sm2_data(
            stats_id=UUID(context["stats_id"]),
            easiness_factor=context["new_ef"],
            interval=context["new_interval"],
            repetitions=context["new_repetitions"],
            next_review_date=date.fromisoformat(context["next_review_date_iso"]),
            status=CardStatus(context["new_status_value"]),
        )

        review = CardRecordReview(
            card_record_id=UUID(context["card_record_id"]),
            user_id=UUID(context["user_id"]),
            quality=context["quality"],
            time_taken=context["time_taken"],
            reviewed_at=datetime.now(timezone.utc),
        )
        self.db.add(review)
        await self.db.flush()

        if context["is_newly_mastered"]:
            stats_created_at_iso: str | None = context["stats_created_at_iso"]
            days_to_master = 0
            if stats_created_at_iso:
                created_at = datetime.fromisoformat(stats_created_at_iso)
                if created_at.tzinfo is not None:
                    created_at = created_at.replace(tzinfo=None)
                days_to_master = (datetime.now(timezone.utc).replace(tzinfo=None) - created_at).days
            capture_event(
                distinct_id=context["user_id"],
                event="card_mastered_v2",
                properties={
                    "deck_id": context["deck_id"],
                    "card_record_id": context["card_record_id"],
                    "card_type": context["card_type_value"],
                    "reviews_to_master": context["new_repetitions"],
                    "days_to_master": days_to_master,
                },
            )

        await self._run_persist_review_side_effects(context)

    # DEPRECATED in Phase 5 (GAMIF-05): replaced by GamificationReconciler
    async def _run_persist_review_side_effects(self, context: dict[str, Any]) -> None:
        """Run non-critical side effects (reconcile gamification, daily goal, analytics)."""
        user_id_uuid = UUID(context["user_id"])

        # Reconcile gamification state (XP + achievements) via single entrypoint
        try:
            from src.services.gamification.reconciler import GamificationReconciler
            from src.services.gamification.types import ReconcileMode

            await GamificationReconciler.reconcile(
                self.db, user_id_uuid, mode=ReconcileMode.IMMEDIATE
            )
        except Exception as exc:
            logger.warning(
                "gamification.reconcile.error",
                event="gamification.reconcile.error",
                endpoint="v2_sm2_service.persist_review",
                user_id=context["user_id"],
                error_type=type(exc).__name__,
                error_message=str(exc),
            )

        # Check daily goal (unchanged — not in reconciler scope)
        await self._check_daily_goal_sync(user_id_uuid, context["user_id"])

        # Log analytics (unchanged)
        logger.info(
            "ANALYTICS: review_completed",
            extra={
                "analytics": True,
                "event_type": "review_completed",
                "user_id": context["user_id"],
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "event_data": {
                    "card_record_id": context["card_record_id"],
                    "quality": context["quality"],
                    "time_taken": context["time_taken"],
                    "new_status": context["new_status_value"],
                },
            },
        )

    async def _check_daily_goal_sync(self, user_id_uuid: UUID, user_id_str: str) -> None:
        """Check daily goal and notify if just completed (synchronous path)."""
        try:
            from sqlalchemy import select

            from src.core.redis import get_redis
            from src.db.models import UserSettings
            from src.repositories.card_record_review import CardRecordReviewRepository
            from src.services.notification_service import NotificationService

            result = await self.db.execute(
                select(UserSettings).where(UserSettings.user_id == user_id_uuid)
            )
            user_settings = result.scalar_one_or_none()
            daily_goal = user_settings.daily_goal if user_settings else 20

            review_repo = CardRecordReviewRepository(self.db)
            reviews_today = await review_repo.count_reviews_today(user_id_uuid)
            reviews_before = max(reviews_today - 1, 0)

            if reviews_before < daily_goal <= reviews_today:
                redis = get_redis()
                should_notify = True
                if redis:
                    cache_key = f"daily_goal_notified:{user_id_uuid}:{date.today().isoformat()}"
                    was_set = await redis.setnx(cache_key, "1")
                    if not was_set:
                        should_notify = False
                    else:
                        await redis.expire(cache_key, 86400)

                if should_notify:
                    notification_service = NotificationService(self.db)
                    await notification_service.notify_daily_goal_complete(
                        user_id=user_id_uuid,
                        reviews_completed=reviews_today,
                    )
                    logger.info(
                        "Daily goal notification created (persist_review sync path)",
                        extra={"user_id": user_id_str, "reviews": reviews_today},
                    )
        except Exception as e:
            logger.warning(
                "Daily goal check failed in persist_review",
                extra={"user_id": user_id_str, "error": str(e)},
            )

    def _get_review_message(
        self,
        quality: int,
        is_first_review: bool,
        was_mastered: bool,
        is_now_mastered: bool,
    ) -> str | None:
        """Generate a motivational message based on review outcome."""
        if is_now_mastered and not was_mastered:
            return "Congratulations! Card mastered!"
        if was_mastered and not is_now_mastered:
            return "Card needs more practice."
        if quality == 5:
            return "Perfect!"
        if is_first_review and quality >= 3:
            return "Good start!"
        return None
