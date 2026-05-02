"""CardRecordReview repository for V2 card system analytics."""

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import case, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import CardRecord, CardRecordReview
from src.repositories.base import BaseRepository


@dataclass(frozen=True)
class SessionAgg:
    """Aggregated statistics for a single study session.

    A session is a maximal run of reviews where each review is within
    30 minutes of the previous one (idle-gap boundary).

    Attributes:
        start_at: Timestamp of the first review in the session (UTC-aware).
        card_count: Total number of cards reviewed in the session.
        correct_count: Number of reviews with quality >= 3.
        total_time_seconds: Sum of per-card ``time_taken`` values (NOT
            wall-clock session length).  Individual answers can exceed the
            30-minute window; this is intentional.
        min_hour_utc: Earliest UTC hour (0-23) of any review in the session.
        max_hour_utc: Latest UTC hour (0-23) of any review in the session.
    """

    start_at: datetime
    card_count: int
    correct_count: int
    total_time_seconds: int
    min_hour_utc: int
    max_hour_utc: int


class CardRecordReviewRepository(BaseRepository[CardRecordReview]):
    """Repository for CardRecordReview model.

    Mirrors ReviewRepository but operates on the V2 card_records system.
    Review creation uses direct model instantiation in the service layer.
    """

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(CardRecordReview, db)

    async def count_reviews_today(self, user_id: UUID) -> int:
        """Count reviews completed today for this user.

        Args:
            user_id: User UUID.

        Returns:
            Number of reviews today.
        """
        today_start = datetime.combine(date.today(), datetime.min.time())
        query = (
            select(func.count())
            .select_from(CardRecordReview)
            .where(CardRecordReview.user_id == user_id)
            .where(CardRecordReview.reviewed_at >= today_start)
        )
        result = await self.db.execute(query)
        return result.scalar_one()

    async def delete_all_by_user_id(self, user_id: UUID) -> int:
        """Delete all card record reviews for a user.

        Args:
            user_id: User UUID.

        Returns:
            Number of deleted records.
        """
        result = await self.db.execute(
            delete(CardRecordReview).where(CardRecordReview.user_id == user_id)
        )
        return int(result.rowcount) if result.rowcount else 0  # type: ignore[attr-defined]

    async def get_daily_stats(
        self,
        user_id: UUID,
        start_date: date,
        end_date: date,
    ) -> list[dict]:
        """Get daily review statistics for a user within a date range.

        Args:
            user_id: User UUID.
            start_date: Start of date range (inclusive).
            end_date: End of date range (inclusive).

        Returns:
            List of dicts with date, reviews_count, avg_quality, total_time.
        """
        query = (
            select(
                func.date(CardRecordReview.reviewed_at).label("date"),
                func.count().label("reviews_count"),
                func.avg(CardRecordReview.quality).label("avg_quality"),
                func.coalesce(func.sum(CardRecordReview.time_taken), 0).label("total_time"),
            )
            .where(
                CardRecordReview.user_id == user_id,
                func.date(CardRecordReview.reviewed_at) >= start_date,
                func.date(CardRecordReview.reviewed_at) <= end_date,
            )
            .group_by(func.date(CardRecordReview.reviewed_at))
            .order_by(func.date(CardRecordReview.reviewed_at))
        )
        result = await self.db.execute(query)
        rows = result.all()
        return [
            {
                "date": row.date,
                "reviews_count": row.reviews_count,
                "avg_quality": float(row.avg_quality) if row.avg_quality is not None else 0.0,
                "total_time": int(row.total_time),
            }
            for row in rows
        ]

    async def get_study_time_today(self, user_id: UUID) -> int:
        """Get total study time in seconds for today.

        Args:
            user_id: User UUID.

        Returns:
            Total time_taken in seconds for today's reviews.
        """
        today_start = datetime.combine(date.today(), datetime.min.time())
        query = select(func.coalesce(func.sum(CardRecordReview.time_taken), 0)).where(
            CardRecordReview.user_id == user_id,
            CardRecordReview.reviewed_at >= today_start,
        )
        result = await self.db.execute(query)
        return int(result.scalar_one())

    async def get_total_reviews(self, user_id: UUID) -> int:
        """Get total number of reviews for a user across all time.

        Args:
            user_id: User UUID.

        Returns:
            Total review count.
        """
        query = (
            select(func.count())
            .select_from(CardRecordReview)
            .where(
                CardRecordReview.user_id == user_id,
            )
        )
        result = await self.db.execute(query)
        return result.scalar_one()

    async def get_total_study_time(self, user_id: UUID) -> int:
        """Get total study time in seconds across all time for a user.

        Args:
            user_id: User UUID.

        Returns:
            Total time_taken in seconds.
        """
        query = select(func.coalesce(func.sum(CardRecordReview.time_taken), 0)).where(
            CardRecordReview.user_id == user_id,
        )
        result = await self.db.execute(query)
        return int(result.scalar_one())

    async def get_accuracy_stats(self, user_id: UUID, days: int) -> dict[str, int]:
        """Get correct vs total review counts for a user over a rolling window.

        Args:
            user_id: User UUID.
            days: Number of days to look back.

        Returns:
            Dict with 'correct' and 'total' keys.
        """
        cutoff = datetime.combine(date.today() - timedelta(days=days), datetime.min.time())
        query = select(
            func.count().label("total"),
            func.sum(case((CardRecordReview.quality >= 3, 1), else_=0)).label("correct"),
        ).where(
            CardRecordReview.user_id == user_id,
            CardRecordReview.reviewed_at >= cutoff,
        )
        result = await self.db.execute(query)
        row = result.one()
        return {"correct": int(row.correct or 0), "total": int(row.total or 0)}

    async def get_daily_accuracy_stats(
        self,
        user_id: UUID,
        start_date: date,
        end_date: date,
    ) -> list[dict]:
        """Get per-day accuracy stats for a user within a date range.

        Args:
            user_id: User UUID.
            start_date: Start of date range (inclusive).
            end_date: End of date range (inclusive).

        Returns:
            List of dicts with date, correct, total.
        """
        query = (
            select(
                func.date(CardRecordReview.reviewed_at).label("date"),
                func.count().label("total"),
                func.sum(case((CardRecordReview.quality >= 3, 1), else_=0)).label("correct"),
            )
            .where(
                CardRecordReview.user_id == user_id,
                func.date(CardRecordReview.reviewed_at) >= start_date,
                func.date(CardRecordReview.reviewed_at) <= end_date,
            )
            .group_by(func.date(CardRecordReview.reviewed_at))
            .order_by(func.date(CardRecordReview.reviewed_at))
        )
        result = await self.db.execute(query)
        rows = result.all()
        return [
            {
                "date": row.date,
                "correct": int(row.correct or 0),
                "total": int(row.total),
            }
            for row in rows
        ]

    async def get_average_quality(self, user_id: UUID) -> float:
        """Get average review quality across all reviews for a user.

        Args:
            user_id: User UUID.

        Returns:
            Average quality score (0.0 if no reviews).
        """
        query = select(func.avg(CardRecordReview.quality)).where(
            CardRecordReview.user_id == user_id,
        )
        result = await self.db.execute(query)
        val = result.scalar_one()
        return float(val) if val is not None else 0.0

    async def get_unique_dates(self, user_id: UUID, days: int) -> list[date]:
        """Get distinct dates on which the user reviewed cards within a rolling window.

        Args:
            user_id: User UUID.
            days: Number of days to look back.

        Returns:
            List of dates in descending order.
        """
        cutoff = datetime.combine(date.today() - timedelta(days=days), datetime.min.time())
        query = (
            select(func.date(CardRecordReview.reviewed_at).label("review_date"))
            .where(
                CardRecordReview.user_id == user_id,
                CardRecordReview.reviewed_at >= cutoff,
            )
            .group_by(func.date(CardRecordReview.reviewed_at))
            .order_by(func.date(CardRecordReview.reviewed_at).desc())
        )
        result = await self.db.execute(query)
        return [row.review_date for row in result.all()]

    async def get_all_unique_dates(self, user_id: UUID) -> list[date]:
        """Get all distinct dates on which the user reviewed cards, oldest first.

        Args:
            user_id: User UUID.

        Returns:
            List of dates in ascending order.
        """
        query = (
            select(func.date(CardRecordReview.reviewed_at).label("review_date"))
            .where(CardRecordReview.user_id == user_id)
            .group_by(func.date(CardRecordReview.reviewed_at))
            .order_by(func.date(CardRecordReview.reviewed_at).asc())
        )
        result = await self.db.execute(query)
        return [row.review_date for row in result.all()]

    async def get_last_review_date(self, user_id: UUID) -> date | None:
        """Get the date of the most recent review for a user.

        Args:
            user_id: User UUID.

        Returns:
            Date of the last review, or None if no reviews exist.
        """
        query = select(func.max(CardRecordReview.reviewed_at)).where(
            CardRecordReview.user_id == user_id,
        )
        result = await self.db.execute(query)
        val = result.scalar_one()
        return val.date() if val is not None else None

    async def get_last_review_by_deck(self, user_id: UUID) -> dict[UUID, datetime]:
        """Get the most recent review timestamp per deck for a user.

        Args:
            user_id: User UUID.

        Returns:
            Dict mapping deck_id to the most recent review datetime.
        """
        query = (
            select(
                CardRecord.deck_id,
                func.max(CardRecordReview.reviewed_at).label("last_reviewed_at"),
            )
            .join(CardRecord, CardRecordReview.card_record_id == CardRecord.id)
            .where(CardRecordReview.user_id == user_id)
            .group_by(CardRecord.deck_id)
        )
        result = await self.db.execute(query)
        return {row.deck_id: row.last_reviewed_at for row in result.all()}

    async def get_deck_review_stats(self, user_id: UUID, deck_id: UUID) -> dict:
        """Get aggregated review statistics for a single deck.

        Args:
            user_id: User UUID.
            deck_id: Deck UUID.

        Returns:
            Dict with total_reviews, total_study_time_seconds, average_quality,
            first_reviewed_at, and last_reviewed_at.
        """
        query = (
            select(
                func.count().label("total_reviews"),
                func.coalesce(func.sum(CardRecordReview.time_taken), 0).label("total_study_time"),
                func.avg(CardRecordReview.quality).label("avg_quality"),
                func.min(CardRecordReview.reviewed_at).label("first_reviewed_at"),
                func.max(CardRecordReview.reviewed_at).label("last_reviewed_at"),
            )
            .join(CardRecord, CardRecordReview.card_record_id == CardRecord.id)
            .where(
                CardRecordReview.user_id == user_id,
                CardRecord.deck_id == deck_id,
            )
        )
        result = await self.db.execute(query)
        row = result.one()
        return {
            "total_reviews": int(row.total_reviews),
            "total_study_time_seconds": int(row.total_study_time),
            "average_quality": float(row.avg_quality) if row.avg_quality is not None else 0.0,
            "first_reviewed_at": row.first_reviewed_at,
            "last_reviewed_at": row.last_reviewed_at,
        }

    async def get_session_aggregates(self, user_id: UUID) -> list[SessionAgg]:
        """Return per-session aggregates for all reviews by a user.

        A session is a maximal run of reviews where consecutive reviews are
        separated by at most 30 minutes (idle gap).  If the gap between two
        consecutive reviews exceeds 30 minutes, a new session begins.

        The boundary check is **strict greater-than**: a gap of exactly 30
        minutes keeps the reviews in the *same* session; a gap of 30 minutes
        and 1 second starts a new one.

        ``total_time_seconds`` is the sum of per-card ``time_taken`` values,
        NOT the wall-clock duration of the session window.

        All hour values are in UTC.

        Args:
            user_id: User UUID.

        Returns:
            List of SessionAgg, one per detected session, ordered chronologically.
            Empty list if the user has no reviews.
        """
        query = (
            select(
                CardRecordReview.reviewed_at,
                CardRecordReview.quality,
                CardRecordReview.time_taken,
            )
            .where(CardRecordReview.user_id == user_id)
            .order_by(CardRecordReview.reviewed_at)
        )
        result = await self.db.execute(query)
        rows = result.all()

        if not rows:
            return []

        session_gap = timedelta(minutes=30)
        sessions: list[SessionAgg] = []

        # Accumulators for current session
        session_start: datetime = rows[0].reviewed_at
        card_count = 0
        correct_count = 0
        total_time = 0
        min_hour = 24
        max_hour = -1
        prev_ts: datetime = rows[0].reviewed_at

        for row in rows:
            ts: datetime = row.reviewed_at
            # Normalise to UTC-aware for hour extraction
            ts_utc = ts.astimezone(timezone.utc)
            hour = ts_utc.hour

            if card_count > 0 and (ts - prev_ts) > session_gap:
                # Flush current session
                sessions.append(
                    SessionAgg(
                        start_at=session_start,
                        card_count=card_count,
                        correct_count=correct_count,
                        total_time_seconds=total_time,
                        min_hour_utc=min_hour,
                        max_hour_utc=max_hour,
                    )
                )
                # Start new session
                session_start = ts
                card_count = 0
                correct_count = 0
                total_time = 0
                min_hour = 24
                max_hour = -1

            card_count += 1
            correct_count += 1 if row.quality >= 3 else 0
            total_time += row.time_taken
            min_hour = min(min_hour, hour)
            max_hour = max(max_hour, hour)
            prev_ts = ts

        # Flush final session
        sessions.append(
            SessionAgg(
                start_at=session_start,
                card_count=card_count,
                correct_count=correct_count,
                total_time_seconds=total_time,
                min_hour_utc=min_hour,
                max_hour_utc=max_hour,
            )
        )

        return sessions

    async def get_max_inactive_gap_days(self, user_id: UUID) -> int:
        """Return the longest gap in days between consecutive review dates.

        Considers only *internal* gaps — the trailing gap from the last review
        date to today is excluded.  A "comeback" requires both a gap AND a
        return, so the trailing period is not counted.

        Args:
            user_id: User UUID.

        Returns:
            Maximum gap in days between consecutive review dates (0 if the
            user has zero or one review dates, or all reviews are on the same
            day).
        """
        query = (
            select(func.date(CardRecordReview.reviewed_at).label("review_date"))
            .where(CardRecordReview.user_id == user_id)
            .group_by(func.date(CardRecordReview.reviewed_at))
            .order_by(func.date(CardRecordReview.reviewed_at).asc())
        )
        result = await self.db.execute(query)
        dates: list[date] = [row.review_date for row in result.all()]

        if len(dates) < 2:
            return 0

        max_gap = 0
        # Only iterate up to the second-to-last date to exclude trailing gap
        for i in range(len(dates) - 1):
            gap = (dates[i + 1] - dates[i]).days
            if gap > max_gap:
                max_gap = gap

        return max_gap

    async def get_consecutive_correct_streak(self, user_id: UUID) -> int:
        """Count the current run of correct reviews from the most recent.

        Walks reviews in descending ``reviewed_at`` order and counts until the
        first review with ``quality < 3``.  A review with ``quality >= 3`` is
        considered correct.

        Args:
            user_id: User UUID.

        Returns:
            Number of consecutive correct reviews ending with the most recent
            review (0 if no reviews or the most recent review is incorrect).
        """
        query = (
            select(CardRecordReview.quality)
            .where(CardRecordReview.user_id == user_id)
            .order_by(CardRecordReview.reviewed_at.desc())
        )
        result = await self.db.execute(query)
        streak = 0
        for (quality,) in result.all():
            if quality >= 3:
                streak += 1
            else:
                break
        return streak

    async def get_weekly_accuracy(self, user_id: UUID) -> tuple[int, int]:
        """Return (correct_count, total_count) for reviews in the last 7 days.

        Correct is defined as ``quality >= 3``.  All timestamps are compared
        in UTC.

        Args:
            user_id: User UUID.

        Returns:
            Tuple of (correct_count, total_count).  Both are 0 if the user
            has no reviews in the past 7 days.
        """
        cutoff = datetime.combine(date.today() - timedelta(days=7), datetime.min.time())
        query = select(
            func.count().label("total"),
            func.sum(case((CardRecordReview.quality >= 3, 1), else_=0)).label("correct"),
        ).where(
            CardRecordReview.user_id == user_id,
            CardRecordReview.reviewed_at >= cutoff,
        )
        result = await self.db.execute(query)
        row = result.one()
        return (int(row.correct or 0), int(row.total or 0))

    async def get_daily_review_counts(self, user_id: UUID) -> list[tuple[date, int]]:
        """Return per-day review counts across all time for a user.

        Used for daily-goal-streak metrics.

        Args:
            user_id: User UUID.

        Returns:
            List of (date, count) tuples ordered chronologically (ascending).
            Empty list if the user has no reviews.
        """
        query = (
            select(
                func.date(CardRecordReview.reviewed_at).label("review_date"),
                func.count().label("cnt"),
            )
            .where(CardRecordReview.user_id == user_id)
            .group_by(func.date(CardRecordReview.reviewed_at))
            .order_by(func.date(CardRecordReview.reviewed_at).asc())
        )
        result = await self.db.execute(query)
        return [(row.review_date, int(row.cnt)) for row in result.all()]
