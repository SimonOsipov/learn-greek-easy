"""Repository for CardRecord model with bulk upsert and filtered queries."""

from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import load_only

from src.db.models import CardRecord, CardType
from src.repositories.base import BaseRepository

# ---------------------------------------------------------------------------
# Columns projected by get_by_deck (admin/list path only — not the hot V2 path)
#
# EXCLUDED (proven unused by all callers of get_by_deck):
#   - front_content   large JSONB, not accessed by any caller of this method
#   - back_content    large JSONB, not accessed by any caller of this method
#
# INCLUDED: all other columns used by CardRecordResponse and/or test assertions.
#   id, word_entry_id, deck_id, card_type, tier, variant_key, is_active,
#   created_at, updated_at
#
# Note: get_by_deck is not in the hot production path (never called from the
# V2 service layer — only used in tests and admin workflows). The V2 hot path
# (get_new_cards / selectinload on CardRecordStatistics) returns full entities
# because v2_sm2_service accesses front_content and back_content.
# ---------------------------------------------------------------------------
_GET_BY_DECK_COLUMNS = [
    CardRecord.id,
    CardRecord.word_entry_id,
    CardRecord.deck_id,
    CardRecord.card_type,
    CardRecord.tier,
    CardRecord.variant_key,
    CardRecord.is_active,
    CardRecord.created_at,
    CardRecord.updated_at,
]


class CardRecordRepository(BaseRepository[CardRecord]):
    """Repository for CardRecord model with bulk operations.

    Provides standard CRUD via BaseRepository plus filtered queries,
    bulk upsert, and soft-delete for the V2 card system.
    """

    def __init__(self, db: AsyncSession):
        super().__init__(CardRecord, db)

    async def get_by_deck(
        self,
        deck_id: UUID,
        *,
        card_type: CardType | None = None,
        is_active: bool | None = None,
        tier: int | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[CardRecord]:
        """Get card records for a deck with optional filters.

        Column projection: excludes front_content and back_content (large JSONB)
        since no caller of this method accesses those fields. Use BaseRepository.get()
        for single-record access where full content is needed.

        Args:
            deck_id: Deck UUID (required)
            card_type: Optional filter by CardType enum value
            is_active: Optional filter by active status (None = no filter)
            tier: Optional filter by tier number
            skip: Pagination offset
            limit: Max results

        Returns:
            List of CardRecord ordered by created_at

        MissingGreenlet safety:
            Callers MUST NOT access front_content or back_content on the returned
            objects — those columns are not loaded and will trigger MissingGreenlet
            in async SQLAlchemy.
        """
        query = (
            select(CardRecord)
            .options(load_only(*_GET_BY_DECK_COLUMNS))
            .where(CardRecord.deck_id == deck_id)
        )

        if card_type is not None:
            query = query.where(CardRecord.card_type == card_type)
        if is_active is not None:
            query = query.where(CardRecord.is_active.is_(is_active))
        if tier is not None:
            query = query.where(CardRecord.tier == tier)

        query = query.order_by(CardRecord.created_at).offset(skip).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_by_word_entry(self, word_entry_id: UUID) -> list[CardRecord]:
        """Get all card records for a word entry.

        Args:
            word_entry_id: WordEntry UUID

        Returns:
            List of all CardRecord for this word entry (active and inactive)
        """
        query = (
            select(CardRecord)
            .where(CardRecord.word_entry_id == word_entry_id)
            .order_by(CardRecord.card_type, CardRecord.variant_key)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count_by_deck(
        self,
        deck_id: UUID,
        *,
        card_type: CardType | None = None,
        is_active: bool | None = None,
    ) -> int:
        """Count card records in a deck with optional filters.

        Args:
            deck_id: Deck UUID (required)
            card_type: Optional filter by CardType
            is_active: Optional filter by active status

        Returns:
            Total count of matching card records
        """
        query = select(func.count()).select_from(CardRecord).where(CardRecord.deck_id == deck_id)

        if card_type is not None:
            query = query.where(CardRecord.card_type == card_type)
        if is_active is not None:
            query = query.where(CardRecord.is_active.is_(is_active))

        result = await self.db.execute(query)
        return result.scalar_one()

    async def bulk_upsert(
        self,
        card_records_data: list[dict],
    ) -> tuple[list[CardRecord], int, int]:
        """Bulk create or update card records.

        Uses PostgreSQL ON CONFLICT DO UPDATE on the unique constraint
        (word_entry_id, card_type, variant_key) to efficiently handle both
        new records and updates in a single operation.

        Args:
            card_records_data: List of dicts, each containing:
                - word_entry_id: UUID
                - deck_id: UUID
                - card_type: CardType enum value or string
                - variant_key: str
                - tier: int or None
                - front_content: dict
                - back_content: dict
                - is_active: bool (optional, defaults to True)

        Returns:
            Tuple of:
            - List of all CardRecord objects (created and updated)
            - Number of records created
            - Number of records updated

        Note:
            Does NOT commit. Caller must call db.commit() after.
        """
        if not card_records_data:
            return [], 0, 0

        # Get existing keys to determine created vs updated count
        existing_query = select(
            CardRecord.word_entry_id, CardRecord.card_type, CardRecord.variant_key
        ).where(CardRecord.word_entry_id.in_([d["word_entry_id"] for d in card_records_data]))
        existing_result = await self.db.execute(existing_query)
        existing_keys = {
            (
                row.word_entry_id,
                (row.card_type.value if hasattr(row.card_type, "value") else row.card_type),
                row.variant_key,
            )
            for row in existing_result.all()
        }

        # Count created vs updated
        created_count = 0
        updated_count = 0

        for entry in card_records_data:
            card_type_value = entry["card_type"]
            if hasattr(card_type_value, "value"):
                card_type_value = card_type_value.value

            key = (entry["word_entry_id"], card_type_value, entry["variant_key"])
            if key in existing_keys:
                updated_count += 1
            else:
                created_count += 1

        # Columns to update on conflict (content and status, not keys)
        update_columns = [
            "deck_id",
            "tier",
            "front_content",
            "back_content",
            "is_active",
        ]

        insert_stmt = insert(CardRecord).values(card_records_data)

        # ON CONFLICT (word_entry_id, card_type, variant_key) DO UPDATE
        upsert_stmt = insert_stmt.on_conflict_do_update(
            constraint="uq_card_record_deck_entry_type_variant",
            set_={col: getattr(insert_stmt.excluded, col) for col in update_columns}
            | {"updated_at": func.now()},
        )

        # Execute and get back IDs
        returning_stmt = upsert_stmt.returning(CardRecord.id)
        result = await self.db.execute(returning_stmt)
        record_ids = [row[0] for row in result.all()]

        await self.db.flush()

        # Expire cached instances to avoid stale data
        for record_id in record_ids:
            existing = await self.db.get(CardRecord, record_id)
            if existing:
                self.db.expire(existing)

        # Fetch fresh data
        fetch_query = select(CardRecord).where(CardRecord.id.in_(record_ids))
        fetch_result = await self.db.execute(fetch_query)
        records = list(fetch_result.scalars().all())

        return records, created_count, updated_count

    async def deactivate_by_word_entry(self, word_entry_id: UUID) -> int:
        """Soft-delete all card records for a word entry.

        Sets is_active=False and updates updated_at for all matching records.

        Args:
            word_entry_id: WordEntry UUID

        Returns:
            Number of records deactivated

        Note:
            Does NOT commit. Caller must call db.commit() after.
        """
        result = await self.db.execute(
            update(CardRecord)
            .where(
                CardRecord.word_entry_id == word_entry_id,
                CardRecord.is_active.is_(True),
            )
            .values(is_active=False, updated_at=func.now())
        )
        await self.db.flush()
        return int(result.rowcount) if result.rowcount else 0  # type: ignore[attr-defined]
