"""Local verification pipeline for LLM-generated noun data."""

from __future__ import annotations

import re
from typing import Optional

from src.core.logging import get_logger
from src.schemas.nlp import (
    CheckResult,
    FieldVerificationResult,
    GeneratedNounData,
    LocalVerificationResult,
)
from src.services.morphology_service import MorphologyService, get_morphology_service
from src.services.noun_data_generation_service import (  # noqa: WPS450 (private import by design)
    _derive_declension_group,
)
from src.services.spellcheck_service import SpellcheckService, get_spellcheck_service
from src.utils.greek_text import _strip_article  # noqa: WPS450 (private import by design)

logger = get_logger(__name__)

_PRONUNCIATION_RE = re.compile(r"^/.+/$")
_NOMINATIVE_ARTICLES = {
    "masculine": {"singular": "ο ", "plural": "οι "},
    "feminine": {"singular": "η ", "plural": "οι "},
    "neuter": {"singular": "το ", "plural": "τα "},
}
_GENITIVE_ARTICLES = {
    "masculine": {"singular": "του ", "plural": "των "},
    "feminine": {"singular": "της ", "plural": "των "},
    "neuter": {"singular": "του ", "plural": "των "},
}
_ACCUSATIVE_ARTICLES = {
    "masculine": {"singular": "τον ", "plural": "τους "},
    "feminine": {"singular": "την ", "plural": "τις "},
    "neuter": {"singular": "το ", "plural": "τα "},
}
_GENDER_MAP = {"Masc": "masculine", "Fem": "feminine", "Neut": "neuter"}
_CASE_MAP = {"nominative": "Nom", "genitive": "Gen", "accusative": "Acc", "vocative": "Voc"}
_NUMBER_MAP = {"singular": "Sing", "plural": "Plur"}

_ARTICLE_MAP = {
    "nominative": _NOMINATIVE_ARTICLES,
    "genitive": _GENITIVE_ARTICLES,
    "accusative": _ACCUSATIVE_ARTICLES,
}

_local_verification_service: Optional["LocalVerificationService"] = None


def _recompute_field_status(field: FieldVerificationResult) -> FieldVerificationResult:
    """Return a new FieldVerificationResult with status recomputed from its checks."""
    if not field.checks:
        return field.model_copy(update={"status": "skipped"})
    statuses = {c.status for c in field.checks}
    if "fail" in statuses:
        new_status = "fail"
    elif "warn" in statuses:
        new_status = "warn"
    else:
        new_status = "pass"
    return field.model_copy(update={"status": new_status})


class LocalVerificationService:
    """Validates LLM-generated noun data through spellcheck, morphology, and schema stages."""

    def __init__(
        self,
        spellcheck_service: SpellcheckService | None,
        morphology_service: MorphologyService | None,
    ) -> None:
        self._spellcheck = spellcheck_service
        self._morphology = morphology_service

    def verify(self, data: GeneratedNounData) -> LocalVerificationResult:
        """Run local verification pipeline on generated noun data."""
        fields_by_path: dict[str, FieldVerificationResult] = {}
        stages_skipped: list[str] = []

        self._run_spellcheck_stage(data, fields_by_path, stages_skipped)
        self._run_morphology_stage(data, fields_by_path, stages_skipped)
        self._run_schema_stage(data, fields_by_path)
        self._add_skipped_fields(fields_by_path)

        fields = list(fields_by_path.values())
        tier = self._compute_tier(fields)
        summary = self._build_summary(fields, tier)

        logger.info(
            "Local verification complete: %s stages_skipped=%s",
            summary,
            stages_skipped,
        )

        return LocalVerificationResult(
            fields=fields,
            tier=tier,
            stages_skipped=stages_skipped,
            summary=summary,
        )

    def _run_spellcheck_stage(  # noqa: C901
        self,
        data: GeneratedNounData,
        fields_by_path: dict[str, FieldVerificationResult],
        stages_skipped: list[str],
    ) -> None:
        if self._spellcheck is None:
            logger.warning("Spellcheck service unavailable — skipping spellcheck stage")
            stages_skipped.append("spellcheck")
            for number in ("singular", "plural"):
                for case in ("nominative", "genitive", "accusative", "vocative"):
                    path = f"cases.{number}.{case}"
                    fields_by_path[path] = FieldVerificationResult(
                        field_path=path, status="skipped", checks=[]
                    )
            fields_by_path["lemma"] = FieldVerificationResult(
                field_path="lemma", status="skipped", checks=[]
            )
            return

        cases = data.grammar_data.cases
        forms: list[tuple[str, str, str]] = [
            ("singular", "nominative", cases.singular.nominative),
            ("singular", "genitive", cases.singular.genitive),
            ("singular", "accusative", cases.singular.accusative),
            ("singular", "vocative", cases.singular.vocative),
            ("plural", "nominative", cases.plural.nominative),
            ("plural", "genitive", cases.plural.genitive),
            ("plural", "accusative", cases.plural.accusative),
            ("plural", "vocative", cases.plural.vocative),
        ]

        for number, case, form in forms:
            path = f"cases.{number}.{case}"
            try:
                bare = _strip_article(form)
                result = self._spellcheck.check(bare)
                if result.is_valid:
                    status = "pass"
                    message = None
                elif case == "vocative":
                    status = "warn"
                    message = f"'{bare}' not in dictionary (vocative may be rare)"
                else:
                    status = "fail"
                    message = f"'{bare}' not in dictionary"
            except Exception as exc:  # noqa: BLE001
                logger.warning("Spellcheck failed for %s: %s", path, exc)
                fields_by_path[path] = FieldVerificationResult(
                    field_path=path, status="skipped", checks=[]
                )
                continue

            check = CheckResult(check_name="spellcheck", status=status, message=message)
            logger.debug("Spellcheck %s: %s", path, status)
            fields_by_path[path] = FieldVerificationResult(
                field_path=path, status=status, checks=[check]
            )

        # lemma
        try:
            bare_lemma = _strip_article(data.lemma)
            result = self._spellcheck.check(bare_lemma)
            if result.is_valid:
                status = "pass"
                message = None
            else:
                status = "fail"
                message = f"'{bare_lemma}' not in dictionary"
        except Exception as exc:  # noqa: BLE001
            logger.warning("Spellcheck failed for lemma: %s", exc)
            fields_by_path["lemma"] = FieldVerificationResult(
                field_path="lemma", status="skipped", checks=[]
            )
            return

        check = CheckResult(check_name="spellcheck", status=status, message=message)
        logger.debug("Spellcheck lemma: %s", status)
        fields_by_path["lemma"] = FieldVerificationResult(
            field_path="lemma", status=status, checks=[check]
        )

    def _run_morphology_stage(  # noqa: C901
        self,
        data: GeneratedNounData,
        fields_by_path: dict[str, FieldVerificationResult],
        stages_skipped: list[str],
    ) -> None:
        if self._morphology is None:
            logger.warning("Morphology service unavailable — skipping morphology stage")
            stages_skipped.append("morphology")
            return

        cases = data.grammar_data.cases
        forms: list[tuple[str, str, str]] = [
            ("singular", "nominative", cases.singular.nominative),
            ("singular", "genitive", cases.singular.genitive),
            ("singular", "accusative", cases.singular.accusative),
            ("singular", "vocative", cases.singular.vocative),
            ("plural", "nominative", cases.plural.nominative),
            ("plural", "genitive", cases.plural.genitive),
            ("plural", "accusative", cases.plural.accusative),
            ("plural", "vocative", cases.plural.vocative),
        ]

        for number, case, form in forms:
            path = f"cases.{number}.{case}"
            bare = _strip_article(form)
            new_checks: list[CheckResult] = []

            try:
                analysis = self._morphology.analyze(bare)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Morphology failed for %s: %s", path, exc)
                for check_name in (
                    "morphology_pos",
                    "morphology_gender",
                    "morphology_lemma",
                    "morphology_case_number",
                ):
                    new_checks.append(
                        CheckResult(
                            check_name=check_name,
                            status="warn",
                            message=f"Analysis exception: {exc}",
                        )
                    )
                self._merge_morphology_checks(path, new_checks, fields_by_path)
                continue

            if not analysis.analysis_successful:
                for check_name in (
                    "morphology_pos",
                    "morphology_gender",
                    "morphology_lemma",
                    "morphology_case_number",
                ):
                    new_checks.append(
                        CheckResult(
                            check_name=check_name,
                            status="warn",
                            message="spaCy analysis unsuccessful",
                        )
                    )
                self._merge_morphology_checks(path, new_checks, fields_by_path)
                continue

            # POS check
            if analysis.pos == "NOUN":
                new_checks.append(
                    CheckResult(check_name="morphology_pos", status="warn", message=None)
                )
            else:
                new_checks.append(
                    CheckResult(
                        check_name="morphology_pos",
                        status="warn",
                        message=f"Expected NOUN, got {analysis.pos}",
                    )
                )

            # Gender check
            expected_gender = data.grammar_data.gender
            actual_gender = _GENDER_MAP.get(analysis.morph_features.get("Gender", ""), "")
            if actual_gender == expected_gender:
                new_checks.append(
                    CheckResult(check_name="morphology_gender", status="warn", message=None)
                )
            else:
                new_checks.append(
                    CheckResult(
                        check_name="morphology_gender",
                        status="warn",
                        message=f"Expected {expected_gender}, got {actual_gender or 'unknown'}",
                    )
                )

            # Lemma check
            expected_lemma = _strip_article(data.lemma)
            actual_lemma = _strip_article(analysis.lemma)
            if actual_lemma == expected_lemma:
                new_checks.append(
                    CheckResult(check_name="morphology_lemma", status="warn", message=None)
                )
            else:
                new_checks.append(
                    CheckResult(
                        check_name="morphology_lemma",
                        status="warn",
                        message=f"Expected lemma '{expected_lemma}', got '{actual_lemma}'",
                    )
                )

            # Case + Number check
            expected_case = _CASE_MAP.get(case, "")
            expected_number = _NUMBER_MAP.get(number, "")
            actual_case = analysis.morph_features.get("Case", "")
            actual_number = analysis.morph_features.get("Number", "")
            if actual_case == expected_case and actual_number == expected_number:
                new_checks.append(
                    CheckResult(check_name="morphology_case_number", status="warn", message=None)
                )
            else:
                new_checks.append(
                    CheckResult(
                        check_name="morphology_case_number",
                        status="warn",
                        message=(
                            f"Expected Case={expected_case}/Number={expected_number}, "
                            f"got Case={actual_case}/Number={actual_number}"
                        ),
                    )
                )

            logger.debug("Morphology %s: %d checks", path, len(new_checks))
            self._merge_morphology_checks(path, new_checks, fields_by_path)

    def _merge_morphology_checks(
        self,
        path: str,
        new_checks: list[CheckResult],
        fields_by_path: dict[str, FieldVerificationResult],
    ) -> None:
        if path in fields_by_path:
            existing = fields_by_path[path]
            merged = existing.model_copy(update={"checks": existing.checks + new_checks})
            fields_by_path[path] = _recompute_field_status(merged)
        else:
            field = FieldVerificationResult(field_path=path, status="warn", checks=new_checks)
            fields_by_path[path] = _recompute_field_status(field)

    def _run_schema_stage(
        self,
        data: GeneratedNounData,
        fields_by_path: dict[str, FieldVerificationResult],
    ) -> None:
        gender = data.grammar_data.gender
        cases = data.grammar_data.cases

        # Article-gender check
        article_checks: list[CheckResult] = []
        for case_name, article_dict in _ARTICLE_MAP.items():
            for number in ("singular", "plural"):
                form = getattr(getattr(cases, number), case_name)
                expected_article = article_dict[gender][number]
                if form.startswith(expected_article):
                    article_checks.append(
                        CheckResult(
                            check_name="article_gender",
                            status="pass",
                            message=None,
                        )
                    )
                else:
                    article_checks.append(
                        CheckResult(
                            check_name="article_gender",
                            status="fail",
                            message=(
                                f"{case_name}.{number}: expected '{expected_article}' prefix, "
                                f"got '{form[:10]}'"
                            ),
                        )
                    )

        gender_statuses = {c.status for c in article_checks}
        gender_status: str
        if "fail" in gender_statuses:
            gender_status = "fail"
        elif "warn" in gender_statuses:
            gender_status = "warn"
        else:
            gender_status = "pass"

        fields_by_path["grammar_data.gender"] = FieldVerificationResult(
            field_path="grammar_data.gender",
            status=gender_status,
            checks=article_checks,
        )
        logger.debug("Schema article_gender: %s", gender_status)

        # Declension group check
        nom_sg = cases.singular.nominative
        derived = _derive_declension_group(gender, nom_sg)
        declared = data.grammar_data.declension_group
        if derived is None:
            declension_check = CheckResult(
                check_name="declension_group",
                status="fail",
                message=f"Could not derive declension group for gender={gender}, nom_sg='{nom_sg}'",
            )
            declension_status = "fail"
        elif derived == declared:
            declension_check = CheckResult(
                check_name="declension_group", status="pass", message=None
            )
            declension_status = "pass"
        else:
            declension_check = CheckResult(
                check_name="declension_group",
                status="fail",
                message=f"Expected '{derived}', declared '{declared}'",
            )
            declension_status = "fail"

        fields_by_path["grammar_data.declension_group"] = FieldVerificationResult(
            field_path="grammar_data.declension_group",
            status=declension_status,
            checks=[declension_check],
        )
        logger.debug("Schema declension_group: %s", declension_status)

        # Pronunciation format check
        if _PRONUNCIATION_RE.match(data.pronunciation):
            pronunciation_check = CheckResult(
                check_name="pronunciation_format", status="pass", message=None
            )
            pronunciation_status = "pass"
        else:
            pronunciation_check = CheckResult(
                check_name="pronunciation_format",
                status="fail",
                message=f"'{data.pronunciation}' does not match /.+/ format",
            )
            pronunciation_status = "fail"

        fields_by_path["pronunciation"] = FieldVerificationResult(
            field_path="pronunciation",
            status=pronunciation_status,
            checks=[pronunciation_check],
        )
        logger.debug("Schema pronunciation_format: %s", pronunciation_status)

    def _add_skipped_fields(self, fields_by_path: dict[str, FieldVerificationResult]) -> None:
        for path in ("translation_en", "translation_ru", "translation_en_plural", "examples"):
            fields_by_path[path] = FieldVerificationResult(
                field_path=path, status="skipped", checks=[]
            )

    def _compute_tier(self, fields: list[FieldVerificationResult]) -> str:
        fail_count = sum(1 for f in fields if f.status == "fail")
        warn_count = sum(1 for f in fields if f.status == "warn")
        if fail_count >= 3:
            return "manual_review"
        if fail_count >= 1 or warn_count > 2:
            return "quick_review"
        return "auto_approve"

    def _build_summary(self, fields: list[FieldVerificationResult], tier: str) -> str:
        pass_count = sum(1 for f in fields if f.status == "pass")
        warn_count = sum(1 for f in fields if f.status == "warn")
        fail_count = sum(1 for f in fields if f.status == "fail")
        return f"{pass_count} pass, {warn_count} warn, {fail_count} fail -> {tier}"


def get_local_verification_service() -> LocalVerificationService:
    """Return the singleton LocalVerificationService instance."""
    global _local_verification_service
    if _local_verification_service is None:
        try:
            spellcheck = get_spellcheck_service()
        except Exception:  # noqa: BLE001
            spellcheck = None
        try:
            morphology = get_morphology_service()
        except Exception:  # noqa: BLE001
            morphology = None
        _local_verification_service = LocalVerificationService(spellcheck, morphology)
    return _local_verification_service
