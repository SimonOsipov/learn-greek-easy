"""Unit tests for the WiktionaryMorphology model (LEXGEN-03-01).

Mode A — RED specs.  These tests lock the schema contract that the executor
must deliver:

  AC-1  pos column is Text, NOT NULL, server_default 'noun'
  AC-4  model class + forms column docstrings describe bundle-list semantics
  AC-5  pos is free-text Text (no Enum / no Literal) — matches WordProposal.pos
  AC-6  forms annotation is Mapped[list] (or Mapped[list[dict[...]]])
        NOT the current Mapped[dict]

All four tests FAIL today because:
  - AC-1 / AC-5 : no `pos` column exists yet (KeyError on column lookup)
  - AC-4        : docstrings still describe flat-key dict semantics
  - AC-6        : forms is annotated Mapped[dict], not Mapped[list]

These tests need NO database — they introspect the SQLAlchemy model in-process.
"""

import inspect

from sqlalchemy import Text

from src.db.models import WiktionaryMorphology


class TestWiktionaryMorphologyPosColumn:
    """AC-1 / AC-5 — pos column presence and type contract."""

    def test_pos_column_present_text_not_null_default_noun(self):
        """AC-1: WiktionaryMorphology must have a 'pos' column that is Text,
        NOT NULL, and carries a server_default whose text includes 'noun'.

        RED today: column does not exist → KeyError.
        GREEN after: executor adds pos mapped_column(Text, nullable=False,
        server_default=text("'noun'")) to the model.
        """
        table = WiktionaryMorphology.__table__
        # Column must exist — KeyError is the expected RED failure mode
        col = table.columns["pos"]

        # Column type
        assert isinstance(col.type, Text), f"Expected pos to be Text, got {type(col.type).__name__}"

        # NOT NULL
        assert col.nullable is False, "pos column must be NOT NULL"

        # server_default renders 'noun'
        assert (
            col.server_default is not None
        ), "pos column must have a server_default (expected \"'noun'\")"
        default_text = str(col.server_default.arg)
        assert (
            "noun" in default_text
        ), f"pos server_default must render 'noun', got {default_text!r}"

    def test_pos_is_free_text_not_enum(self):
        """AC-5: pos must be plain SQLAlchemy Text — no Enum, no Literal —
        consistent with WordProposal.pos (POS-neutral, D-POSCOL).

        RED today: column does not exist → KeyError.
        GREEN after: executor adds pos as Text (not an Enum column).
        """
        table = WiktionaryMorphology.__table__
        # Must exist first
        col = table.columns["pos"]

        # Must be Text, not Enum
        assert isinstance(
            col.type, Text
        ), f"pos must be Text (free-text, POS-neutral), got {type(col.type).__name__}"

        # Paranoia guard: must NOT be an Enum subtype masquerading as Text
        type_name = type(col.type).__name__
        assert "Enum" not in type_name, f"pos column type must not be an Enum; got {type_name!r}"


class TestWiktionaryMorphologyFormsAnnotation:
    """AC-6 — forms annotation is Mapped[list], not Mapped[dict]."""

    def test_forms_annotation_is_list_not_dict(self):
        """AC-6: The 'forms' mapped attribute must be annotated Mapped[list]
        (or Mapped[list[dict[str, Any]]]), NOT the current Mapped[dict].

        Checks both __annotations__ (if present) and the mapped column's
        mapped Python type so the assertion is robust regardless of how
        SQLAlchemy resolves the annotation at class-creation time.

        RED today: annotation is Mapped[dict].
        GREEN after: executor changes annotation to Mapped[list] (or
        Mapped[list[dict[str, Any]]]).
        """
        # Primary check: raw __annotations__ on the class itself
        annotations = WiktionaryMorphology.__annotations__
        assert (
            "forms" in annotations
        ), "WiktionaryMorphology must have a 'forms' annotation in __annotations__"

        forms_annotation = annotations["forms"]
        annotation_str = str(forms_annotation)

        # Must contain 'list', must NOT be bare 'dict'
        assert "list" in annotation_str.lower(), (
            f"forms annotation must reference 'list'; got {annotation_str!r}. "
            "Expected Mapped[list] or Mapped[list[dict[str, Any]]]."
        )
        # Ensure it is not still Mapped[dict] (bare dict, no list)
        # 'dict' is also a valid sub-type inside list[dict[...]], so we check
        # that the annotation is NOT exactly Mapped[dict] / typing.Dict.
        assert (
            annotation_str != "typing.Mapped[dict]"
        ), "forms annotation is still Mapped[dict] — must be changed to Mapped[list]"
        # Normalised check: if 'list' is absent from the annotation string, fail.
        # (e.g. 'Mapped[dict]', 'Mapped[Dict[str, str]]' all lack 'list')
        assert (
            "list" in annotation_str
        ), f"forms annotation must contain 'list'; got {annotation_str!r}"


class TestWiktionaryMorphologyDocstrings:
    """AC-4 — class + forms docstrings describe feature-bundle-list semantics."""

    def test_model_forms_docstring_states_bundle_semantics(self):
        """AC-4: Both the model class docstring and the forms column comment
        must describe the feature-bundle list semantics (not the old flat-key
        dict description).

        Specifically checks that either the class docstring or the forms
        column comment contains language indicating:
          - a list / list-of-bundles structure, AND
          - 'bundle' or 'feature' as the key organisational unit

        RED today: the class docstring says "Wiktionary noun morphological data
        (declension forms, gender, IPA, glosses)" and the forms comment says
        "Flat JSONB of declension forms: {nominative_singular: ..., ...}" —
        neither mentions bundles or feature-keyed lists.

        GREEN after: executor updates the class docstring + forms column comment
        to describe list[FormBundle] / feature-keyed bundle semantics (the data
        transform lands in 03-02; the model surface is pinned here).
        """
        # --- Class docstring ---
        class_doc = inspect.getdoc(WiktionaryMorphology) or ""
        class_doc_lower = class_doc.lower()

        # --- forms column comment ---
        forms_col = WiktionaryMorphology.__table__.columns.get("forms")
        forms_comment = (forms_col.comment or "") if forms_col is not None else ""
        forms_comment_lower = forms_comment.lower()

        # Combined text for assertion
        combined = class_doc_lower + " " + forms_comment_lower

        # Must mention bundle or feature-keyed structure
        has_bundle_semantics = "bundle" in combined or "feature" in combined
        assert has_bundle_semantics, (
            "Neither the WiktionaryMorphology class docstring nor the forms column "
            "comment describes feature-bundle-list semantics. "
            f"Class docstring: {class_doc!r}. "
            f"forms comment: {forms_comment!r}. "
            "Expected one of them to mention 'bundle' or 'feature' to reflect "
            "that forms holds a list[FormBundle] after LEXGEN-03."
        )

        # Must also mention list structure in the forms comment specifically
        # (the forms column comment should not still say "Flat JSONB ... {key: ...}")
        assert "flat" not in forms_comment_lower or "list" in forms_comment_lower, (
            f"forms column comment still describes a flat dict: {forms_comment!r}. "
            "Expected it to be updated to describe a list-of-bundles shape."
        )
