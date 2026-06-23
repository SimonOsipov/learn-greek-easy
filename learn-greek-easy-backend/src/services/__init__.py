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
from src.services.email_service import EmailService, get_email_service
from src.services.evidence_assembly_service import EvidenceAssemblyService
from src.services.feedback_admin_service import FeedbackAdminService
from src.services.frequency_service import FrequencyService, band_for_rank
from src.services.lemma_normalization_service import (
    LemmaNormalizationService,
    get_lemma_normalization_service,
)
from src.services.lexicon_service import LexiconEntry, LexiconService
from src.services.mock_exam_service import MockExamService
from src.services.morphology_service import MorphologyService, get_morphology_service
from src.services.news_item_service import NewsItemService
from src.services.notification_service import NotificationService
from src.services.openrouter_service import OpenRouterService, get_openrouter_service
from src.services.s3_service import S3Service, get_s3_service
from src.services.seed_service import SeedService
from src.services.spellcheck_service import SpellcheckService, get_spellcheck_service
from src.services.translation_service import (
    TranslationEntry,
    TranslationLookupService,
    TranslationResult,
)
from src.services.user_deletion_service import DeletionResult, UserDeletionService
from src.services.user_progress_reset_service import UserProgressResetService
from src.services.webhook_service import WebhookService
from src.services.wiktionary_morphology_service import WiktionaryMorphologyService
from src.services.xp_service import XPService

__all__ = [
    "AchievementService",
    "EvidenceAssemblyService",
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
    "EmailService",
    "FeedbackAdminService",
    "FrequencyService",
    "LemmaNormalizationService",
    "LexiconEntry",
    "LexiconService",
    "MockExamService",
    "MorphologyService",
    "NewsItemService",
    "NotificationService",
    "OpenRouterService",
    "S3Service",
    "SeedService",
    "SpellcheckService",
    "TranslationEntry",
    "TranslationLookupService",
    "TranslationResult",
    "UserDeletionService",
    "UserProgressResetService",
    "WebhookService",
    "WiktionaryMorphologyService",
    "XPService",
    "band_for_rank",
    "get_email_service",
    "get_lemma_normalization_service",
    "get_morphology_service",
    "get_openrouter_service",
    "get_s3_service",
    "get_spellcheck_service",
]
