"""Factory function for admin exercises E2E seed data.

Creates a representative set of Exercise rows covering the axes shown in the
admin exercises design tab:
  - 7 exercise types: select_correct_answer, fill_gaps, select_heard, true_false,
                      select_picture_from_description, select_description_from_picture,
                      word_order
  - 3 statuses:   draft, pending, approved
  - 3+ sources:   description, dialog, picture, word_order
  - 2 levels:     A2, B1
  - 1+ row with audio = None (description exercise with no audio_s3_key)

Target: ~15 rows — enough to hit every filter axis at least once without a full
7x3x3x2 Cartesian product (that would be 126 rows and require 126 unique parents).

Entry point
-----------
This is a **factory function**, not a test fixture.  Call it directly from a
test or conftest that already has a live AsyncSession available:

    from tests.factories.admin_exercises_seed import seed_admin_exercises
    await seed_admin_exercises(db_session)

If you need this data in the E2E seed API (``/test/seed/admin-exercises``), add
a new endpoint in ``src/api/v1/test/seed.py`` that calls this function and
passes ``db`` from the FastAPI dependency.  No clean entry-point exists yet in
``seed_service.py`` for exercise seeding, so wiring it in is a separate step.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    DeckLevel,
    DescriptionExercise,
    DescriptionExerciseItem,
    DescriptionSourceType,
    DescriptionStatus,
    DialogExercise,
    DialogStatus,
    ExerciseItem,
    ExerciseModality,
    ExerciseStatus,
    ExerciseType,
    ListeningDialog,
    PictureExercise,
    PictureExerciseItem,
    PictureStatus,
    Situation,
    SituationDescription,
    SituationPicture,
    SituationStatus,
    WordOrderExercise,
    WordOrderExerciseItem,
)

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


async def _make_situation(db: AsyncSession, scenario_en: str, scenario_el: str) -> Situation:
    sit = Situation(
        scenario_en=scenario_en,
        scenario_el=scenario_el,
        scenario_ru=f"Русский: {scenario_en}",
        status=SituationStatus.READY,
    )
    db.add(sit)
    await db.flush()
    return sit


async def _make_description(
    db: AsyncSession, situation_id: object, *, audio_s3_key: str | None = "exercises/test.mp3"
) -> SituationDescription:
    desc = SituationDescription(
        situation_id=situation_id,
        text_el="Ελληνικό κείμενο για δοκιμή ασκήσεων διαχειριστή",
        source_type=DescriptionSourceType.ORIGINAL,
        status=DescriptionStatus.AUDIO_READY,
        audio_s3_key=audio_s3_key,
    )
    db.add(desc)
    await db.flush()
    return desc


# ---------------------------------------------------------------------------
# Public seed function
# ---------------------------------------------------------------------------


async def seed_admin_exercises(db: AsyncSession) -> dict[str, int]:
    """Create ~15 exercise rows covering all admin filter axes.

    Axes covered
    ------------
    exercise_type:  all 7 values
    status:         draft, pending, approved
    source:         description (5 rows), dialog (3), picture (2), word_order (3)
    audio_level:    A2 (description exercises), B1 (description exercises)
    audio = None:   1 description row has no audio_s3_key

    Returns a summary dict with counts per source type.

    Notes
    -----
    - Each parent is unique to avoid unique-constraint violations on
      (description_id, exercise_type, audio_level, modality).
    - DialogExercise rows are linked to a dedicated ListeningDialog; no audio_s3_key
      is set, so the admin endpoint returns audio_url = None for those rows
      (covering the "audio = null" requirement for dialog source).
    - PictureExercise uses SELECT_PICTURE_FROM_DESCRIPTION and
      SELECT_DESCRIPTION_FROM_PICTURE (the two types the picture-match generator
      creates), both APPROVED, mirroring production behaviour documented in EXR-52.
    - WordOrderExercise is always type WORD_ORDER (enforced by the model default).
    """
    counts: dict[str, int] = {
        "description": 0,
        "dialog": 0,
        "picture": 0,
        "word_order": 0,
    }

    # ------------------------------------------------------------------
    # SOURCE: description — 5 rows, various types/statuses/levels
    # ------------------------------------------------------------------
    # Row 1: select_correct_answer, draft, B1, has audio
    sit1 = await _make_situation(db, "Admin seed: description row 1", "Σπίτι")
    desc1 = await _make_description(db, sit1.id)
    de1 = DescriptionExercise(
        description_id=desc1.id,
        exercise_type=ExerciseType.SELECT_CORRECT_ANSWER,
        audio_level=DeckLevel.B1,
        modality=ExerciseModality.LISTENING,
        status=ExerciseStatus.DRAFT,
        question_el="Τι κάνει ο Γιάννης;",
        question_en="What is Giannis doing?",
    )
    db.add(de1)
    await db.flush()
    db.add(
        DescriptionExerciseItem(
            description_exercise_id=de1.id,
            item_index=0,
            payload={
                "prompt": {"el": "Ερώτηση;", "en": "Question?"},
                "options": [
                    {"el": "α", "en": "a"},
                    {"el": "β", "en": "b"},
                    {"el": "γ", "en": "c"},
                ],
                "correct_answer_index": 0,
                "correct_idx": 0,
            },
        )
    )
    await db.flush()
    counts["description"] += 1

    # Row 2: fill_gaps, pending, A2, has audio
    sit2 = await _make_situation(db, "Admin seed: description row 2", "Σχολείο")
    desc2 = await _make_description(db, sit2.id)
    de2 = DescriptionExercise(
        description_id=desc2.id,
        exercise_type=ExerciseType.FILL_GAPS,
        audio_level=DeckLevel.A2,
        modality=ExerciseModality.LISTENING,
        status=ExerciseStatus.PENDING,
        question_el="Συμπλήρωσε το κενό:",
        question_en="Fill in the gap:",
    )
    db.add(de2)
    await db.flush()
    db.add(
        DescriptionExerciseItem(
            description_exercise_id=de2.id,
            item_index=0,
            payload={"gap_sentence": "Ο ___ πηγαίνει στο σχολείο.", "answer": "Νίκος"},
        )
    )
    await db.flush()
    counts["description"] += 1

    # Row 3: select_heard, approved, B1, has audio
    sit3 = await _make_situation(db, "Admin seed: description row 3", "Αγορά")
    desc3 = await _make_description(db, sit3.id)
    de3 = DescriptionExercise(
        description_id=desc3.id,
        exercise_type=ExerciseType.SELECT_HEARD,
        audio_level=DeckLevel.B1,
        modality=ExerciseModality.LISTENING,
        status=ExerciseStatus.APPROVED,
        question_el="Τι άκουσες;",
        question_en="What did you hear?",
    )
    db.add(de3)
    await db.flush()
    db.add(
        DescriptionExerciseItem(
            description_exercise_id=de3.id,
            item_index=0,
            payload={
                "options": [{"el": "αγορά"}, {"el": "σχολείο"}, {"el": "σπίτι"}],
                "correct_answer_index": 0,
                "correct_idx": 0,
            },
        )
    )
    await db.flush()
    counts["description"] += 1

    # Row 4: true_false, draft, A2, has audio
    sit4 = await _make_situation(db, "Admin seed: description row 4", "Νοσοκομείο")
    desc4 = await _make_description(db, sit4.id)
    de4 = DescriptionExercise(
        description_id=desc4.id,
        exercise_type=ExerciseType.TRUE_FALSE,
        audio_level=DeckLevel.A2,
        modality=ExerciseModality.LISTENING,
        status=ExerciseStatus.DRAFT,
        question_el="Αλήθεια ή ψέμα;",
        question_en="True or false?",
    )
    db.add(de4)
    await db.flush()
    db.add(
        DescriptionExerciseItem(
            description_exercise_id=de4.id,
            item_index=0,
            payload={"statement": {"el": "Ο Νίκος είναι γιατρός."}, "correct": True},
        )
    )
    await db.flush()
    counts["description"] += 1

    # Row 5: select_correct_answer, approved, B1, audio = None (explicit null)
    sit5 = await _make_situation(db, "Admin seed: description row 5 (no audio)", "Παραλία")
    desc5 = await _make_description(db, sit5.id, audio_s3_key=None)  # explicit null audio
    de5 = DescriptionExercise(
        description_id=desc5.id,
        exercise_type=ExerciseType.SELECT_CORRECT_ANSWER,
        audio_level=DeckLevel.B1,
        modality=ExerciseModality.LISTENING,
        status=ExerciseStatus.APPROVED,
        question_el="Ερώτηση χωρίς ήχο;",
        question_en="Question without audio?",
    )
    db.add(de5)
    await db.flush()
    db.add(
        DescriptionExerciseItem(
            description_exercise_id=de5.id,
            item_index=0,
            payload={
                "options": [{"el": "α"}, {"el": "β"}, {"el": "γ"}],
                "correct_answer_index": 1,
                "correct_idx": 1,
            },
        )
    )
    await db.flush()
    counts["description"] += 1

    # ------------------------------------------------------------------
    # SOURCE: dialog — 3 rows (all LISTENING; no audio level concept)
    # ------------------------------------------------------------------
    # Row 6: select_correct_answer, draft
    sit6 = await _make_situation(db, "Admin seed: dialog row 1", "Διάλογος 1")
    dialog1 = ListeningDialog(
        situation_id=sit6.id,
        scenario_el="Διάλογος στο καφέ",
        scenario_en="Dialog at the cafe",
        scenario_ru="Диалог в кафе",
        cefr_level=DeckLevel.B1,
        num_speakers=2,
        status=DialogStatus.DRAFT,
        audio_s3_key=None,  # no audio — covers "audio = null" for dialog source
    )
    db.add(dialog1)
    await db.flush()
    dex1 = DialogExercise(
        dialog_id=dialog1.id,
        exercise_type=ExerciseType.SELECT_CORRECT_ANSWER,
        status=ExerciseStatus.DRAFT,
        question_el="Τι παρήγγειλε ο Νίκος;",
        question_en="What did Nikos order?",
    )
    db.add(dex1)
    await db.flush()
    db.add(
        ExerciseItem(
            exercise_id=dex1.id,
            item_index=0,
            payload={
                "options": [{"el": "καφέ"}, {"el": "νερό"}, {"el": "χυμό"}],
                "correct_answer_index": 0,
                "correct_idx": 0,
            },
        )
    )
    await db.flush()
    counts["dialog"] += 1

    # Row 7: fill_gaps, pending
    sit7 = await _make_situation(db, "Admin seed: dialog row 2", "Διάλογος 2")
    dialog2 = ListeningDialog(
        situation_id=sit7.id,
        scenario_el="Διάλογος στο σούπερ μάρκετ",
        scenario_en="Dialog at the supermarket",
        scenario_ru="Диалог в супермаркете",
        cefr_level=DeckLevel.A2,
        num_speakers=2,
        status=DialogStatus.DRAFT,
        audio_s3_key="exercises/dialog_audio.mp3",
    )
    db.add(dialog2)
    await db.flush()
    dex2 = DialogExercise(
        dialog_id=dialog2.id,
        exercise_type=ExerciseType.FILL_GAPS,
        status=ExerciseStatus.PENDING,
        question_el="Συμπλήρωσε το κενό:",
        question_en="Fill in the gap:",
    )
    db.add(dex2)
    await db.flush()
    db.add(
        ExerciseItem(
            exercise_id=dex2.id,
            item_index=0,
            payload={"gap_sentence": "Θέλω ένα ___ παρακαλώ.", "answer": "ψωμί"},
        )
    )
    await db.flush()
    counts["dialog"] += 1

    # Row 8: true_false, approved
    sit8 = await _make_situation(db, "Admin seed: dialog row 3", "Διάλογος 3")
    dialog3 = ListeningDialog(
        situation_id=sit8.id,
        scenario_el="Τηλεφωνική συνομιλία",
        scenario_en="Phone conversation",
        scenario_ru="Телефонный разговор",
        cefr_level=DeckLevel.B1,
        num_speakers=2,
        status=DialogStatus.AUDIO_READY,
        audio_s3_key="exercises/dialog3_audio.mp3",
    )
    db.add(dialog3)
    await db.flush()
    dex3 = DialogExercise(
        dialog_id=dialog3.id,
        exercise_type=ExerciseType.TRUE_FALSE,
        status=ExerciseStatus.APPROVED,
        question_el="Αλήθεια ή ψέμα;",
        question_en="True or false?",
    )
    db.add(dex3)
    await db.flush()
    db.add(
        ExerciseItem(
            exercise_id=dex3.id,
            item_index=0,
            payload={"statement": {"el": "Ο Νίκος κάλεσε πρώτος."}, "correct": False},
        )
    )
    await db.flush()
    counts["dialog"] += 1

    # ------------------------------------------------------------------
    # SOURCE: picture — 2 rows (matching the two types the generator creates)
    # ------------------------------------------------------------------
    # Row 9: select_picture_from_description, approved
    sit9 = await _make_situation(db, "Admin seed: picture row 1", "Εικόνα 1")
    pic1 = SituationPicture(
        situation_id=sit9.id,
        image_prompt="A sunny beach in Greece with blue umbrellas",
        image_s3_key="pictures/beach.jpg",
        status=PictureStatus.GENERATED,
    )
    db.add(pic1)
    await db.flush()
    pex1 = PictureExercise(
        picture_id=pic1.id,
        exercise_type=ExerciseType.SELECT_PICTURE_FROM_DESCRIPTION,
        status=ExerciseStatus.APPROVED,
        question_el="Ποια εικόνα δείχνει παραλία;",
        question_en="Which picture shows a beach?",
    )
    db.add(pex1)
    await db.flush()
    db.add(
        PictureExerciseItem(
            picture_exercise_id=pex1.id,
            item_index=0,
            payload={
                "type": "matching",
                "anchor_picture_id": str(pic1.id),
            },
        )
    )
    await db.flush()
    counts["picture"] += 1

    # Row 10: select_description_from_picture, draft
    sit10 = await _make_situation(db, "Admin seed: picture row 2", "Εικόνα 2")
    pic2 = SituationPicture(
        situation_id=sit10.id,
        image_prompt="A traditional Greek taverna at night",
        image_s3_key=None,  # no image yet — anchor_picture_url will be None
        status=PictureStatus.DRAFT,
    )
    db.add(pic2)
    await db.flush()
    pex2 = PictureExercise(
        picture_id=pic2.id,
        exercise_type=ExerciseType.SELECT_DESCRIPTION_FROM_PICTURE,
        status=ExerciseStatus.DRAFT,
        question_el="Ποια περιγραφή ταιριάζει στην εικόνα;",
        question_en="Which description matches the picture?",
    )
    db.add(pex2)
    await db.flush()
    db.add(
        PictureExerciseItem(
            picture_exercise_id=pex2.id,
            item_index=0,
            payload={
                "type": "matching",
                "anchor_picture_id": str(pic2.id),
            },
        )
    )
    await db.flush()
    counts["picture"] += 1

    # ------------------------------------------------------------------
    # SOURCE: word_order — 3 rows (always type WORD_ORDER per model default)
    # ------------------------------------------------------------------
    # Row 11: word_order, draft, attached to description
    sit11 = await _make_situation(db, "Admin seed: word_order row 1", "Τάξη")
    desc11 = await _make_description(db, sit11.id)
    wo1 = WordOrderExercise(
        description_id=desc11.id,
        exercise_type=ExerciseType.WORD_ORDER,
        status=ExerciseStatus.DRAFT,
        question_el="Βάλε τις λέξεις στη σωστή σειρά:",
        question_en="Put the words in the correct order:",
    )
    db.add(wo1)
    await db.flush()
    db.add(
        WordOrderExerciseItem(
            word_order_exercise_id=wo1.id,
            item_index=0,
            payload={
                "words": ["πάει", "Γιάννης", "ο", "σχολείο", "στο"],
                "correct_order": [2, 1, 0, 4, 3],
                "answer_el": "ο Γιάννης πάει στο σχολείο",
            },
        )
    )
    await db.flush()
    counts["word_order"] += 1

    # Row 12: word_order, pending
    sit12 = await _make_situation(db, "Admin seed: word_order row 2", "Σπίτι 2")
    desc12 = await _make_description(db, sit12.id)
    wo2 = WordOrderExercise(
        description_id=desc12.id,
        exercise_type=ExerciseType.WORD_ORDER,
        status=ExerciseStatus.PENDING,
        question_el="Βάλε τις λέξεις στη σωστή σειρά:",
        question_en="Put the words in the correct order:",
    )
    db.add(wo2)
    await db.flush()
    db.add(
        WordOrderExerciseItem(
            word_order_exercise_id=wo2.id,
            item_index=0,
            payload={
                "words": ["αγαπώ", "σε", "πολύ"],
                "correct_order": [1, 0, 2],
                "answer_el": "σε αγαπώ πολύ",
            },
        )
    )
    await db.flush()
    counts["word_order"] += 1

    # Row 13: word_order, approved
    sit13 = await _make_situation(db, "Admin seed: word_order row 3", "Δουλειά")
    desc13 = await _make_description(db, sit13.id)
    wo3 = WordOrderExercise(
        description_id=desc13.id,
        exercise_type=ExerciseType.WORD_ORDER,
        status=ExerciseStatus.APPROVED,
        question_el="Βάλε τις λέξεις στη σωστή σειρά:",
        question_en="Put the words in the correct order:",
    )
    db.add(wo3)
    await db.flush()
    db.add(
        WordOrderExerciseItem(
            word_order_exercise_id=wo3.id,
            item_index=0,
            payload={
                "words": ["εργάζομαι", "Αθήνα", "στην"],
                "correct_order": [0, 2, 1],
                "answer_el": "εργάζομαι στην Αθήνα",
            },
        )
    )
    await db.flush()
    counts["word_order"] += 1

    total = sum(counts.values())
    return {"total": total, **counts}
