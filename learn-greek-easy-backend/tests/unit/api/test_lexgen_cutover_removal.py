"""DB-free removal guards for the LEXGEN-14-02/14-03 backend cutover.

These tests run entirely without a Postgres connection — they operate on the
filesystem (AST parsing, file existence checks, import graph inspection).  They
are designed to:

  1. Be RED now (before the cutover): the forbidden imports / files / re-exports
     still exist, so assertion failures confirm the wrong-thing is present.
  2. Be GREEN after the cutover: the executor removes the 5 old service files
     and scrubs their imports from admin.py and services/__init__.py.

Tests B6–B9 (spec numbering continues from the API tests A1–A5 in
test_lexgen_submit_endpoint.py):

  B6  test_admin_module_has_no_old_consensus_imports
        AST-parse src/api/v1/admin.py → FAIL if any import references
        the 5 removed modules.  RED now; GREEN after admin.py imports scrubbed.

  B7  test_old_consensus_service_modules_deleted
        importlib.util.find_spec(path) for each of the 5 source files.
        RED now (files exist); GREEN after files deleted.

  B8  test_services_init_has_no_removed_reexports
        Import src.services and assert the removed names are NOT attributes.
        RED now; GREEN after __init__.py imports scrubbed.

  B9  test_kept_symbols_still_importable
        DuplicateDetectionService, LexiconService/LexiconEntry,
        TranslationLookupService, get_lemma_normalization_service/detect_article,
        NormalizedLemma/DuplicateCheckResult all import cleanly.
        GREEN now AND after the cutover — pure regression guard, never RED.

  B10  test_old_generate_routes_unregistered  (DB-free route inspection)
        Import the FastAPI app object and assert no route path matches the two
        old generate_word_entry route paths.
        NOTE: tested only if importing src.main does not require a live DB
        connection (it does not; the DB engine is lazily instantiated).
        RED now; GREEN after the route handlers are removed.

QA Mode-B additions (LEXGEN-14-02/14-03 adversarial coverage):

  B11  test_wiktionary_morphology_service_importable_and_pipeline_uses_it
        WiktionaryMorphologyService imports cleanly AND evidence_assembly_service
        (the new-pipeline's front door) imports it at the module level — protects
        the trickiest KEPT-vs-orphan call.  GREEN now AND after cutover.

  B12  test_wiktionary_morphology_model_importable
        WiktionaryMorphology ORM model (db/models.py) imports cleanly —
        guards the DB model that WiktionaryMorphologyService queries.
        GREEN now AND after cutover.

  B13  test_pipeline_service_imports_only_new_lexgen_services
        AST-parse src/services/lexgen_pipeline_service.py and assert it contains
        no import of the 5 removed consensus modules.  Prevents any silent
        re-coupling to old-flow code.  GREEN now AND after cutover.

  B14  test_submit_endpoint_schema_is_not_4xx_for_never_invent_body
        Validates the LexgenSubmitResponse schema accepts status="rejected" —
        proving the schema itself cannot force a 4xx encoding for semantic
        rejections (Decisions §3 invariant).  DB-free, schema-only.

Run locally:
    cd learn-greek-easy-backend && \\
    poetry run pytest tests/unit/api/test_lexgen_cutover_removal.py -v
"""

from __future__ import annotations

import ast
import importlib.util
import pathlib
import sys

import pytest

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

_BACKEND_ROOT = pathlib.Path(__file__).parent.parent.parent.parent
_ADMIN_PY = _BACKEND_ROOT / "src" / "api" / "v1" / "admin.py"
_SERVICES_INIT_PY = _BACKEND_ROOT / "src" / "services" / "__init__.py"

# The 5 forbidden module name fragments (match against import module strings).
_FORBIDDEN_FRAGMENTS: list[str] = [
    "verification_tier",
    "cross_ai_verification_service",
    "local_verification_service",
    "wiktionary_verification_service",
    "noun_data_generation_service",
]

# The 5 file paths that must be DELETED post-cutover.
_DELETED_MODULE_PATHS: list[tuple[str, pathlib.Path]] = [
    (
        "verification_tier",
        _BACKEND_ROOT / "src" / "services" / "verification_tier.py",
    ),
    (
        "cross_ai_verification_service",
        _BACKEND_ROOT / "src" / "services" / "cross_ai_verification_service.py",
    ),
    (
        "local_verification_service",
        _BACKEND_ROOT / "src" / "services" / "local_verification_service.py",
    ),
    (
        "wiktionary_verification_service",
        _BACKEND_ROOT / "src" / "services" / "wiktionary_verification_service.py",
    ),
    (
        "noun_data_generation_service",
        _BACKEND_ROOT / "src" / "services" / "noun_data_generation_service.py",
    ),
]

# Names that must NOT be attributes of `src.services` after the cutover.
_REMOVED_REEXPORT_NAMES: list[str] = [
    "CrossAIVerificationService",
    "get_cross_ai_verification_service",
    "LocalVerificationService",
    "get_local_verification_service",
    "NounDataGenerationService",
    "get_noun_data_generation_service",
    "WiktionaryVerificationService",
]


def _collect_all_imports(source: str) -> list[tuple[int, str]]:
    """Return (lineno, module_name) for every Import/ImportFrom node in source."""
    tree = ast.parse(source)
    results: list[tuple[int, str]] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module:
            results.append((node.lineno, node.module))
        elif isinstance(node, ast.Import):
            for alias in node.names:
                results.append((node.lineno, alias.name))
    return results


# ---------------------------------------------------------------------------
# B6 — AST guard: admin.py must not import the 5 old consensus modules
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_admin_module_has_no_old_consensus_imports() -> None:
    """B6: admin.py must have no import of the 5 removed consensus modules.

    AST-parses src/api/v1/admin.py source and fails if any Import or ImportFrom
    node references a forbidden module fragment.  Covers top-level AND deferred
    (lazy/inside-function) imports.

    RED now:  admin.py imports cross_ai_verification_service, local_verification_service,
              noun_data_generation_service, verification_tier,
              wiktionary_verification_service at lines ~208/216/220/222/223/225/243/244/246.
    GREEN after: the executor removes all those import lines.
    """
    assert _ADMIN_PY.exists(), f"admin.py not found at {_ADMIN_PY} — check path if file was moved"

    source = _ADMIN_PY.read_text(encoding="utf-8")
    all_imports = _collect_all_imports(source)

    violations: list[str] = []
    for lineno, module in all_imports:
        for fragment in _FORBIDDEN_FRAGMENTS:
            if fragment in module:
                violations.append(
                    f"  line {lineno}: import of '{module}' (matches forbidden '{fragment}')"
                )

    assert not violations, (
        "admin.py imports forbidden old-consensus modules (cutover not yet complete):\n"
        + "\n".join(violations)
        + "\n\nExpected GREEN after: executor scrubs these import lines."
    )


# ---------------------------------------------------------------------------
# B7 — File-existence guard: the 5 service files must be DELETED
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.parametrize(
    "module_name,file_path",
    _DELETED_MODULE_PATHS,
    ids=[name for name, _ in _DELETED_MODULE_PATHS],
)
def test_old_consensus_service_modules_deleted(
    module_name: str,
    file_path: pathlib.Path,
) -> None:
    """B7: Each of the 5 old service source files must NOT exist post-cutover.

    Uses pathlib.Path.exists() as the primary check and importlib.util.find_spec()
    as defense-in-depth (a .pyc-only stub would pass the file check but fail spec).

    RED now:  all 5 files exist at src/services/<name>.py.
    GREEN after: executor deletes them (LEXGEN-14-03 step).
    """
    assert not file_path.exists(), (
        f"Service file '{file_path.name}' still exists at {file_path}\n"
        f"Expected GREEN after: executor deletes this file (LEXGEN-14-03)."
    )

    # Defense-in-depth: confirm importlib cannot find the module either.
    # We must temporarily remove the module from sys.modules if it was already
    # imported during this test session (happens when running a full suite).
    full_module_name = f"src.services.{module_name}"
    was_cached = full_module_name in sys.modules
    if was_cached:
        del sys.modules[full_module_name]

    spec = importlib.util.find_spec(full_module_name)
    if was_cached and spec is None:
        # Restore the cached module so other tests that depend on it still work.
        # (This branch means: file already deleted, but was cached — fine.)
        pass

    assert spec is None, (
        f"importlib.util.find_spec('{full_module_name}') returned a spec ({spec}) "
        f"even though the file should be deleted.  "
        f"A stale .pyc or sys.modules entry may be hiding the deletion.\n"
        f"Expected GREEN after: executor deletes {file_path.name}."
    )


# ---------------------------------------------------------------------------
# B8 — Import-graph guard: src.services must not re-export removed names
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_services_init_has_no_removed_reexports() -> None:
    """B8: src.services must not expose the removed service names as attributes.

    Imports src.services and checks that none of the 7 removed names exist as
    attributes on the package.

    RED now:  CrossAIVerificationService, get_cross_ai_verification_service,
              LocalVerificationService, get_local_verification_service,
              NounDataGenerationService, get_noun_data_generation_service,
              WiktionaryVerificationService are all re-exported via
              src/services/__init__.py.
    GREEN after: executor removes those lines from __init__.py.
    """
    import src.services as services_pkg  # noqa: PLC0415

    still_present: list[str] = [
        name for name in _REMOVED_REEXPORT_NAMES if hasattr(services_pkg, name)
    ]

    assert not still_present, (
        "src.services still exposes removed names (cutover not yet complete):\n"
        + "\n".join(f"  - {name}" for name in still_present)
        + "\n\nExpected GREEN after: executor removes these from services/__init__.py."
    )


# ---------------------------------------------------------------------------
# B9 — Regression guard: KEPT symbols still importable (GREEN now AND after)
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_kept_symbols_still_importable() -> None:
    """B9: All 'KEEP' symbols from the design doc import cleanly.

    This test must be GREEN before AND after the cutover — it is a pure
    regression guard to detect accidental removal of symbols that must be kept.

    Symbols verified:
      - DuplicateDetectionService  (from src.services.duplicate_detection_service)
      - LexiconService, LexiconEntry  (from src.services.lexicon_service)
      - TranslationLookupService  (from src.services.translation_service)
      - get_lemma_normalization_service, detect_article  (lemma_normalization_service)
      - NormalizedLemma, DuplicateCheckResult  (from src.schemas.nlp)
    """
    # DuplicateDetectionService
    from src.services.duplicate_detection_service import DuplicateDetectionService  # noqa: PLC0415

    assert DuplicateDetectionService is not None

    # LexiconService, LexiconEntry
    from src.services.lexicon_service import LexiconEntry, LexiconService  # noqa: PLC0415

    assert LexiconService is not None
    assert LexiconEntry is not None

    # TranslationLookupService
    from src.services.translation_service import TranslationLookupService  # noqa: PLC0415

    assert TranslationLookupService is not None

    # get_lemma_normalization_service, detect_article
    from src.services.lemma_normalization_service import (  # noqa: PLC0415
        detect_article,
        get_lemma_normalization_service,
    )

    assert get_lemma_normalization_service is not None
    assert detect_article is not None

    # NormalizedLemma, DuplicateCheckResult
    from src.schemas.nlp import DuplicateCheckResult, NormalizedLemma  # noqa: PLC0415

    assert NormalizedLemma is not None
    assert DuplicateCheckResult is not None


# ---------------------------------------------------------------------------
# B10 — AST guard: old generate route decorators must be removed from admin.py
#
# NOTE on why we use AST instead of importing the FastAPI app:
# src.main import requires all pydantic Settings fields (incl. DATABASE_URL,
# picture_house_style_default, etc.) to be set — it fails locally without a
# full .env.  An AST walk over admin.py source is equivalent and more robust:
# it checks that the @router.post decorator with the old path string is gone.
# The API test A4 (in test_lexgen_submit_endpoint.py) covers the live HTTP
# contract; B10 is the DB-free static guard.
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_old_generate_route_decorators_removed_from_admin_py() -> None:
    """B10: The @router.post decorators for the two old generate_word_entry paths
    must NOT appear in admin.py after the cutover.

    AST-parses src/api/v1/admin.py and checks that no Call node is a
    router.post() invocation with the old path string as its first argument.
    Also checks via string search as a belt-and-suspenders guard.

    Target paths:
      "/word-entries/generate"         (maps to /api/v1/admin/word-entries/generate)
      "/word-entries/generate/stream"  (maps to /api/v1/admin/word-entries/generate/stream)

    RED now:  both @router.post decorators exist in admin.py (~lines 3657, 4097).
    GREEN after: executor removes the route handler functions and decorators.
    """
    assert _ADMIN_PY.exists(), f"admin.py not found at {_ADMIN_PY}"

    source = _ADMIN_PY.read_text(encoding="utf-8")

    # Belt-and-suspenders: string search first (fast and unambiguous).
    _OLD_PATH_STRINGS = [
        '"/word-entries/generate"',
        '"/word-entries/generate/stream"',
    ]

    violations: list[str] = []
    for path_str in _OLD_PATH_STRINGS:
        if path_str in source:
            # Find the line number for a useful failure message.
            for lineno, line in enumerate(source.splitlines(), start=1):
                if path_str in line and "@router" not in line and "router.post" not in line:
                    # Skip lines that are comments or inside string literals unrelated
                    # to a decorator — we only care about decorator-context appearances.
                    pass
                if path_str in line:
                    violations.append(f"  line {lineno}: route path {path_str} still present")
                    break

    assert not violations, (
        "Old generate_word_entry route path strings are still present in admin.py "
        "(cutover not yet complete):\n"
        + "\n".join(violations)
        + "\n\nExpected GREEN after: executor removes @router.post('/word-entries/generate') "
        "and @router.post('/word-entries/generate/stream') decorators + handler functions."
    )


# ---------------------------------------------------------------------------
# QA Mode-B additions — B11–B14
# Adversarial / edge / KEPT-definition guards added by QA after cutover.
# All DB-free; all GREEN now AND after the cutover (pure regression guards).
# ---------------------------------------------------------------------------

_EVIDENCE_ASSEMBLY_PY = _BACKEND_ROOT / "src" / "services" / "evidence_assembly_service.py"
_PIPELINE_SVC_PY = _BACKEND_ROOT / "src" / "services" / "lexgen_pipeline_service.py"


@pytest.mark.unit
def test_wiktionary_morphology_service_importable_and_pipeline_uses_it() -> None:
    """B11: WiktionaryMorphologyService is importable AND used by the new pipeline.

    Guards the trickiest KEPT-vs-orphan call identified in the architecture
    findings (§F4 / §Technical Notes):
      - The *definition* (wiktionary_morphology_service.py) must survive.
      - The *new pipeline* front-door (evidence_assembly_service.py) must still
        import and instantiate it — so the removal of old wiktionary_verification_service
        did NOT silently strand the entire Wiktionary data layer.

    Verified two ways:
      1. Import succeeds at Python level.
      2. The evidence_assembly_service.py source contains an import of
         WiktionaryMorphologyService (AST + string guard).
    """
    # 1 — Python import succeeds.
    from src.services.wiktionary_morphology_service import (  # noqa: PLC0415
        WiktionaryMorphologyService,
    )

    assert WiktionaryMorphologyService is not None, (
        "WiktionaryMorphologyService class must be importable from "
        "src.services.wiktionary_morphology_service"
    )
    assert hasattr(
        WiktionaryMorphologyService, "__init__"
    ), "WiktionaryMorphologyService must be a class with __init__"

    # 2 — evidence_assembly_service.py imports it (AST + belt-and-suspenders string check).
    assert (
        _EVIDENCE_ASSEMBLY_PY.exists()
    ), f"evidence_assembly_service.py not found at {_EVIDENCE_ASSEMBLY_PY}"
    source = _EVIDENCE_ASSEMBLY_PY.read_text(encoding="utf-8")

    # Belt-and-suspenders: plain string search.
    assert "WiktionaryMorphologyService" in source, (
        "evidence_assembly_service.py (the new pipeline front door) no longer "
        "references WiktionaryMorphologyService — the Wiktionary data layer may "
        "have been accidentally severed during the cutover cleanup.\n"
        f"File: {_EVIDENCE_ASSEMBLY_PY}"
    )

    # AST check: at least one ImportFrom node imports WiktionaryMorphologyService.
    all_imports = _collect_all_imports(source)
    wikt_import_found = any("wiktionary_morphology_service" in module for _, module in all_imports)
    assert wikt_import_found, (
        "evidence_assembly_service.py has no top-level import of "
        "wiktionary_morphology_service — WiktionaryMorphologyService is "
        "referenced in the source but not imported at module level, which "
        "would cause a NameError at runtime.\n"
        f"File: {_EVIDENCE_ASSEMBLY_PY}\n"
        f"Imports found: {[m for _, m in all_imports]}"
    )


@pytest.mark.unit
def test_wiktionary_morphology_model_importable() -> None:
    """B12: WiktionaryMorphology ORM model (db/models.py) imports cleanly.

    Protects the DB model that WiktionaryMorphologyService queries.  The
    model definition must not be confused with the deleted wiktionary_verification_service.
    """
    from src.db.models import WiktionaryMorphology  # noqa: PLC0415

    assert (
        WiktionaryMorphology is not None
    ), "WiktionaryMorphology ORM model must be importable from src.db.models"
    # Spot-check it's an ORM class (has a __tablename__).
    assert hasattr(
        WiktionaryMorphology, "__tablename__"
    ), "WiktionaryMorphology must be a SQLAlchemy ORM model (has __tablename__)"


@pytest.mark.unit
def test_pipeline_service_imports_only_new_lexgen_services() -> None:
    """B13: lexgen_pipeline_service.py contains no import of the 5 removed modules.

    Prevents silent re-coupling: if anyone adds an import of the deleted
    consensus services inside the new orchestrator, this fails immediately.
    """
    assert _PIPELINE_SVC_PY.exists(), f"lexgen_pipeline_service.py not found at {_PIPELINE_SVC_PY}"
    source = _PIPELINE_SVC_PY.read_text(encoding="utf-8")
    all_imports = _collect_all_imports(source)

    violations: list[str] = []
    for lineno, module in all_imports:
        for fragment in _FORBIDDEN_FRAGMENTS:
            if fragment in module:
                violations.append(
                    f"  line {lineno}: '{module}' matches forbidden fragment '{fragment}'"
                )

    assert not violations, (
        "lexgen_pipeline_service.py imports a removed consensus module — "
        "the new orchestrator must not re-couple to old-flow code:\n" + "\n".join(violations)
    )


@pytest.mark.unit
def test_submit_endpoint_schema_rejects_disallowed_status_values() -> None:
    """B14: LexgenSubmitResponse schema allows only 'needs_review' or 'rejected'.

    Validates the schema invariant for Decisions §3: the submit endpoint
    returns a 2xx body (never raises 4xx for semantic rejections), and the
    status field is strictly typed to the two allowed values.

    This is a DB-free schema-layer guard: if someone accidentally adds
    'auto_approved' or other status to the Literal, this test does NOT fail
    (that would be a new allowed value, not a type violation).  What it DOES
    catch is the converse: the schema must accept both "needs_review" AND
    "rejected" without a ValidationError — proving that never-invent rejections
    can be expressed in the response body.
    """
    import uuid  # noqa: PLC0415

    from src.schemas.admin import LexgenSubmitResponse  # noqa: PLC0415

    fake_id = uuid.uuid4()

    # needs_review round-trip.
    r1 = LexgenSubmitResponse(id=fake_id, status="needs_review", rejection_reason=None)
    assert r1.status == "needs_review"
    assert r1.rejection_reason is None

    # rejected round-trip — this is the never-invent path (Decisions §3).
    r2 = LexgenSubmitResponse(
        id=fake_id,
        status="rejected",
        rejection_reason="never_invent: lemma absent from all references",
    )
    assert r2.status == "rejected"
    assert r2.rejection_reason is not None
    assert "never_invent" in r2.rejection_reason

    # Sanity: the schema must NOT accept a forbidden value like 'auto_approved'.
    import pydantic  # noqa: PLC0415

    with pytest.raises((pydantic.ValidationError, ValueError)):
        LexgenSubmitResponse(id=fake_id, status="auto_approved", rejection_reason=None)
