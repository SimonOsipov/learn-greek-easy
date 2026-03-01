"""Service layer for business logic implementation.

Services encapsulate complex business operations and coordinate
between multiple repositories/models. They handle transactions,
business rules validation, and domain logic.
"""

from src.services.achievement_service import AchievementService
from src.services.announcement_service import AnnouncementService
from src.services.card_error_admin_service import CardErrorAdminService
from src.services.card_error_service import CardErrorService
from src.services.card_generator_service import CardGeneratorService
from src.services.changelog_service import ChangelogService
from src.services.checkout_service import CheckoutService
from src.services.culture_deck_service import CultureDeckService
from src.services.culture_question_service import CultureQuestionService
from src.services.duplicate_detection_service import DuplicateDetectionService
from src.services.feedback_admin_service import FeedbackAdminService
from src.services.lemma_normalization_service import (
    LemmaNormalizationService,
    get_lemma_normalization_service,
)
from src.services.mock_exam_service import MockExamService
from src.services.morphology_service import MorphologyService, get_morphology_service
from src.services.news_item_service import NewsItemService
from src.services.notification_service import NotificationService
from src.services.openrouter_service import OpenRouterService, get_openrouter_service
from src.services.progress_service import ProgressService
from src.services.s3_service import S3Service, get_s3_service
from src.services.seed_service import SeedService
from src.services.sm2_service import SM2Service
from src.services.spellcheck_service import SpellcheckService, get_spellcheck_service
from src.services.user_deletion_service import DeletionResult, UserDeletionService
from src.services.user_progress_reset_service import UserProgressResetService
from src.services.webhook_service import WebhookService
from src.services.xp_service import XPService

__all__ = [
    "AchievementService",
    "AnnouncementService",
    "CardErrorAdminService",
    "CardErrorService",
    "CardGeneratorService",
    "ChangelogService",
    "CheckoutService",
    "CultureDeckService",
    "CultureQuestionService",
    "DeletionResult",
    "DuplicateDetectionService",
    "FeedbackAdminService",
    "LemmaNormalizationService",
    "MockExamService",
    "MorphologyService",
    "NewsItemService",
    "NotificationService",
    "OpenRouterService",
    "ProgressService",
    "S3Service",
    "SeedService",
    "SpellcheckService",
    "SM2Service",
    "UserDeletionService",
    "UserProgressResetService",
    "WebhookService",
    "XPService",
    "get_lemma_normalization_service",
    "get_morphology_service",
    "get_openrouter_service",
    "get_s3_service",
    "get_spellcheck_service",
]
