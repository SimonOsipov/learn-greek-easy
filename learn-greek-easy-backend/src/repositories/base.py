"""Base repository with generic CRUD operations."""

from typing import Any, Generic, Type, TypeVar
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import NotFoundException

# Type variable for SQLAlchemy models
ModelType = TypeVar("ModelType")


class BaseRepository(Generic[ModelType]):
    """Generic base repository with common CRUD operations.

    This repository provides standard database operations that all
    specific repositories can inherit. It uses SQLAlchemy 2.0 async
    patterns and type hints for type safety.

    Type Parameters:
        ModelType: The SQLAlchemy model class this repository manages.

    Example:
        class UserRepository(BaseRepository[User]):
            def __init__(self, db: AsyncSession):
                super().__init__(User, db)
    """

    def __init__(self, model: Type[ModelType], db: AsyncSession):
        """Initialize repository with model class and database session.

        Args:
            model: SQLAlchemy model class (e.g., User, Deck, Card)
            db: Async database session from dependency injection
        """
        self.model = model
        self.db = db

    async def get(self, id: UUID) -> ModelType | None:
        """Get a single record by primary key.

        Args:
            id: UUID primary key

        Returns:
            Model instance or None if not found

        Example:
            user = await user_repo.get(user_id)
            if user is None:
                raise HTTPException(status_code=404)
        """
        return await self.db.get(self.model, id)

    async def get_or_404(self, id: UUID) -> ModelType:
        """Get a single record by primary key or raise 404.

        Args:
            id: UUID primary key

        Returns:
            Model instance

        Raises:
            NotFoundException: If record not found

        Example:
            user = await user_repo.get_or_404(user_id)
            # Guaranteed to have user here
        """
        obj = await self.get(id)
        if obj is None:
            raise NotFoundException(
                resource=self.model.__name__,
                detail=f"{self.model.__name__} with id {id} not found"
            )
        return obj

    async def list(
        self,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[ModelType]:
        """List records with pagination.

        Args:
            skip: Number of records to skip (offset)
            limit: Maximum number of records to return

        Returns:
            List of model instances

        Example:
            decks = await deck_repo.list(skip=0, limit=20)
        """
        query = select(self.model).offset(skip).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count(self) -> int:
        """Count total records in table.

        Returns:
            Total record count

        Example:
            total = await deck_repo.count()
        """
        query = select(func.count()).select_from(self.model)
        result = await self.db.execute(query)
        return result.scalar_one()

    async def create(self, obj_in: BaseModel | dict[str, Any]) -> ModelType:
        """Create a new record.

        Args:
            obj_in: Pydantic schema or dict with field values

        Returns:
            Created model instance (not yet committed)

        Note:
            This method does NOT commit the transaction.
            Caller must call db.commit() and db.refresh() after.

        Example:
            user = await user_repo.create(UserCreate(...))
            await db.commit()
            await db.refresh(user)
        """
        if isinstance(obj_in, dict):
            create_data = obj_in
        else:
            create_data = obj_in.model_dump(exclude_unset=True)

        db_obj = self.model(**create_data)
        self.db.add(db_obj)
        await self.db.flush()  # Flush to get ID without committing
        return db_obj

    async def update(
        self,
        db_obj: ModelType,
        obj_in: BaseModel | dict[str, Any],
    ) -> ModelType:
        """Update an existing record.

        Args:
            db_obj: Existing database object to update
            obj_in: Pydantic schema or dict with updated values

        Returns:
            Updated model instance (not yet committed)

        Note:
            Only updates fields present in obj_in (partial updates).
            Does NOT commit the transaction.

        Example:
            user = await user_repo.get_or_404(user_id)
            updated_user = await user_repo.update(user, UserUpdate(...))
            await db.commit()
            await db.refresh(updated_user)
        """
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(db_obj, field, value)

        self.db.add(db_obj)
        await self.db.flush()
        return db_obj

    async def delete(self, db_obj: ModelType) -> None:
        """Delete a record.

        Args:
            db_obj: Database object to delete

        Note:
            Does NOT commit the transaction.
            Caller must call db.commit() after.

        Example:
            user = await user_repo.get_or_404(user_id)
            await user_repo.delete(user)
            await db.commit()
        """
        await self.db.delete(db_obj)
        await self.db.flush()

    async def filter_by(self, **filters: Any) -> list[ModelType]:
        """Filter records by arbitrary field values.

        Args:
            **filters: Field name = value pairs

        Returns:
            List of matching model instances

        Example:
            active_users = await user_repo.filter_by(is_active=True)
            a1_decks = await deck_repo.filter_by(level=DeckLevel.A1)
        """
        query = select(self.model)
        for field, value in filters.items():
            query = query.where(getattr(self.model, field) == value)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def exists(self, **filters: Any) -> bool:
        """Check if any record matches filters.

        Args:
            **filters: Field name = value pairs

        Returns:
            True if at least one matching record exists

        Example:
            email_taken = await user_repo.exists(email="test@example.com")
        """
        query = select(func.count()).select_from(self.model)
        for field, value in filters.items():
            query = query.where(getattr(self.model, field) == value)

        result = await self.db.execute(query)
        count = result.scalar_one()
        return count > 0
