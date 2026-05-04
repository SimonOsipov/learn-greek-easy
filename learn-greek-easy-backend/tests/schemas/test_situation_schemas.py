"""Unit tests for situation-related Pydantic schemas.

Covers PictureUpdate (trio validation, empty-body, style_en independence)
and PictureNested (new scene/style field exposure, backward-compat).
"""

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from pydantic import ValidationError

from src.db.models import PictureStatus
from src.schemas.situation import PictureNested, PictureUpdate

TRIO_ERROR = "scene_en, scene_el and scene_ru must all be provided or all omitted"
EMPTY_BODY_ERROR = "At least one field must be provided for update"


# ---------------------------------------------------------------------------
# PictureUpdate — trio validation
# ---------------------------------------------------------------------------


def test_picture_update_full_trio_populated_accepted():
    model = PictureUpdate(scene_en="A", scene_el="B", scene_ru="C")
    assert model.scene_en == "A"
    assert model.scene_el == "B"
    assert model.scene_ru == "C"


def test_picture_update_full_trio_cleared_accepted():
    """All three present as empty strings — the 'clear' path."""
    model = PictureUpdate(scene_en="", scene_el="", scene_ru="")
    # str_strip_whitespace trims empty to empty; all falsy — accepted.
    assert not model.scene_en
    assert not model.scene_el
    assert not model.scene_ru


def test_picture_update_full_trio_cleared_with_null_accepted():
    """All three present as explicit None — the 'clear' path via null."""
    model = PictureUpdate(scene_en=None, scene_el=None, scene_ru=None)
    assert model.scene_en is None
    assert model.scene_el is None
    assert model.scene_ru is None


def test_picture_update_partial_trio_one_field_rejected():
    with pytest.raises(ValidationError) as exc_info:
        PictureUpdate(scene_en="Hello")
    assert TRIO_ERROR in str(exc_info.value)


def test_picture_update_partial_trio_two_fields_rejected():
    with pytest.raises(ValidationError) as exc_info:
        PictureUpdate(scene_en="Hello", scene_el="World")
    assert TRIO_ERROR in str(exc_info.value)


def test_picture_update_mixed_populated_empty_in_trio_rejected():
    """1 populated + 2 empty within the trio is also rejected."""
    with pytest.raises(ValidationError) as exc_info:
        PictureUpdate(scene_en="x", scene_el="", scene_ru="")
    assert TRIO_ERROR in str(exc_info.value)


def test_picture_update_field_length_over_1000_rejected():
    long_string = "x" * 1001
    with pytest.raises(ValidationError):
        PictureUpdate(scene_en=long_string, scene_el="valid", scene_ru="valid")


def test_picture_update_empty_body_rejected():
    with pytest.raises(ValidationError) as exc_info:
        PictureUpdate()
    assert EMPTY_BODY_ERROR in str(exc_info.value)


# ---------------------------------------------------------------------------
# PictureUpdate — style_en independence
# ---------------------------------------------------------------------------


def test_picture_update_style_en_only_accepted():
    model = PictureUpdate(style_en="dramatic")
    assert model.style_en == "dramatic"
    assert "scene_en" not in model.model_fields_set
    assert "scene_el" not in model.model_fields_set
    assert "scene_ru" not in model.model_fields_set


def test_picture_update_style_en_with_full_trio_accepted():
    model = PictureUpdate(scene_en="A", scene_el="B", scene_ru="C", style_en="dramatic")
    assert model.style_en == "dramatic"
    assert model.scene_en == "A"


def test_picture_update_style_en_with_partial_trio_rejected():
    """style_en present does not exempt a partial trio from rejection."""
    with pytest.raises(ValidationError) as exc_info:
        PictureUpdate(style_en="dramatic", scene_en="Hello")
    assert TRIO_ERROR in str(exc_info.value)


# ---------------------------------------------------------------------------
# PictureUpdate — model_fields_set
# ---------------------------------------------------------------------------


def test_picture_update_omitted_fields_not_in_fields_set():
    model = PictureUpdate(style_en="x")
    assert model.model_fields_set == {"style_en"}


# ---------------------------------------------------------------------------
# PictureNested — new field exposure + backward compatibility
# ---------------------------------------------------------------------------


def test_picture_nested_exposes_scene_and_style_columns():
    picture_id = uuid4()
    now = datetime.now(tz=timezone.utc)

    # Full construction including new fields.
    model = PictureNested(
        id=picture_id,
        image_prompt="a cat on a beach",
        status=PictureStatus.GENERATED,
        created_at=now,
        scene_en="Cat on beach",
        scene_el="Γάτα στην παραλία",
        scene_ru="Кот на пляже",
        style_en="photorealistic",
    )
    assert model.scene_en == "Cat on beach"
    assert model.scene_el == "Γάτα στην παραλία"
    assert model.scene_ru == "Кот на пляже"
    assert model.style_en == "photorealistic"

    # Backward-compat: construction without new fields → all default to None.
    model_legacy = PictureNested(
        id=picture_id,
        image_prompt="a cat on a beach",
        status=PictureStatus.GENERATED,
        created_at=now,
    )
    assert model_legacy.scene_en is None
    assert model_legacy.scene_el is None
    assert model_legacy.scene_ru is None
    assert model_legacy.style_en is None
