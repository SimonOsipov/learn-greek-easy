"""Production-exported seed content (situations + word enrichment).

Rows exported verbatim from the production database on 2026-06-11 so the dev
environment renders the same media-rich UI as production (retelling audio,
situation pictures, word pronunciation/example audio, flat-format declensions).

The referenced S3 objects were copied from the production bucket into the dev
bucket under the SAME keys (one-time copy; see PR #584). The seed only stores
the key strings — presigning happens per-environment at read time.

word_timestamps were intentionally not ported (large, and no seeded consumer).
"""

from typing import Any

# ---------------------------------------------------------------------------
# Situations (3) — each with B1 + A2 retelling audio, one approved
# select_correct_answer exercise (B1/listening variant) and a generated picture.
# ---------------------------------------------------------------------------

PROD_SITUATIONS: list[dict[str, Any]] = [
    {
        "scenario_el": (
            "Τα έσοδα του τουρισμού της Κύπρου φτάνουν τα 3,6 δισ. ευρώ — "
            "Οι Ισραηλινοί επισκέπτες οι υψηλότεροι σε ημερήσια δαπάνη"
        ),
        "scenario_en": "Cyprus Tourism Revenue Hits €3.6bn — Israeli Visitors Highest Daily Spenders",
        "scenario_ru": (
            "Доходы от туризма Кипра достигли 3,6 млрд евро — "
            "израильские туристы тратят больше всех в день"
        ),
        "text_el": (
            "Τα έσοδα από τον τουρισμό στην Κύπρο για την περίοδο Ιανουαρίου-Νοεμβρίου 2025 "
            "εκτιμώνται σε 3,6 δισεκατομμύρια ευρώ, σημειώνοντας αύξηση 15,3% σε σχέση με το 2024. "
            "Το Ηνωμένο Βασίλειο παραμένει η μεγαλύτερη αγορά με 22,70% των αφίξεων, ενώ οι "
            "Ισραηλινοί τουρίστες ξοδεύουν τα περισσότερα ανά ημέρα με 168,90 ευρώ."
        ),
        "text_el_a2": (
            "Από τον Ιανουάριο μέχρι τον Νοέμβριο του 2025, ο τουρισμός στην Κύπρο έφερε "
            "3,6 δισεκατομμύρια ευρώ. Αυτό είναι 15,3% περισσότερο από το 2024. Οι πιο πολλοί "
            "τουρίστες έρχονται από το Ηνωμένο Βασίλειο, με 22,70% του συνόλου. Οι Ισραηλινοί "
            "τουρίστες ξοδεύουν τα πιο πολλά χρήματα τη μέρα, 168,90 ευρώ."
        ),
        "audio_s3_key": "situation-description-audio/487ef6e8-6058-44ef-be2f-0c91da378859.mp3",
        "audio_a2_s3_key": "situation-description-audio/a2/487ef6e8-6058-44ef-be2f-0c91da378859.mp3",
        "audio_duration_seconds": 25.26,
        "audio_a2_duration_seconds": 24.42,
        "exercise": {
            "question_en": (
                "Cyprus Tourism Revenue Hits €3.6bn — Israeli Visitors Highest Daily Spenders"
            ),
            "payload": {
                "prompt": {
                    "el": (
                        "Σύμφωνα με το άρθρο, πόσα ξοδεύουν κατά μέσο όρο ημερησίως "
                        "οι Ισραηλινοί τουρίστες στην Κύπρο;"
                    ),
                    "en": (
                        "According to the article, how much do Israeli tourists spend "
                        "on average per day in Cyprus?"
                    ),
                    "ru": (
                        "Согласно статье, сколько в среднем тратят израильские туристы "
                        "в день на Кипре?"
                    ),
                },
                "options": [
                    {"el": "168,90 ευρώ", "en": "€168.90", "ru": "168,90 евро"},
                    {"el": "87,68 ευρώ", "en": "€87.68", "ru": "87,68 евро"},
                    {"el": "82,97 ευρώ", "en": "€82.97", "ru": "82,97 евро"},
                    {"el": "716,00 ευρώ", "en": "€716.00", "ru": "716,00 евро"},
                ],
                "correct_answer_index": 0,
            },
        },
        "picture": {
            "image_s3_key": "situation-pictures/a7bda07c-5355-4b31-8d47-d73380922692.png",
            "scene_en": (
                "A bustling outdoor restaurant terrace overlooking a Cypriot harbor at sunset, "
                "with several tourists seated at wooden tables enjoying meals of grilled fish "
                "and salads. A waiter in a white shirt carries a tray of drinks toward a couple "
                "in summer clothes, while a chalkboard menu stands near the entrance. Soft "
                "golden light reflects off the calm sea in the background."
            ),
        },
    },
    {
        "scenario_el": (
            "Κλείδωσε η 15η θέση για την Κύπρο – Με πέντε εκπροσώπους στην Ευρώπη, "
            "δύο ομάδες στο Champions League"
        ),
        "scenario_en": (
            "Cyprus Secures 15th Place in UEFA Ranking – Five Representatives in Europe, "
            "Two Teams in Champions League"
        ),
        "scenario_ru": (
            "Кипр закрепил 15-е место в рейтинге УЕФА — пять представителей в Европе, "
            "две команды в Лиге чемпионов"
        ),
        "text_el": (
            "Η Κύπρος κλείδωσε την 15η θέση στην κατάταξη της UEFA, μετά τον αποκλεισμό της "
            "ελβετικής Λωζάνης από την τσέχικη Σίγμα Όλομουτς, που άφησε την Ελβετία χωρίς "
            "εκπροσώπους στην Ευρώπη. Αυτό σημαίνει ότι τη σεζόν 2027-2028 η Κύπρος θα έχει "
            "πέντε εκπροσώπους στις ευρωπαϊκές διοργανώσεις: δύο ομάδες στο Champions League, "
            "μία στο Europa League και δύο στο Conference League."
        ),
        "text_el_a2": (
            "Η Κύπρος πήρε τη 15η θέση στη βαθμολογία της UEFA. Αυτό έγινε γιατί η ελβετική "
            "ομάδα Λωζάνη έχασε από την τσέχικη Σίγμα Όλομουτς και η Ελβετία έμεινε χωρίς "
            "ομάδες στην Ευρώπη. Τη σεζόν 2027-2028 η Κύπρος θα έχει πέντε ομάδες στην Ευρώπη: "
            "δύο στο Champions League, μία στο Europa League και δύο στο Conference League."
        ),
        "audio_s3_key": "situation-description-audio/22ae6215-1471-40c9-afa9-3aa17465b357.mp3",
        "audio_a2_s3_key": "situation-description-audio/a2/22ae6215-1471-40c9-afa9-3aa17465b357.mp3",
        "audio_duration_seconds": 25.34,
        "audio_a2_duration_seconds": 21.03,
        "exercise": {
            "question_en": (
                "Cyprus Secures 15th Place in UEFA Ranking – Five Representatives in Europe, "
                "Two Teams in Champions League"
            ),
            "payload": {
                "prompt": {
                    "el": (
                        "Σύμφωνα με το άρθρο, πόσες κυπριακές ομάδες θα συμμετέχουν "
                        "στο Europa League τη σεζόν 2027-2028;"
                    ),
                    "en": (
                        "According to the article, how many Cypriot teams will participate "
                        "in the Europa League in the 2027-2028 season?"
                    ),
                    "ru": (
                        "Согласно статье, сколько кипрских команд будут участвовать "
                        "в Лиге Европы в сезоне 2027-2028?"
                    ),
                },
                "options": [
                    {"el": "Δύο", "en": "Two", "ru": "Две"},
                    {"el": "Τρεις", "en": "Three", "ru": "Три"},
                    {"el": "Μία", "en": "One", "ru": "Одна"},
                    {"el": "Τέσσερις", "en": "Four", "ru": "Четыре"},
                ],
                "correct_answer_index": 2,
            },
        },
        "picture": {
            "image_s3_key": "situation-pictures/b72206ac-3b43-4987-900b-bdcc79e68716.png",
            "scene_en": (
                "A quiet locker-room bench in soft late-evening light, with a black tactics "
                "board leaning against a pale wall. On the board, five small abstract crest "
                "shapes — a circle, a triangle, a diamond, a shield, and a star — are arranged "
                "in a neat row in muted blues and reds, with a hand-drawn ladder chart beside "
                "them where a small marker rests on the fifteenth rung from the bottom and an "
                "upward arrow curves over the top rungs. In the foreground on the worn wooden "
                "bench sit a clean white-and-black football boot and a single white football "
                "with simple dark pentagon patches, beside a neatly folded plain "
                "green-and-white striped towel."
            ),
        },
    },
    {
        "scenario_el": (
            "Αρχίζει στη Λευκωσία διήμερο Άτυπο Συμβούλιο υπουργών Παιδείας "
            "στο πλαίσιο της Κυπριακής Προεδρίας"
        ),
        "scenario_en": (
            "Two-Day Informal Council of Education Ministers Begins in Nicosia "
            "Under the Cyprus Presidency"
        ),
        "scenario_ru": (
            "В Никосии начинается двухдневное неформальное заседание министров образования "
            "в рамках председательства Кипра"
        ),
        "text_el": (
            "Το Άτυπο Συμβούλιο των Υπουργών Παιδείας της ΕΕ πραγματοποιείται στις 29-30 "
            "Ιανουαρίου 2026 στο Συνεδριακό Κέντρο «Φιλοξενία» στη Λευκωσία. Η Υπουργός "
            "Παιδείας Αθηνά Μιχαηλίδου θα προεδρεύσει των εργασιών, με θέμα τη στήριξη και "
            "επαγγελματική ανάπτυξη των εκπαιδευτικών. Βασικός ομιλητής θα είναι ο καθηγητής "
            "Μιχαλίνος Ζεμπύλας του Ανοικτού Πανεπιστημίου Κύπρου."
        ),
        "text_el_a2": (
            "Οι Υπουργοί Παιδείας της ΕΕ θα συναντηθούν στις 29-30 Ιανουαρίου 2026 στο κέντρο "
            "«Φιλοξενία» στη Λευκωσία. Η Υπουργός Παιδείας Αθηνά Μιχαηλίδου θα είναι η πρόεδρος "
            "της συνάντησης. Θα μιλήσουν για το πώς μπορούν να βοηθήσουν τους δασκάλους στη "
            "δουλειά τους. Ο κύριος ομιλητής θα είναι ο καθηγητής Μιχαλίνος Ζεμπύλας από το "
            "Ανοικτό Πανεπιστήμιο Κύπρου."
        ),
        "audio_s3_key": "situation-description-audio/c0ebd47c-b8de-4682-8633-76145a7d6e6d.mp3",
        "audio_a2_s3_key": "situation-description-audio/a2/c0ebd47c-b8de-4682-8633-76145a7d6e6d.mp3",
        "audio_duration_seconds": 22.83,
        "audio_a2_duration_seconds": 23.67,
        "exercise": {
            "question_en": (
                "Two-Day Informal Council of Education Ministers Begins in Nicosia "
                "Under the Cyprus Presidency"
            ),
            "payload": {
                "prompt": {
                    "el": (
                        "Στο Άτυπο Συμβούλιο Υπουργών Παιδείας της ΕΕ στη Λευκωσία, ποιος θα "
                        "είναι ο βασικός ομιλητής στην εναρκτήρια συνεδρία με θέμα "
                        "«Το επάγγελμα του εκπαιδευτικού στη νέα εποχή»;"
                    ),
                    "en": (
                        "At the EU Informal Council of Education Ministers in Nicosia, who will "
                        "be the keynote speaker at the opening session on 'The teaching "
                        "profession in the new era'?"
                    ),
                    "ru": (
                        "На неформальном заседании Совета министров образования ЕС в Никосии, "
                        "кто выступит основным докладчиком на открытии сессии на тему "
                        "«Профессия учителя в новую эпоху»?"
                    ),
                },
                "options": [
                    {
                        "el": "Ο καθηγητής Μιχαλίνος Ζεμπύλας του Ανοικτού Πανεπιστημίου Κύπρου",
                        "en": "Professor Michalinos Zembylas from the Open University of Cyprus",
                        "ru": "Профессор Михалинос Зембилас из Открытого университета Кипра",
                    },
                    {
                        "el": "Η Γενική Διευθύντρια Pia Ahrenkilde Hansen",
                        "en": "Director-General Pia Ahrenkilde Hansen",
                        "ru": "Генеральный директор Пиа Аренкильде Хансен",
                    },
                    {
                        "el": "Η Εκτελεστική Αντιπρόεδρος Roxana Mînzatu",
                        "en": "Executive Vice-President Roxana Mînzatu",
                        "ru": "Исполнительный вице-президент Роксана Мынзату",
                    },
                    {
                        "el": "Η Υπουργός Παιδείας Αθηνά Μιχαηλίδου",
                        "en": "Minister of Education Athena Michailidou",
                        "ru": "Министр образования Афина Михаилиду",
                    },
                ],
                "correct_answer_index": 0,
            },
        },
        "picture": {
            "image_s3_key": "situation-pictures/94aaeb83-7cb0-48ca-bbd6-18379eedca75.png",
            "scene_en": (
                "A wide view of a modern conference hall set up for a high-level meeting, with "
                "rows of curved tables arranged in a horseshoe shape, each place set with a "
                "microphone, a small flag on a stand, a glass of water, and a folder. The room "
                "is brightly lit by overhead lights, and a blank presentation screen stands at "
                "the front. A few people in formal suits walk between the tables, preparing "
                "for the session."
            ),
        },
    },
]

# ---------------------------------------------------------------------------
# Word-entry enrichment, keyed by lemma. Grammar uses the canonical FLAT key
# format (nominative_singular, ...) that the card generator, the admin word
# pipeline and both clients parse. Examples carry per-example audio keys.
# `notes` follows the web word-reference canon (grammar_data.notes).
# ---------------------------------------------------------------------------

PROD_WORD_ENRICHMENT: dict[str, dict[str, Any]] = {
    "σπίτι": {
        "translation_en": "house, home, household",
        "translation_ru": "дом, домашнее хозяйство",
        "pronunciation": "/ˈspi.ti/",
        "audio_key": "word-audio/bc9e16b3-f3be-4f6a-a39d-58b390e3b6e8.mp3",
        "grammar_data": {
            "gender": "neuter",
            "declension_group": "neuter_i",
            "nominative_singular": "το σπίτι",
            "genitive_singular": "του σπιτιού",
            "accusative_singular": "το σπίτι",
            "vocative_singular": "σπίτι",
            "nominative_plural": "τα σπίτια",
            "genitive_plural": "των σπιτιών",
            "accusative_plural": "τα σπίτια",
            "vocative_plural": "σπίτια",
            "notes": (
                "Στο σπίτι means both 'at home' and 'to the house' — context decides. "
                "The genitive plural shifts the stress: των σπιτιών."
            ),
        },
        "examples": [
            {
                "id": "ex_spiti0",
                "greek": "Το σπίτι μου είναι κοντά.",
                "english": "My house is nearby.",
                "russian": "Мой дом рядом.",
                "audio_key": "word-audio/bc9e16b3-f3be-4f6a-a39d-58b390e3b6e8/ex_spiti0.mp3",
                "audio_status": "ready",
            },
            {
                "id": "ex_spiti1",
                "greek": "Πήγαμε στο σπίτι του φίλου μου.",
                "english": "We went to my friend's house.",
                "russian": "Мы пошли в дом моего друга.",
                "audio_key": "word-audio/bc9e16b3-f3be-4f6a-a39d-58b390e3b6e8/ex_spiti1.mp3",
                "audio_status": "ready",
            },
        ],
    },
    "παιδί": {
        "translation_en": "child, kid",
        "translation_ru": "ребёнок",
        "pronunciation": "/peˈði/",
        "audio_key": "word-audio/98a2afb2-006a-427a-a0b4-1dae75f955dd.mp3",
        "grammar_data": {
            "gender": "neuter",
            "declension_group": "neuter_i",
            "nominative_singular": "το παιδί",
            "genitive_singular": "του παιδιού",
            "accusative_singular": "το παιδί",
            "vocative_singular": "παιδί",
            "nominative_plural": "τα παιδιά",
            "genitive_plural": "των παιδιών",
            "accusative_plural": "τα παιδιά",
            "vocative_plural": "παιδιά",
            "notes": (
                "Παιδιά is also a friendly way to address a group of people, "
                "like 'guys' in English."
            ),
        },
        "examples": [
            {
                "id": "ex_paidi0",
                "greek": "Το παιδί παίζει στην αυλή.",
                "english": "The child is playing in the yard.",
                "russian": "Ребёнок играет во дворе.",
                "audio_key": "word-audio/98a2afb2-006a-427a-a0b4-1dae75f955dd/ex_paidi0.mp3",
                "audio_status": "ready",
            },
            {
                "id": "ex_paidi1",
                "greek": "Τα παιδιά πήγαν στο πάρκο.",
                "english": "The children went to the park.",
                "russian": "Дети пошли в парк.",
                "audio_key": "word-audio/98a2afb2-006a-427a-a0b4-1dae75f955dd/ex_paidi1.mp3",
                "audio_status": "ready",
            },
        ],
    },
    "γυναίκα": {
        "translation_en": "woman, wife",
        "translation_ru": "женщина, жена",
        "pronunciation": "/ɣiˈne.ka/",
        "audio_key": "word-audio/5b120b0d-6fa7-4976-bdef-83f64287b8c9.mp3",
        "grammar_data": {
            "gender": "feminine",
            "declension_group": "feminine_a",
            "nominative_singular": "η γυναίκα",
            "genitive_singular": "της γυναίκας",
            "accusative_singular": "τη γυναίκα",
            "vocative_singular": "γυναίκα",
            "nominative_plural": "οι γυναίκες",
            "genitive_plural": "των γυναικών",
            "accusative_plural": "τις γυναίκες",
            "vocative_plural": "γυναίκες",
            "notes": (
                "Means both 'woman' and 'wife' — η γυναίκα μου is 'my wife'. "
                "Note the stress shift in the genitive plural: των γυναικών."
            ),
        },
        "examples": [
            {
                "id": "ex_gunaika0",
                "greek": "Η γυναίκα του είναι γιατρός.",
                "english": "His wife is a doctor.",
                "russian": "Его жена - врач.",
                "audio_key": "word-audio/5b120b0d-6fa7-4976-bdef-83f64287b8c9/ex_gunaika0.mp3",
                "audio_status": "ready",
            },
            {
                "id": "ex_gunaika1",
                "greek": "Είδα μια γυναίκα στο πάρκο.",
                "english": "I saw a woman in the park.",
                "russian": "Я видел женщину в парке.",
                "audio_key": "word-audio/5b120b0d-6fa7-4976-bdef-83f64287b8c9/ex_gunaika1.mp3",
                "audio_status": "ready",
            },
        ],
    },
    "φίλος": {
        "translation_en": "friend, boyfriend, acquaintance",
        "translation_ru": "друг, приятель",
        "pronunciation": "/ˈfi.los/",
        "audio_key": "word-audio/a4240112-704b-4faf-bda4-3a3779668554.mp3",
        "grammar_data": {
            "gender": "masculine",
            "declension_group": "masculine_os",
            "nominative_singular": "ο φίλος",
            "genitive_singular": "του φίλου",
            "accusative_singular": "τον φίλο",
            "vocative_singular": "φίλε",
            "nominative_plural": "οι φίλοι",
            "genitive_plural": "των φίλων",
            "accusative_plural": "τους φίλους",
            "vocative_plural": "φίλοι",
            "notes": (
                "Ο φίλος μου can mean 'my friend' or 'my boyfriend' — context decides. "
                "The vocative φίλε! is a very common casual address."
            ),
        },
        "examples": [
            {
                "id": "ex_filos0",
                "greek": "Ο φίλος μου έρχεται σήμερα.",
                "english": "My friend is coming today.",
                "russian": "Мой друг приходит сегодня.",
                "audio_key": "word-audio/a4240112-704b-4faf-bda4-3a3779668554/ex_filos0.mp3",
                "audio_status": "ready",
            },
            {
                "id": "ex_filos1",
                "greek": "Χαίρομαι που σε βλέπω, φίλε μου!",
                "english": "I'm glad to see you, my friend!",
                "russian": "Рад тебя видеть, мой друг!",
                "audio_key": "word-audio/a4240112-704b-4faf-bda4-3a3779668554/ex_filos1.mp3",
                "audio_status": "ready",
            },
        ],
    },
}
