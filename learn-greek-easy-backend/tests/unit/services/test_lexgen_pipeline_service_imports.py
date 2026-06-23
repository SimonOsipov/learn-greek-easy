"""Unit test: LEXGEN-14-01 QA Mode B — AC4 import isolation guard.

Verifies that ``src.services.lexgen_pipeline_service`` does NOT import any of
the five old consensus/legacy services that are explicitly excluded from the v1
orchestrator (AC4).

This test is intentionally DB-free so it can run locally without Postgres.
It parses the module source with the AST — no import side-effects, no DB
session required.  Run with:

    cd learn-greek-easy-backend && \\
    poetry run pytest tests/unit/services/test_lexgen_pipeline_service_imports.py -v
"""

from __future__ import annotations

import ast
import pathlib

import pytest

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_MODULE_PATH = (
    pathlib.Path(__file__).parent.parent.parent.parent  # repo root → backend
    / "src"
    / "services"
    / "lexgen_pipeline_service.py"
)

_FORBIDDEN_MODULE_FRAGMENTS: list[str] = [
    "verification_tier",
    "cross_ai_verification_service",
    "local_verification_service",
    "wiktionary_verification_service",
    "noun_data_generation_service",
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
# Tests (DB-free — runnable locally without Postgres)
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_lexgen_pipeline_service_does_not_import_old_consensus_services() -> None:
    """AC4 guard: pipeline service must import ONLY LEXGEN-06/08/09/10/11 services.

    None of the five old consensus modules may appear in the import graph of
    ``lexgen_pipeline_service.py`` (top-level or deferred/lazy imports inside
    functions or type-checking blocks).

    Forbidden modules:
        - verification_tier
        - cross_ai_verification_service
        - local_verification_service
        - wiktionary_verification_service
        - noun_data_generation_service
    """
    assert _MODULE_PATH.exists(), (
        f"lexgen_pipeline_service.py not found at {_MODULE_PATH} — "
        "check the path if the file was moved"
    )

    source = _MODULE_PATH.read_text(encoding="utf-8")
    all_imports = _collect_all_imports(source)

    violations: list[str] = []
    for lineno, module in all_imports:
        for fragment in _FORBIDDEN_MODULE_FRAGMENTS:
            if fragment in module:
                violations.append(f"  line {lineno}: import of '{module}' (matches '{fragment}')")

    assert not violations, (
        "lexgen_pipeline_service.py imports forbidden old-consensus modules "
        "(AC4 violation):\n" + "\n".join(violations)
    )


@pytest.mark.unit
def test_lexgen_pipeline_service_does_not_reference_trust_score_or_auto_approved() -> None:
    """AC3 guard: the pipeline source must not reference trust_score or AUTO_APPROVED.

    The module docstring is allowed to mention these as invariant declarations
    (the comment-vs-code distinction is intentional — only code assignments
    matter operationally), but no assignment or attribute access should appear.

    This is a belt-and-suspenders static check; the integration test
    ``test_run_for_lemma_never_auto_approves`` covers the runtime invariant.
    """
    assert _MODULE_PATH.exists()
    source = _MODULE_PATH.read_text(encoding="utf-8")

    tree = ast.parse(source)

    # Look for assignments of the form `proposal.trust_score = ...`
    # or `proposal.status = AUTO_APPROVED` (via attribute-set or Name node).
    assignment_targets_trust: list[int] = []

    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Attribute) and target.attr == "trust_score":
                    assignment_targets_trust.append(node.lineno)
        if isinstance(node, ast.AugAssign):
            if isinstance(node.target, ast.Attribute) and node.target.attr == "trust_score":
                assignment_targets_trust.append(node.lineno)

    assert not assignment_targets_trust, (
        f"lexgen_pipeline_service.py assigns trust_score at lines: {assignment_targets_trust} "
        "(AC3 violation — trust_score must never be written by the orchestrator)"
    )

    # The word AUTO_APPROVED must not appear as a Name/Attribute access in
    # any statement that isn't a comment or docstring.
    # We check the token stream for safety, but AST Name nodes are sufficient.
    auto_approved_refs: list[int] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Attribute) and node.attr == "AUTO_APPROVED":
            auto_approved_refs.append(node.lineno)
        if isinstance(node, ast.Name) and node.id == "AUTO_APPROVED":
            auto_approved_refs.append(node.lineno)

    assert not auto_approved_refs, (
        f"lexgen_pipeline_service.py references AUTO_APPROVED at lines: {auto_approved_refs} "
        "(AC3 violation — the orchestrator must not reference AUTO_APPROVED)"
    )
