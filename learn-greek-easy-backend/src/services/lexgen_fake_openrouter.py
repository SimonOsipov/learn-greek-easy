"""Deterministic fake OpenRouter for LEXGEN E2E testing (LEXGEN-13-06).

This module provides :class:`FakeOpenRouter`, a duck-typed drop-in for
:class:`~src.services.openrouter_service.OpenRouterService` that is injected
only at the ``_get_openrouter()`` seam in ``lexgen_review_service.py``.

ACTIVATION
----------
The fake activates ONLY when ALL of these are true:
  1. ``settings.lexgen_e2e_fake_llm is True``  (LEXGEN_E2E_FAKE_LLM=true in env)
  2. ``not settings.is_production``              (production double-guard)

It is NEVER injected in production.  See ``lexgen_review_service._get_openrouter()``.

CALLER BRANCHES
---------------
The two LEXGEN pipeline callers are distinguished by the ``model`` keyword:

* ``generator`` calls ``complete(messages, response_format=…)`` — NO ``model=``
  parameter → ``model is None`` → GENERATOR branch.
  Returns JSON for :class:`~src.schemas.lexgen.GeneratedLexContent`
  (exactly 4 keys, ``extra="forbid"``).

* ``judge`` calls ``complete(messages, model=<slug>, …)`` — model is a slug
  string → JUDGE branch.
  Returns JSON for :class:`~src.schemas.lexgen.JudgeRubric`
  (5 int dimensions 1–5 + ``blocking_issues=[]``, ``extra="forbid"``).
  Both judge slugs receive the SAME rubric → no per-dimension delta
  → ``disagreed=False`` → no disagreement-flag overhead.

JUDGE → NEEDS_REVIEW
--------------------
Binary routing (LEXGEN-11 Decision Record §3): any valid rubric with no
blocking issues lands ``SCORED → NEEDS_REVIEW`` unconditionally in v1.

CANNED PAYLOADS (two E2E lemmas)
---------------------------------
* ``βιβλίο`` — ``gloss_en="book"`` must equal the seed packet's
  ``glosses_en="book"`` so :func:`~src.core.lexgen_verify.check_gloss_subset`
  PASSES.  ``example_greek="Βιβλίο."`` is a single token (capitalized lemma +
  period) so :func:`~src.core.lexgen_verify.check_e` (closed-vocab) PASSES and
  ``check_target_attested`` PASSES.

* ``δρόμος`` — same single-token pattern; ``gloss_en="road"`` matches packet.

spaCy caveat: ``check_target_attested`` lemmatizes the example via spaCy; for a
single bare token this almost always returns the same string.  Worst case: the
verify gate marks FLAGGED instead of GENERATING→SCORED, and the chain ends
NEEDS_REVIEW via the FLAGGED→NEEDS_REVIEW path.  Final status is still
deterministic; only ``flagged_fields`` varies.  E2E asserts STATUS + attempt
existence, NEVER an exact ``flagged_fields`` set.
"""

from __future__ import annotations

import json

from src.schemas.nlp import OpenRouterResponse

# ---------------------------------------------------------------------------
# Canned GENERATOR payloads keyed by normalized_lemma.
# ``gloss_en`` is chosen to be a verbatim substring of the seed packet's
# ``glosses_en`` so ``check_gloss_subset`` (verify:167) always PASSES.
# ``example_greek`` is the capitalized lemma + period — a single token that
# trivially passes ``check_e`` (closed-vocab) and ``check_target_attested``.
# ---------------------------------------------------------------------------

_GENERATOR_PAYLOADS: dict[str, dict] = {
    "βιβλίο": {
        "gloss_en": "book",
        "gloss_ru": "книга",
        "example_greek": "Βιβλίο.",
        "example_translation": "Book.",
    },
    "δρόμος": {
        "gloss_en": "road",
        "gloss_ru": "дорога",
        "example_greek": "Δρόμος.",
        "example_translation": "Road.",
    },
}

_FALLBACK_GENERATOR_PAYLOAD: dict = {
    "gloss_en": "placeholder",
    "gloss_ru": "заглушка",
    "example_greek": "Λέξη.",
    "example_translation": "Placeholder.",
}

# ---------------------------------------------------------------------------
# Canned JUDGE rubric — identical for all model slugs so ``_determine_disagreement``
# (judge:317) sees zero per-dimension delta and identical empty blocking sets
# → ``disagreed=False``.
# All five dimensions are 4/5 → safely within the [1,5] range enforced by
# JudgeRubric validators.
# ---------------------------------------------------------------------------

_JUDGE_RUBRIC: dict = {
    "naturalness": 4,
    "sense_fit": 4,
    "translation_faith_en": 4,
    "translation_faith_ru": 4,
    "a2_appropriateness": 4,
    "blocking_issues": [],
}


class FakeOpenRouter:
    """Deterministic test double for OpenRouterService.

    Duck-types the single method the LEXGEN pipeline calls — ``complete()``.
    No API key, no network calls, instant responses.

    This class must NOT subclass ``OpenRouterService``: that ctor calls
    ``_check_configured()`` and sets up an httpx client, both undesirable
    in a test double.
    """

    async def complete(
        self,
        messages: list[dict[str, str]],
        *,
        model: str | None = None,
        response_format: dict | None = None,
        temperature: float = 0.3,
        max_tokens: int = 2048,
        reasoning: dict | None = None,
    ) -> OpenRouterResponse:
        """Return a canned deterministic response without any network call.

        Branch logic (verified against pipeline callers):
          model is None  → generator caller → return GeneratedLexContent JSON
          model is set   → judge caller     → return JudgeRubric JSON
        """
        if model is None:
            payload = self._generator_payload(messages)
        else:
            payload = _JUDGE_RUBRIC

        return OpenRouterResponse(
            content=json.dumps(payload),
            model=model or "fake/generator",
            usage=None,
            latency_ms=0.0,
        )

    def _generator_payload(self, messages: list[dict[str, str]]) -> dict:
        """Return the canned GeneratedLexContent dict for the lemma in messages.

        The generator user-message starts with ``Lemma: <normalized_lemma>``
        (lexgen_generator_service._build_messages:81).  Parse the first
        ``Lemma:`` line to key into the canned map; fall back to a valid
        placeholder on an unknown lemma.
        """
        lemma: str | None = None
        for msg in messages:
            content = msg.get("content", "")
            for line in content.splitlines():
                stripped = line.strip()
                if stripped.startswith("Lemma:"):
                    lemma = stripped[len("Lemma:") :].strip()
                    break
            if lemma is not None:
                break

        if lemma is not None:
            if lemma in _GENERATOR_PAYLOADS:
                return _GENERATOR_PAYLOADS[lemma]
            # Unknown lemma — build a valid single-token payload on the fly.
            capitalized = lemma.capitalize()
            return {
                "gloss_en": "placeholder",
                "gloss_ru": "заглушка",
                "example_greek": f"{capitalized}.",
                "example_translation": "Placeholder.",
            }

        return _FALLBACK_GENERATOR_PAYLOAD
