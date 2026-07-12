"""Culture Coverage Service for whole-bank mock-exam coverage signals (WEDGE-05).

Computes bank-wide coverage metrics -- total question_count, freshest
updated_at, and per-topic "thin" flags -- over the ENTIRE culture_questions
table (not scoped to any session, deck, or user). Powers the pre-exam
coverage disclosure endpoint (GET /mock-exam/coverage) so users can see
whether the bank is thin on a given topic before starting an exam.

Key Features:
- COUNT(*) / MAX(updated_at) over the whole culture_questions table
- Per-topic counts via GROUP BY topic; NULL-topic rows count toward
  question_count only, never a per-topic bucket
- Single source-of-truth thin rule: thin(t) = count[t] < 0.5 * best
"""

from sqlalchemy.ext.asyncio import AsyncSession

from src.repositories.culture_question import CultureQuestionRepository
from src.schemas.mock_exam import MockExamCoverageResponse


class CultureCoverageService:
    """Service for whole-bank culture-question coverage signals (WEDGE-05).

    Attributes:
        db: Async database session
        repository: CultureQuestionRepository for the underlying reads
    """

    def __init__(self, db: AsyncSession):
        """Initialize the Culture Coverage service.

        Args:
            db: Async database session for persistence operations
        """
        self.db = db
        self.repository = CultureQuestionRepository(db)

    async def get_coverage(self) -> MockExamCoverageResponse:
        """Compute whole-bank coverage: total count, freshest updated_at,
        and per-topic thin flags.

        Returns:
            MockExamCoverageResponse with question_count, updated_at, and
            exactly 5 per-topic thin-flag items in canonical CultureTopic
            order.

        Use Case:
            Pre-exam coverage disclosure (GET /mock-exam/coverage)
        """
        raise NotImplementedError

    @staticmethod
    def _compute_thin_flags(per_topic: dict[str, int]) -> dict[str, bool]:
        """Apply the single thin-rule to a per-topic count mapping.

        best = max(per_topic.values()); thin(t) = count[t] < 0.5 * best when
        best > 0, else False for every topic (guards the empty-bank case
        against a ZeroDivisionError and against every topic reporting thin
        when there is nothing to compare against). Strict `<`: a topic at
        exactly 0.5 * best is NOT thin.

        Args:
            per_topic: Mapping of canonical CultureTopic value -> question
                count for that topic

        Returns:
            Mapping of the same topic keys -> thin boolean
        """
        raise NotImplementedError


# ============================================================================
# Module Exports
# ============================================================================

__all__ = ["CultureCoverageService"]
