"""Frozen reviewed-fixture scaffold for the 19 no-twin exam-paper residue rows.

WEDGE-02-01 (D-A11): of the 113 past-exam-paper question copies, 94 have
exactly one clean thematic twin (inherited deterministically by the engine's
Pass 2) and 19 have no thematic twin at all. Rather than blind-defaulting
those 19 to ``culture`` (which would silently mis-tag any that are really
history/geography/politics/practical), they are captured as a small,
checked-in, FROZEN judgment fixture — assigned by Claude reading the real
question content from prod (a one-time, human-authorized read), each with a
one-line rationale.

``ReviewedTopic`` is the injectable per-entry type. ``RESIDUE_TOPIC_FIXTURE``
is the checked-in dict, keyed on ``normalize_twin_key``-form question text.

WEDGE-02-02 (this subtask): populates the 19 real entries below. This IS the
"Claude assigns the topics" sign-off for the judgment residue (founder
directive) — assigned by Claude (the RALPH orchestrator) from a one-time,
human-authorized read of the live prod ``culture_questions`` rows, grounded
in the actual question content and calibrated against each thematic deck's
scope (see each entry's inline rationale).

Tally: 14 culture / 2 politics / 3 practical / 0 history / 0 geography.

The 14 culture and 2 politics assignments are high-confidence (unambiguous
subject match). The 3 ``practical`` entries — population, share of
immigrants, dominant foreign language — are the genuine borderline calls
(practical vs. geography): they are contemporary descriptive facts about
modern Cyprus, which matches the Practical deck's broad scope, whereas the
Geography deck is physical-geography-only (no demographics). These 3 are
flagged in their rationale as ``JUDGMENT`` for founder override.

Each entry is commented with its source ``el`` (the original prod question
text, pre-normalization) so the rationale/topic is human-reviewable — this
checked-in fixture IS the review record for these 19 judgment rows
(AC4/D-A11).

The two-pass engine's ``reviewed_fixture`` parameter is injectable
specifically so this subtask's tests never depend on the real 19 rows — see
``tests/integration/services/test_culture_topic_tagger.py``, which injects
small synthetic fixtures instead.
"""

from __future__ import annotations

from typing import NamedTuple

from src.core.culture_topic import CultureTopic


class ReviewedTopic(NamedTuple):
    """One frozen judgment entry: the assigned topic + a one-line rationale."""

    topic: CultureTopic
    rationale: str


RESIDUE_TOPIC_FIXTURE: dict[str, ReviewedTopic] = {
    # el: "Για τι είναι διάσημα τα Λεύκαρα;"
    "για τι είναι διάσημα τα λεύκαρα;": ReviewedTopic(
        topic=CultureTopic.CULTURE,
        rationale="Lefkara lace/embroidery — traditional Cypriot craft.",
    ),
    # el: "Ποιες είναι οι επίσημες γλώσσες της Κυπριακής Δημοκρατίας;"
    "ποιες είναι οι επίσημες γλώσσες της κυπριακής δημοκρατίας;": ReviewedTopic(
        topic=CultureTopic.POLITICS,
        rationale=(
            "Official state languages — constitutional/governance matter "
            "(distinct from de-facto language use)."
        ),
    ),
    # el: "Ποιο από τα πιο κάτω δεν είναι παραδοσιακό της Κύπρου;"
    "ποιο από τα πιο κάτω δεν είναι παραδοσιακό της κύπρου;": ReviewedTopic(
        topic=CultureTopic.CULTURE,
        rationale="Traditional Cypriot foods (feta is the non-Cypriot outlier).",
    ),
    # el: "Σε ποια πόλη διεξάγεται η γιορτή του κρασιού;"
    "σε ποια πόλη διεξάγεται η γιορτή του κρασιού;": ReviewedTopic(
        topic=CultureTopic.CULTURE,
        rationale=(
            "Wine festival — cultural event (subject is the festival, city " "is incidental)."
        ),
    ),
    # el: "Τι γιορτάζουν οι Κύπριοι το Πάσχα;"
    "τι γιορτάζουν οι κύπριοι το πάσχα;": ReviewedTopic(
        topic=CultureTopic.CULTURE,
        rationale="Easter = Resurrection — religious tradition.",
    ),
    # el: "Η πιο διαδεδομένη ξένη γλώσσα στην Κύπρο είναι η ..."
    "η πιο διαδεδομένη ξένη γλώσσα στην κύπρο είναι η ...": ReviewedTopic(
        topic=CultureTopic.PRACTICAL,
        rationale=(
            "Most-spoken foreign language — contemporary sociolinguistic/"
            "demographic fact; matches the Practical deck's broad modern-"
            "Cyprus scope, not the physical-only Geography deck. Distinct "
            "from official languages (politics). JUDGMENT: borderline "
            "practical/geography."
        ),
    ),
    # el: "Οι λοκμάδες (λουκουμάδες) είναι ένα είδος γλυκού και είναι έθιμο
    #      στην Κύπρο να προσφέρονται, παραδοσιακά, κυρίως στις γιορτές ..."
    (
        "οι λοκμάδες (λουκουμάδες) είναι ένα είδος γλυκού και είναι έθιμο "
        "στην κύπρο να προσφέρονται, παραδοσιακά, κυρίως στις γιορτές ..."
    ): ReviewedTopic(
        topic=CultureTopic.CULTURE,
        rationale="Loukoumades feast-day custom — food/religious tradition.",
    ),
    # el: "Όταν παραγγείλουμε «κυπριακό μεζέ» σε μια κυπριακή ταβέρνα, μας
    #      φέρνουν ..."
    (
        "όταν παραγγείλουμε «κυπριακό μεζέ» σε μια κυπριακή ταβέρνα, μας " "φέρνουν ..."
    ): ReviewedTopic(
        topic=CultureTopic.CULTURE,
        rationale="Cypriot meze — traditional cuisine.",
    ),
    # el: "Ποιο από τα ακόλουθα αλκοολούχα ποτά δεν είναι Κυπριακό;"
    "ποιο από τα ακόλουθα αλκοολούχα ποτά δεν είναι κυπριακό;": ReviewedTopic(
        topic=CultureTopic.CULTURE,
        rationale="Traditional Cypriot drinks (rum is the non-Cypriot outlier).",
    ),
    # el: "5% του πληθυσμού είναι μετανάστες."
    "5% του πληθυσμού είναι μετανάστες.": ReviewedTopic(
        topic=CultureTopic.PRACTICAL,
        rationale=(
            "Share of population that are immigrants — contemporary "
            "demographic fact; matches the Practical deck's descriptive "
            "modern-Cyprus scope. JUDGMENT: borderline practical/geography."
        ),
    ),
    # el: "Ποια κυπριακή πόλη είναι διάσημη για τις εκδηλώσεις του
    #      καρναβαλιού της;"
    "ποια κυπριακή πόλη είναι διάσημη για τις εκδηλώσεις του καρναβαλιού της;": ReviewedTopic(
        topic=CultureTopic.CULTURE,
        rationale="Limassol carnival — cultural event.",
    ),
    # el: "Ποιες είναι οι επίσημες γλώσσες της Κυπριακής Δημοκρατίας με βάση
    #      το Σύνταγμα;"
    (
        "ποιες είναι οι επίσημες γλώσσες της κυπριακής δημοκρατίας με βάση " "το σύνταγμα;"
    ): ReviewedTopic(
        topic=CultureTopic.POLITICS,
        rationale=(
            "Official languages per the Constitution — constitutional/" "governance matter."
        ),
    ),
    # el: "Από τι φτιάχνεται το παραδοσιακό έδεσμα σιουσιούκκος;"
    "από τι φτιάχνεται το παραδοσιακό έδεσμα σιουσιούκκος;": ReviewedTopic(
        topic=CultureTopic.CULTURE,
        rationale="Siousioukkos — traditional Cypriot sweet.",
    ),
    # el: "Ποιος είναι ο πληθυσμός της Κυπριακής Δημοκρατίας σύμφωνα με τα
    #      τελευταία στοιχεία;"
    (
        "ποιος είναι ο πληθυσμός της κυπριακής δημοκρατίας σύμφωνα με τα " "τελευταία στοιχεία;"
    ): ReviewedTopic(
        topic=CultureTopic.PRACTICAL,
        rationale=(
            "Population of Cyprus — contemporary demographic fact; the "
            "Geography deck is physical-only (no demographics), so this "
            "matches the Practical deck's descriptive scope. JUDGMENT: "
            "borderline practical/geography."
        ),
    ),
    # el: "Πότε γίνεται το κόψιμο της παραδοσιακής βασιλόπιτας στην Κύπρο;"
    "πότε γίνεται το κόψιμο της παραδοσιακής βασιλόπιτας στην κύπρο;": ReviewedTopic(
        topic=CultureTopic.CULTURE,
        rationale="Vasilopita cutting — New Year custom.",
    ),
    # el: "Που λαμβάνει χώρα το Φεστιβάλ Τριαντάφυλλου στην Κύπρο;"
    "που λαμβάνει χώρα το φεστιβάλ τριαντάφυλλου στην κύπρο;": ReviewedTopic(
        topic=CultureTopic.CULTURE,
        rationale="Rose Festival (Agros) — cultural event.",
    ),
    # el: "Η άναμμα φωτιάς, γνωστή ως Λαμπρατζιά, είναι μια παράδοση στην
    #      Κύπρο που σχετίζεται με τον εορτασμό της ..."
    (
        "η άναμμα φωτιάς, γνωστή ως λαμπρατζιά, είναι μια παράδοση στην "
        "κύπρο που σχετίζεται με τον εορτασμό της ..."
    ): ReviewedTopic(
        topic=CultureTopic.CULTURE,
        rationale="Lambratzia (Easter bonfire) — folk/religious tradition.",
    ),
    # el: "Οι Κύπριοι, παραδοσιακά, ζυμώνουν φλαούνες τις παραμονές της
    #      γιορτής ..."
    "οι κύπριοι, παραδοσιακά, ζυμώνουν φλαούνες τις παραμονές της γιορτής ...": ReviewedTopic(
        topic=CultureTopic.CULTURE,
        rationale="Flaounes (Easter) — food/religious tradition.",
    ),
    # el: "Το ροδοπέταλο (ροδόνερο), που χρησιμοποιείται στην Κυπριακή
    #      ζαχαροπλαστική, γίνεται από ..."
    (
        "το ροδοπέταλο (ροδόνερο), που χρησιμοποιείται στην κυπριακή "
        "ζαχαροπλαστική, γίνεται από ..."
    ): ReviewedTopic(
        topic=CultureTopic.CULTURE,
        rationale="Rosewater from roses — traditional Cypriot confectionery ingredient.",
    ),
}
