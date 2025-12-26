#!/usr/bin/env python
"""Import Cyprus culture content from halum-parsing JSON files.

This script imports 15 Cyprus culture topic files (381 questions total) into
the database as CultureDecks and CultureQuestions with trilingual content
(Greek, English, Russian).

Usage:
    # Dry run (show what would be done)
    poetry run python scripts/import_cyprus_culture.py --dry-run

    # Full import
    poetry run python scripts/import_cyprus_culture.py

    # Import with update mode (update existing instead of skip)
    poetry run python scripts/import_cyprus_culture.py --update-existing

    # Custom source directory
    poetry run python scripts/import_cyprus_culture.py --source-dir /path/to/topics

Requirements:
    - Database must be initialized (e.g., via docker-compose)
    - Source JSON files must exist in the specified directory
"""

import argparse
import asyncio
import json
import logging
import random
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

# Add parent directory to path for imports
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import delete, select  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession  # noqa: E402

from src.db import close_db, get_session_factory, init_db  # noqa: E402
from src.db.models import CultureDeck, CultureQuestion  # noqa: E402

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# ============================================================================
# Deck Metadata Mapping
# ============================================================================

CYPRUS_DECK_METADATA = {
    "constitution": {
        "name": {
            "el": "Σύνταγμα & Διακυβέρνηση",
            "en": "Constitution & Government",
            "ru": "Конституция и Правительство",
        },
        "description": {
            "el": "Μάθετε για το Σύνταγμα της Κύπρου",
            "en": "Learn about the Constitution of Cyprus",
            "ru": "Узнайте о Конституции Кипра",
        },
        "icon": "scroll",
        "color_accent": "#4169E1",  # Royal Blue
        "category": "governance",
    },
    "currency_foreign_exchange": {
        "name": {
            "el": "Νόμισμα & Συνάλλαγμα",
            "en": "Currency & Foreign Exchange",
            "ru": "Валюта и Обмен",
        },
        "description": {
            "el": "Πληροφορίες για το νόμισμα της Κύπρου",
            "en": "Information about Cyprus currency",
            "ru": "Информация о валюте Кипра",
        },
        "icon": "banknote",
        "color_accent": "#2E8B57",  # Sea Green
        "category": "practical",
    },
    "customs_traditions": {
        "name": {
            "el": "Έθιμα & Παραδόσεις",
            "en": "Customs & Traditions",
            "ru": "Обычаи и Традиции",
        },
        "description": {
            "el": "Ανακαλύψτε τα κυπριακά έθιμα",
            "en": "Discover Cypriot customs and traditions",
            "ru": "Откройте кипрские обычаи и традиции",
        },
        "icon": "star",
        "color_accent": "#DAA520",  # Goldenrod
        "category": "traditions",
    },
    "economy": {
        "name": {"el": "Οικονομία", "en": "Economy", "ru": "Экономика"},
        "description": {
            "el": "Η οικονομία της Κύπρου",
            "en": "The economy of Cyprus",
            "ru": "Экономика Кипра",
        },
        "icon": "trending-up",
        "color_accent": "#20B2AA",  # Light Sea Green
        "category": "governance",
    },
    "entry_conditions": {
        "name": {
            "el": "Όροι Εισόδου",
            "en": "Entry Conditions",
            "ru": "Условия Въезда",
        },
        "description": {
            "el": "Απαιτήσεις για είσοδο στην Κύπρο",
            "en": "Requirements for entering Cyprus",
            "ru": "Требования для въезда на Кипр",
        },
        "icon": "passport",
        "color_accent": "#708090",  # Slate Gray
        "category": "practical",
    },
    "geographical_features": {
        "name": {
            "el": "Γεωγραφία",
            "en": "Geographical Features",
            "ru": "Географические Особенности",
        },
        "description": {
            "el": "Γεωγραφία και φυσικά χαρακτηριστικά της Κύπρου",
            "en": "Geography and natural features of Cyprus",
            "ru": "География и природные особенности Кипра",
        },
        "icon": "map",
        "color_accent": "#228B22",  # Forest Green
        "category": "geography",
    },
    "health_safety": {
        "name": {
            "el": "Υγεία & Ασφάλεια",
            "en": "Health & Safety",
            "ru": "Здоровье и Безопасность",
        },
        "description": {
            "el": "Πληροφορίες υγείας και ασφάλειας",
            "en": "Health and safety information",
            "ru": "Информация о здоровье и безопасности",
        },
        "icon": "heart-pulse",
        "color_accent": "#DC143C",  # Crimson
        "category": "practical",
    },
    "languages_religions": {
        "name": {
            "el": "Γλώσσες & Θρησκείες",
            "en": "Languages & Religions",
            "ru": "Языки и Религии",
        },
        "description": {
            "el": "Γλώσσες και θρησκείες της Κύπρου",
            "en": "Languages and religions of Cyprus",
            "ru": "Языки и религии Кипра",
        },
        "icon": "book-open",
        "color_accent": "#9932CC",  # Dark Orchid
        "category": "culture",
    },
    "modern_history": {
        "name": {
            "el": "Σύγχρονη Ιστορία",
            "en": "Modern History",
            "ru": "Современная История",
        },
        "description": {
            "el": "Η σύγχρονη ιστορία της Κύπρου",
            "en": "The modern history of Cyprus",
            "ru": "Современная история Кипра",
        },
        "icon": "book-open",
        "color_accent": "#8B4513",  # Saddle Brown
        "category": "history",
    },
    "politics": {
        "name": {"el": "Πολιτική", "en": "Politics", "ru": "Политика"},
        "description": {
            "el": "Το πολιτικό σύστημα της Κύπρου",
            "en": "The political system of Cyprus",
            "ru": "Политическая система Кипра",
        },
        "icon": "landmark",
        "color_accent": "#4682B4",  # Steel Blue
        "category": "governance",
    },
    "telecommunications": {
        "name": {
            "el": "Τηλεπικοινωνίες",
            "en": "Telecommunications",
            "ru": "Телекоммуникации",
        },
        "description": {
            "el": "Τηλεπικοινωνίες στην Κύπρο",
            "en": "Telecommunications in Cyprus",
            "ru": "Телекоммуникации на Кипре",
        },
        "icon": "phone",
        "color_accent": "#6A5ACD",  # Slate Blue
        "category": "practical",
    },
    "timeliness": {
        "name": {"el": "Συνέπεια", "en": "Timeliness", "ru": "Пунктуальность"},
        "description": {
            "el": "Κυπριακή κουλτούρα χρόνου",
            "en": "Cypriot time culture and punctuality",
            "ru": "Кипрская культура времени",
        },
        "icon": "clock",
        "color_accent": "#FF8C00",  # Dark Orange
        "category": "culture",
    },
    "transport": {
        "name": {"el": "Μεταφορές", "en": "Transport", "ru": "Транспорт"},
        "description": {
            "el": "Μεταφορές στην Κύπρο",
            "en": "Transportation in Cyprus",
            "ru": "Транспорт на Кипре",
        },
        "icon": "car",
        "color_accent": "#4B0082",  # Indigo
        "category": "practical",
    },
    "weather_climate": {
        "name": {
            "el": "Καιρός & Κλίμα",
            "en": "Weather & Climate",
            "ru": "Погода и Климат",
        },
        "description": {
            "el": "Ο καιρός και το κλίμα της Κύπρου",
            "en": "Weather and climate of Cyprus",
            "ru": "Погода и климат Кипра",
        },
        "icon": "sun",
        "color_accent": "#F4A460",  # Sandy Brown
        "category": "geography",
    },
    "working_hours_holidays": {
        "name": {
            "el": "Ωράριο & Αργίες",
            "en": "Working Hours & Holidays",
            "ru": "Рабочие Часы и Праздники",
        },
        "description": {
            "el": "Ωράριο εργασίας και αργίες",
            "en": "Working hours and public holidays",
            "ru": "Рабочие часы и праздники",
        },
        "icon": "calendar",
        "color_accent": "#CD853F",  # Peru
        "category": "practical",
    },
}


# ============================================================================
# Helper Functions
# ============================================================================


def pad_options_to_four(options: list[dict]) -> list[str]:
    """Pad options list to exactly 4 items with empty strings.

    Args:
        options: List of option dicts with 'text' and 'is_correct' keys

    Returns:
        List of 4 option text strings
    """
    texts = [opt["text"] for opt in options]
    while len(texts) < 4:
        texts.append("")
    return texts[:4]  # Safety: truncate if somehow > 4


def transform_question(
    source_question: dict,
    order_index: int,
) -> dict[str, Any]:
    """Transform source JSON question to CultureQuestion format.

    Args:
        source_question: Raw question from JSON
        order_index: Position in deck (randomized)

    Returns:
        Dict ready for CultureQuestion constructor
    """
    translations = source_question["translations"]

    # Extract question text in all languages
    question_text = {
        "el": translations["el"]["question"],
        "en": translations["en"]["question"],
        "ru": translations["ru"]["question"],
    }

    # Get options for each language (with padding)
    el_options = translations["el"]["options"]
    en_options = translations["en"]["options"]
    ru_options = translations["ru"]["options"]

    # Find correct answer index (0-based) from Greek options (authoritative)
    correct_idx = next(i for i, opt in enumerate(el_options) if opt["is_correct"])

    # Pad options to 4 for each language
    el_texts = pad_options_to_four(el_options)
    en_texts = pad_options_to_four(en_options)
    ru_texts = pad_options_to_four(ru_options)

    # Build option dicts (multilingual)
    options = []
    for i in range(4):
        options.append(
            {
                "el": el_texts[i],
                "en": en_texts[i],
                "ru": ru_texts[i],
            }
        )

    # Skip image URLs for MVP (external URLs, not S3 keys)
    image_key = None

    return {
        "question_text": question_text,
        "option_a": options[0],
        "option_b": options[1],
        "option_c": options[2],
        "option_d": options[3],
        "correct_option": correct_idx + 1,  # 1-based (1=A, 2=B, 3=C, 4=D)
        "order_index": order_index,
        "image_key": image_key,
    }


# ============================================================================
# Main Import Logic
# ============================================================================


def _create_empty_results() -> dict[str, Any]:
    """Create empty results dictionary."""
    return {
        "decks_created": 0,
        "decks_skipped": 0,
        "decks_updated": 0,
        "questions_created": 0,
        "questions_with_padded_options": 0,
        "questions_skipped_images": 0,
        "errors": [],
    }


def _run_dry_run(source_dir: Path, results: dict[str, Any]) -> dict[str, Any]:
    """Run dry-run mode - count files without database changes."""
    logger.info("DRY RUN MODE - No database changes will be made")
    logger.info("")

    for filename, metadata in CYPRUS_DECK_METADATA.items():
        json_file = source_dir / f"{filename}.json"

        if not json_file.exists():
            results["errors"].append(f"File not found: {json_file}")
            continue

        with open(json_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        questions_data = data.get("questions", [])
        results["decks_created"] += 1
        results["questions_created"] += len(questions_data)

        # Count questions with < 4 options and images
        for q in questions_data:
            el_options = q["translations"]["el"]["options"]
            if len(el_options) < 4:
                results["questions_with_padded_options"] += 1
            if q.get("img_url"):
                results["questions_skipped_images"] += 1

        logger.info(
            f"  Would create deck: {metadata['name']['en']} " f"({len(questions_data)} questions)"
        )

    return results


async def _process_deck(
    db: AsyncSession,
    filename: str,
    metadata: dict[str, Any],
    deck_order: int,
    update_existing: bool,
    results: dict[str, Any],
    source_dir: Path,
) -> None:
    """Process a single deck file and import to database."""
    json_file = source_dir / f"{filename}.json"

    if not json_file.exists():
        error_msg = f"File not found: {json_file}"
        logger.error(f"  {error_msg}")
        results["errors"].append(error_msg)
        return

    # Load JSON
    with open(json_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    questions_data = data.get("questions", [])
    logger.info(f"Processing {filename}: {len(questions_data)} questions")

    # Check if deck exists (by name match in English)
    all_decks_result = await db.execute(select(CultureDeck))
    all_decks = all_decks_result.scalars().all()
    existing = next(
        (d for d in all_decks if d.name.get("en") == metadata["name"]["en"]),
        None,
    )

    if existing and not update_existing:
        logger.info(f"  Skipping existing deck: {metadata['name']['en']}")
        results["decks_skipped"] += 1
        return

    # Create or update deck
    deck = await _create_or_update_deck(db, existing, metadata, deck_order, results)

    # Import questions for this deck
    await _import_deck_questions(db, deck, questions_data, filename, results)
    await db.flush()


async def _create_or_update_deck(
    db: AsyncSession,
    existing: CultureDeck | None,
    metadata: dict[str, Any],
    deck_order: int,
    results: dict[str, Any],
) -> CultureDeck:
    """Create a new deck or update an existing one."""
    if existing:
        deck = existing
        deck.name = metadata["name"]
        deck.description = metadata["description"]
        deck.icon = metadata["icon"]
        deck.color_accent = metadata["color_accent"]
        deck.category = metadata["category"]
        results["decks_updated"] += 1
        logger.info(f"  Updating deck: {metadata['name']['en']}")

        # Delete existing questions if updating
        await db.execute(delete(CultureQuestion).where(CultureQuestion.deck_id == deck.id))
    else:
        deck = CultureDeck(
            name=metadata["name"],
            description=metadata["description"],
            icon=metadata["icon"],
            color_accent=metadata["color_accent"],
            category=metadata["category"],
            is_active=True,
            order_index=deck_order,
        )
        db.add(deck)
        await db.flush()  # Get deck.id
        results["decks_created"] += 1
        logger.info(f"  Created deck: {metadata['name']['en']}")

    return deck


async def _import_deck_questions(
    db: AsyncSession,
    deck: CultureDeck,
    questions_data: list[dict[str, Any]],
    filename: str,
    results: dict[str, Any],
) -> None:
    """Import questions for a single deck with randomized order."""
    # Randomize question order within deck
    shuffled_indices = list(range(len(questions_data)))
    random.shuffle(shuffled_indices)

    for new_order, orig_idx in enumerate(shuffled_indices):
        q_data = questions_data[orig_idx]

        # Track special cases
        el_options = q_data["translations"]["el"]["options"]
        if len(el_options) < 4:
            results["questions_with_padded_options"] += 1
        if q_data.get("img_url"):
            results["questions_skipped_images"] += 1

        try:
            transformed = transform_question(q_data, new_order)
            question = CultureQuestion(deck_id=deck.id, **transformed)
            db.add(question)
            results["questions_created"] += 1
        except Exception as e:
            error_msg = f"Error in {filename}, question ID {q_data.get('id')}: {e}"
            logger.error(f"    {error_msg}")
            results["errors"].append(error_msg)


async def import_cyprus_culture(
    source_dir: Path,
    dry_run: bool = False,
    update_existing: bool = False,
) -> dict[str, Any]:
    """Import all Cyprus culture content.

    Args:
        source_dir: Path to halum-parsing/topics/ directory
        dry_run: If True, show what would be done without DB changes
        update_existing: If True, update existing decks; otherwise skip

    Returns:
        Summary dict with counts
    """
    results = _create_empty_results()

    if dry_run:
        return _run_dry_run(source_dir, results)

    # Initialize database
    await init_db()
    session_factory = get_session_factory()

    async with session_factory() as db:
        # Calculate order_index for new decks
        existing_count_result = await db.execute(select(CultureDeck.id))
        existing_deck_count = len(existing_count_result.all())

        for deck_order, (filename, metadata) in enumerate(
            CYPRUS_DECK_METADATA.items(), start=existing_deck_count
        ):
            await _process_deck(
                db, filename, metadata, deck_order, update_existing, results, source_dir
            )

        # Commit all changes
        await db.commit()
        logger.info("All changes committed to database")

    await close_db()
    return results


# ============================================================================
# CLI
# ============================================================================


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Import Cyprus culture content from halum-parsing JSON files.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Dry run (show what would be done)
    poetry run python scripts/import_cyprus_culture.py --dry-run

    # Full import
    poetry run python scripts/import_cyprus_culture.py

    # Import with update mode
    poetry run python scripts/import_cyprus_culture.py --update-existing

    # Custom source directory
    poetry run python scripts/import_cyprus_culture.py --source-dir /path/to/topics

Source files expected (15 JSON files):
    constitution.json, currency_foreign_exchange.json, customs_traditions.json,
    economy.json, entry_conditions.json, geographical_features.json,
    health_safety.json, languages_religions.json, modern_history.json,
    politics.json, telecommunications.json, timeliness.json, transport.json,
    weather_climate.json, working_hours_holidays.json
        """,
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without making changes",
    )

    parser.add_argument(
        "--update-existing",
        action="store_true",
        help="Update existing decks instead of skipping (deletes and recreates questions)",
    )

    parser.add_argument(
        "--source-dir",
        type=Path,
        default=Path(__file__).parent.parent.parent / "halum-parsing" / "topics",
        help="Path to source JSON directory (default: ../halum-parsing/topics)",
    )

    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Enable verbose logging",
    )

    return parser.parse_args()


async def main() -> int:
    """Main entry point."""
    args = parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    logger.info("=" * 60)
    logger.info("Cyprus Culture Content Import")
    logger.info("=" * 60)
    logger.info(f"Source directory: {args.source_dir}")
    logger.info(f"Update existing: {args.update_existing}")
    logger.info(f"Dry run: {args.dry_run}")
    logger.info("")

    if not args.source_dir.exists():
        logger.error(f"Source directory not found: {args.source_dir}")
        return 1

    # Count expected files
    expected_files = len(CYPRUS_DECK_METADATA)
    existing_files = sum(
        1 for filename in CYPRUS_DECK_METADATA if (args.source_dir / f"{filename}.json").exists()
    )
    logger.info(f"Source files found: {existing_files}/{expected_files}")
    logger.info("")

    try:
        start_time = datetime.now()

        results = await import_cyprus_culture(
            source_dir=args.source_dir,
            dry_run=args.dry_run,
            update_existing=args.update_existing,
        )

        duration = (datetime.now() - start_time).total_seconds()

        logger.info("")
        logger.info("=" * 60)
        logger.info("Import Summary")
        logger.info("=" * 60)
        logger.info(f"Duration: {duration:.2f}s")
        logger.info(f"Decks created: {results['decks_created']}")
        logger.info(f"Decks skipped: {results['decks_skipped']}")
        logger.info(f"Decks updated: {results['decks_updated']}")
        logger.info(f"Questions created: {results['questions_created']}")
        logger.info(f"Questions with padded options: {results['questions_with_padded_options']}")
        logger.info(f"Questions with skipped images: {results['questions_skipped_images']}")

        if results["errors"]:
            logger.warning("")
            logger.warning(f"Errors encountered: {len(results['errors'])}")
            for error in results["errors"]:
                logger.warning(f"  - {error}")
            return 1

        logger.info("")
        if args.dry_run:
            logger.info("Dry run completed successfully!")
        else:
            logger.info("Import completed successfully!")

        return 0

    except Exception as e:
        logger.error(f"Import failed: {e}", exc_info=True)
        return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
