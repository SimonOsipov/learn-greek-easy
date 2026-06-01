"""Unit tests for backfill_image_derivatives script (PERF-11).

All tests are pure unit tests — no database, no real S3 calls.
S3 interactions are replaced with MagicMock objects that record call arguments.

Covers:
- Dry-run: plans derivative keys for every image width without writing.
- Idempotency: objects whose derivatives already exist produce no PUT calls.
- Error isolation: a single-object failure does not abort the batch.
- Derivative-key filter: keys ending in _<N>w.webp are skipped.
- Non-image filter: audio / unknown content-types are skipped.
"""

from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_client_error(code: str = "404") -> ClientError:
    """Build a minimal ClientError with the given HTTP status code string."""
    return ClientError(
        {"Error": {"Code": code, "Message": "mock error"}},
        "HeadObject",
    )


def _build_mock_client(
    *,
    objects: list[dict],
    content_types: dict[str, str] | None = None,
    existing_derivatives: set[str] | None = None,
    get_object_body: bytes = b"fake-image-bytes",
) -> MagicMock:
    """Return a mock S3 client configured with the given objects.

    Args:
        objects: List of dicts with at least {"Key": "<s3_key>"}.
        content_types: Map from S3 key -> ContentType. Defaults to image/jpeg for all.
        existing_derivatives: Set of derivative keys that "already exist" (HEAD returns 200).
        get_object_body: Bytes returned by get_object for any key.
    """
    content_types = content_types or {}
    existing_derivatives = existing_derivatives or set()
    original_keys = {o["Key"] for o in objects}

    client = MagicMock()

    # list_objects_v2 paginator
    paginator = MagicMock()
    paginator.paginate.return_value = [{"Contents": objects}]
    client.get_paginator.return_value = paginator

    def _head_object(Bucket: str, Key: str) -> dict:  # noqa: N803
        # Derivative existence check.
        if Key in existing_derivatives:
            return {"ContentType": "image/webp"}
        # Original objects return their configured content-type.
        if Key in original_keys:
            ct = content_types.get(Key, "image/jpeg")
            return {"ContentType": ct}
        # Anything else (unregistered derivative key) -> 404.
        raise _make_client_error("404")

    client.head_object.side_effect = _head_object

    body_mock = MagicMock()
    body_mock.read.return_value = get_object_body
    client.get_object.return_value = {"Body": body_mock}

    return client


# ---------------------------------------------------------------------------
# Patch targets
# ---------------------------------------------------------------------------

_PATCH_SETTINGS = "src.scripts.backfill_image_derivatives.settings"
_PATCH_GET_S3 = "src.scripts.backfill_image_derivatives.get_s3_service"


def _run_backfill(
    *,
    objects: list[dict],
    content_types: dict[str, str] | None = None,
    existing_derivatives: set[str] | None = None,
    dry_run: bool = False,
    generate_returns: list[str] | None = None,
) -> tuple[MagicMock, MagicMock]:
    """Run backfill() with mocked S3 service; return (mock_client, mock_service)."""
    from src.scripts.backfill_image_derivatives import backfill

    mock_client = _build_mock_client(
        objects=objects,
        content_types=content_types,
        existing_derivatives=existing_derivatives,
    )
    mock_service = MagicMock()
    mock_service._get_client.return_value = mock_client
    mock_service.generate_image_derivatives.return_value = (
        generate_returns if generate_returns is not None else []
    )

    with (
        patch(_PATCH_GET_S3, return_value=mock_service),
        patch(_PATCH_SETTINGS) as mock_settings,
    ):
        mock_settings.effective_s3_bucket_name = "test-bucket"
        backfill(dry_run=dry_run)

    return mock_client, mock_service


# ---------------------------------------------------------------------------
# Dry-run tests
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestDryRun:
    def test_dry_run_produces_no_get_object_calls(self) -> None:
        """Dry-run must not download any object bodies."""
        objects = [{"Key": "images/photo.jpg"}]
        mock_client, _ = _run_backfill(objects=objects, dry_run=True)
        mock_client.get_object.assert_not_called()

    def test_dry_run_produces_no_generate_calls(self) -> None:
        """Dry-run must not call generate_image_derivatives."""
        objects = [{"Key": "images/photo.jpg"}]
        _, mock_service = _run_backfill(objects=objects, dry_run=True)
        mock_service.generate_image_derivatives.assert_not_called()

    def test_dry_run_checks_content_type_and_derivative_existence(self) -> None:
        """In dry-run, head_object is called for the original (content-type check)
        AND for each derivative key (existence check), matching live-path logic.
        DERIVATIVE_WIDTHS has the expected members (key scheme contract).
        """
        from src.services.s3_service import DERIVATIVE_WIDTHS

        objects = [
            {"Key": "images/photo1.jpg"},
            {"Key": "images/photo2.png"},
        ]
        mock_client, mock_service = _run_backfill(objects=objects, dry_run=True)

        # HEAD calls: 1 per original (content-type) + N per original (derivative existence).
        expected_calls = len(objects) * (1 + len(DERIVATIVE_WIDTHS))
        head_calls = mock_client.head_object.call_args_list
        assert (
            len(head_calls) == expected_calls
        ), f"Expected {expected_calls} head_object calls, got {len(head_calls)}"
        mock_service.generate_image_derivatives.assert_not_called()
        # Key scheme contract: widths must be exactly {400, 800, 1600}
        assert set(DERIVATIVE_WIDTHS) == {400, 800, 1600}

    def test_dry_run_skips_existing_derivatives_and_does_not_overcount(self) -> None:
        """Dry-run must apply the same "skip if derivative exists" check as the live
        path, so the reported count matches what live would actually generate.
        """
        from src.services.s3_service import DERIVATIVE_WIDTHS

        base_key = "images/photo.jpg"
        base_without_ext = "images/photo"
        # All derivatives already exist.
        existing = {f"{base_without_ext}_{w}w.webp" for w in DERIVATIVE_WIDTHS}

        mock_client, mock_service = _run_backfill(
            objects=[{"Key": base_key}],
            existing_derivatives=existing,
            dry_run=True,
        )
        # No generate calls (dry-run never writes).
        mock_service.generate_image_derivatives.assert_not_called()
        # No get_object calls either.
        mock_client.get_object.assert_not_called()
        # Derivative HEAD checks should have been made (to detect existing ones).
        called_keys = {c.kwargs.get("Key", "") for c in mock_client.head_object.call_args_list}
        assert any(base_without_ext in k for k in called_keys)

    def test_dry_run_skips_derivative_keys(self) -> None:
        """Keys that look like derivatives must be silently skipped in dry-run."""
        objects = [
            {"Key": "images/photo_400w.webp"},  # already a derivative
            {"Key": "images/photo.jpg"},
        ]
        mock_client, _ = _run_backfill(objects=objects, dry_run=True)
        # photo_400w.webp is itself a derivative, so it is skipped as a SOURCE:
        # no derivatives-of-derivatives (photo_400w_<width>w.webp) are ever computed.
        # (photo_400w.webp may still appear in HEAD calls as photo.jpg's derivative-
        #  existence check, which is expected after the dry-run existence-skip fix.)
        called_keys = {
            c.kwargs.get("Key", c.args[1] if len(c.args) > 1 else "")
            for c in mock_client.head_object.call_args_list
        }
        assert not any(k.startswith("images/photo_400w_") for k in called_keys)

    def test_dry_run_skips_non_image_content_type(self) -> None:
        """Audio objects must be skipped without counting as errors."""
        objects = [{"Key": "audio/track.mp3"}]
        _, mock_service = _run_backfill(
            objects=objects,
            content_types={"audio/track.mp3": "audio/mpeg"},
            dry_run=True,
        )
        mock_service.generate_image_derivatives.assert_not_called()


# ---------------------------------------------------------------------------
# Idempotency tests
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestIdempotency:
    def test_no_writes_when_all_derivatives_exist(self) -> None:
        """When every derivative already exists, generate_image_derivatives is not called."""
        from src.services.s3_service import DERIVATIVE_WIDTHS

        base_key = "images/photo.jpg"
        base_without_ext = "images/photo"
        existing = {f"{base_without_ext}_{w}w.webp" for w in DERIVATIVE_WIDTHS}

        _, mock_service = _run_backfill(
            objects=[{"Key": base_key}],
            existing_derivatives=existing,
        )
        mock_service.generate_image_derivatives.assert_not_called()

    def test_partial_derivatives_only_generates_missing(self) -> None:
        """When some derivatives exist, only the missing widths are generated."""
        from src.services.s3_service import DERIVATIVE_WIDTHS

        base_key = "images/photo.jpg"
        base_without_ext = "images/photo"
        # Pre-populate only the smallest width
        first_width = sorted(DERIVATIVE_WIDTHS)[0]
        existing = {f"{base_without_ext}_{first_width}w.webp"}
        remaining_widths = sorted(w for w in DERIVATIVE_WIDTHS if w != first_width)

        _, mock_service = _run_backfill(
            objects=[{"Key": base_key}],
            existing_derivatives=existing,
            generate_returns=[f"{base_without_ext}_{w}w.webp" for w in remaining_widths],
        )
        mock_service.generate_image_derivatives.assert_called_once()
        call_args = mock_service.generate_image_derivatives.call_args
        # widths is the third positional arg or the kwarg
        widths_arg = call_args.kwargs.get("widths") or call_args.args[2]
        assert set(widths_arg) == set(remaining_widths)

    def test_rerun_with_all_existing_does_not_call_get_object(self) -> None:
        """Second run (all derivatives present) must not download the image."""
        from src.services.s3_service import DERIVATIVE_WIDTHS

        base_key = "images/photo.jpg"
        base_without_ext = "images/photo"
        existing = {f"{base_without_ext}_{w}w.webp" for w in DERIVATIVE_WIDTHS}

        mock_client, _ = _run_backfill(
            objects=[{"Key": base_key}],
            existing_derivatives=existing,
        )
        mock_client.get_object.assert_not_called()


# ---------------------------------------------------------------------------
# Error isolation tests
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestErrorIsolation:
    def test_single_object_error_does_not_abort_batch(self) -> None:
        """A ClientError on one object must not prevent processing subsequent objects."""
        objects = [
            {"Key": "images/bad.jpg"},
            {"Key": "images/good.jpg"},
        ]

        mock_client = _build_mock_client(objects=objects)
        original_side_effect = mock_client.head_object.side_effect

        def flaky_head(Bucket: str, Key: str) -> dict:  # noqa: N803
            if Key == "images/bad.jpg":
                raise _make_client_error("500")
            return original_side_effect(Bucket=Bucket, Key=Key)

        mock_client.head_object.side_effect = flaky_head

        mock_service = MagicMock()
        mock_service._get_client.return_value = mock_client
        mock_service.generate_image_derivatives.return_value = []

        with (
            patch(_PATCH_GET_S3, return_value=mock_service),
            patch(_PATCH_SETTINGS) as mock_settings,
        ):
            mock_settings.effective_s3_bucket_name = "test-bucket"
            from src.scripts.backfill_image_derivatives import backfill

            # Should NOT raise even though one object fails; sys.exit(1) is expected
            try:
                backfill(dry_run=False)
            except SystemExit:
                pass

        # generate_image_derivatives should have been called for good.jpg
        mock_service.generate_image_derivatives.assert_called_once()

    def test_unexpected_exception_does_not_abort_batch(self) -> None:
        """A non-ClientError exception on one object still lets the batch continue."""
        objects = [
            {"Key": "images/bad.jpg"},
            {"Key": "images/good.jpg"},
        ]

        mock_client = _build_mock_client(objects=objects)
        original_side_effect = mock_client.head_object.side_effect

        def flaky_head(Bucket: str, Key: str) -> dict:  # noqa: N803
            # Raise for the original bad.jpg; for derivative keys return 404 (not found)
            if Key == "images/bad.jpg":
                raise RuntimeError("unexpected boom")
            return original_side_effect(Bucket=Bucket, Key=Key)

        mock_client.head_object.side_effect = flaky_head

        mock_service = MagicMock()
        mock_service._get_client.return_value = mock_client
        mock_service.generate_image_derivatives.return_value = []

        with (
            patch(_PATCH_GET_S3, return_value=mock_service),
            patch(_PATCH_SETTINGS) as mock_settings,
        ):
            mock_settings.effective_s3_bucket_name = "test-bucket"
            from src.scripts.backfill_image_derivatives import backfill

            try:
                backfill(dry_run=False)
            except SystemExit:
                pass

        mock_service.generate_image_derivatives.assert_called_once()


# ---------------------------------------------------------------------------
# Derivative-key filter tests
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestDerivativeKeyFilter:
    def test_derivative_keys_are_not_processed(self) -> None:
        """Keys matching _<N>w.webp suffix must be silently skipped."""
        from src.scripts.backfill_image_derivatives import _is_derivative_key

        assert _is_derivative_key("folder/img_400w.webp") is True
        assert _is_derivative_key("folder/img_800w.webp") is True
        assert _is_derivative_key("folder/img_1600w.webp") is True

    def test_original_keys_are_not_filtered(self) -> None:
        from src.scripts.backfill_image_derivatives import _is_derivative_key

        assert _is_derivative_key("folder/img.jpg") is False
        assert _is_derivative_key("folder/img.png") is False
        assert _is_derivative_key("folder/img.webp") is False  # original webp, not derivative
        assert _is_derivative_key("folder/img_cover.jpg") is False  # underscore but not pattern

    def test_backfill_skips_derivative_objects(self) -> None:
        """When bucket contains derivative objects, head_object is not called for them."""
        objects = [
            {"Key": "images/photo_400w.webp"},
            {"Key": "images/photo_800w.webp"},
        ]
        mock_client, mock_service = _run_backfill(objects=objects, dry_run=False)
        # head_object should never be called for these keys
        called_keys = {c.kwargs.get("Key", "") for c in mock_client.head_object.call_args_list}
        assert "images/photo_400w.webp" not in called_keys
        assert "images/photo_800w.webp" not in called_keys
        mock_service.generate_image_derivatives.assert_not_called()


# ---------------------------------------------------------------------------
# Non-image filter tests
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestNonImageFilter:
    def test_audio_objects_are_skipped(self) -> None:
        objects = [{"Key": "audio/clip.mp3"}]
        _, mock_service = _run_backfill(
            objects=objects,
            content_types={"audio/clip.mp3": "audio/mpeg"},
        )
        mock_service.generate_image_derivatives.assert_not_called()

    def test_unknown_content_type_is_skipped(self) -> None:
        objects = [{"Key": "data/file.bin"}]
        _, mock_service = _run_backfill(
            objects=objects,
            content_types={"data/file.bin": "application/octet-stream"},
        )
        mock_service.generate_image_derivatives.assert_not_called()

    def test_mixed_bucket_only_processes_images(self) -> None:
        """Audio object is skipped; image object is processed."""
        objects = [
            {"Key": "audio/clip.mp3"},
            {"Key": "images/photo.jpg"},
        ]
        _, mock_service = _run_backfill(
            objects=objects,
            content_types={
                "audio/clip.mp3": "audio/mpeg",
                "images/photo.jpg": "image/jpeg",
            },
            generate_returns=["images/photo_400w.webp"],
        )
        mock_service.generate_image_derivatives.assert_called_once()
        call_key = mock_service.generate_image_derivatives.call_args[0][0]
        assert call_key == "images/photo.jpg"
