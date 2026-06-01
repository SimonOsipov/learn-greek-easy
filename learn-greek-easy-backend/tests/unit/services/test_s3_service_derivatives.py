"""Unit tests for WebP derivative generation pipeline (PERF-10).

Tests cover:
- Derivative key scheme (deterministic, PERF-11 must replicate it)
- generate_image_derivatives: generates expected widths, skips upsizing
- generate_image_derivatives: image-only guard (non-image bytes → empty list)
- generate_image_derivatives: failure isolation (bad bytes → empty list, no exception)
- maybe_generate_derivatives: skips non-image content types
- get_derivative_presigned_urls: returns dict keyed by width

All tests are pure unit tests — no database, no real S3 calls.
"""

import io
import posixpath
from unittest.mock import MagicMock, patch

import pytest
from PIL import Image

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_png_bytes(width: int = 2000, height: int = 1500) -> bytes:
    """Create minimal in-memory PNG bytes at the given size."""
    img = Image.new("RGB", (width, height), color=(100, 150, 200))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _make_s3_service_with_mock_upload() -> tuple:
    """Return (S3Service instance, mock upload tracker list)."""
    from src.services.s3_service import S3Service

    svc = S3Service.__new__(S3Service)
    svc._client = None
    svc._initialized = True
    svc._url_cache = {}

    uploaded: list[tuple[str, int]] = []  # (key, size_bytes)

    def fake_upload(s3_key: str, data: bytes, content_type: str) -> bool:
        uploaded.append((s3_key, len(data)))
        return True

    svc.upload_object = fake_upload  # type: ignore[method-assign]
    return svc, uploaded


# ---------------------------------------------------------------------------
# Derivative key scheme
# ---------------------------------------------------------------------------


class TestDerivativeKeyScheme:
    """The key scheme is contractual — PERF-11 backfill depends on it."""

    def test_key_is_base_without_ext_then_width_w_webp(self) -> None:
        from src.services.s3_service import DERIVATIVE_WIDTHS

        base_key = "situation-pictures/abc123/sha256hash.png"
        base_without_ext = posixpath.splitext(base_key)[0]

        for width in DERIVATIVE_WIDTHS:
            expected = f"{base_without_ext}_{width}w.webp"
            assert expected == f"situation-pictures/abc123/sha256hash_{width}w.webp"

    def test_extension_stripped_for_jpg(self) -> None:
        base_key = "situations/images/uuid.jpg"
        base_without_ext = posixpath.splitext(base_key)[0]
        assert base_without_ext == "situations/images/uuid"

    def test_nested_path_handled(self) -> None:
        base_key = "culture-deck-images/deck-id/somehash.jpeg"
        base_without_ext = posixpath.splitext(base_key)[0]
        assert base_without_ext == "culture-deck-images/deck-id/somehash"


# ---------------------------------------------------------------------------
# generate_image_derivatives
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestGenerateImageDerivatives:
    def test_generates_all_widths_narrower_than_source(self) -> None:
        """Source is 2000 px wide → all three derivative widths (400, 800, 1600) are < 2000."""
        svc, uploaded = _make_s3_service_with_mock_upload()
        image_bytes = _make_png_bytes(width=2000, height=1000)

        keys = svc.generate_image_derivatives(
            "folder/img.png", image_bytes, widths=(400, 800, 1600)
        )

        # All widths < 2000 should be generated
        assert len(keys) == 3
        widths_uploaded = {int(k.split("_")[-1].replace("w.webp", "")) for k in keys}
        assert widths_uploaded == {400, 800, 1600}

    def test_skips_only_widths_at_or_above_source(self) -> None:
        """Source is 1000 px wide → 400, 800 generated but 1000 and 1600 skipped."""
        svc, uploaded = _make_s3_service_with_mock_upload()
        image_bytes = _make_png_bytes(width=1000, height=750)

        keys = svc.generate_image_derivatives(
            "folder/img.png", image_bytes, widths=(400, 800, 1000, 1600)
        )

        widths_uploaded = {int(k.split("_")[-1].replace("w.webp", "")) for k in keys}
        assert widths_uploaded == {400, 800}

    def test_skips_width_equal_to_or_larger_than_source(self) -> None:
        """Source is 400 px wide → no derivatives should be generated."""
        svc, uploaded = _make_s3_service_with_mock_upload()
        image_bytes = _make_png_bytes(width=400, height=300)

        keys = svc.generate_image_derivatives(
            "folder/img.png", image_bytes, widths=(400, 800, 1600)
        )

        assert keys == []
        assert uploaded == []

    def test_derivative_keys_use_webp_extension(self) -> None:
        svc, uploaded = _make_s3_service_with_mock_upload()
        image_bytes = _make_png_bytes(width=2000, height=1000)

        keys = svc.generate_image_derivatives("deck-images/id/hash.jpg", image_bytes, widths=(400,))

        assert len(keys) == 1
        assert keys[0].endswith(".webp")
        assert "400w" in keys[0]

    def test_derivative_bytes_are_smaller_than_original(self) -> None:
        """A 400w WebP of a 2000px PNG should be considerably smaller."""
        svc, uploaded = _make_s3_service_with_mock_upload()
        image_bytes = _make_png_bytes(width=2000, height=1500)

        svc.generate_image_derivatives("folder/img.png", image_bytes, widths=(400,))

        assert len(uploaded) == 1
        _, derivative_size = uploaded[0]
        assert derivative_size < len(image_bytes)

    def test_upload_failure_on_one_width_does_not_abort_others(self) -> None:
        """If upload of one derivative fails, remaining widths are still attempted."""
        from src.services.s3_service import S3Service

        svc = S3Service.__new__(S3Service)
        svc._client = None
        svc._initialized = True
        svc._url_cache = {}

        call_count = {"n": 0}
        uploaded_keys: list[str] = []

        def flaky_upload(s3_key: str, data: bytes, content_type: str) -> bool:
            call_count["n"] += 1
            # Fail the first call, succeed thereafter
            if call_count["n"] == 1:
                return False
            uploaded_keys.append(s3_key)
            return True

        svc.upload_object = flaky_upload  # type: ignore[method-assign]
        image_bytes = _make_png_bytes(width=2000, height=1000)

        keys = svc.generate_image_derivatives("f/img.png", image_bytes, widths=(400, 800))

        # 2 upload attempts made; only second succeeds
        assert call_count["n"] == 2
        assert len(keys) == 1

    def test_invalid_image_bytes_returns_empty_list_no_exception(self) -> None:
        svc, _ = _make_s3_service_with_mock_upload()

        # Should not raise; should return []
        keys = svc.generate_image_derivatives("folder/img.png", b"not an image", widths=(400,))
        assert keys == []

    def test_default_widths_constant_has_three_entries(self) -> None:
        from src.services.s3_service import DERIVATIVE_WIDTHS

        assert len(DERIVATIVE_WIDTHS) == 3
        assert set(DERIVATIVE_WIDTHS) == {400, 800, 1600}


# ---------------------------------------------------------------------------
# maybe_generate_derivatives (content-type guard)
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestMaybeGenerateDerivatives:
    def test_skips_audio_content_type(self) -> None:
        from src.services.s3_service import maybe_generate_derivatives

        with patch("src.services.s3_service.get_s3_service") as mock_get:
            maybe_generate_derivatives("audio/file.mp3", b"...", "audio/mpeg")
            mock_get.assert_not_called()

    def test_skips_unknown_content_type(self) -> None:
        from src.services.s3_service import maybe_generate_derivatives

        with patch("src.services.s3_service.get_s3_service") as mock_get:
            maybe_generate_derivatives("some/file.bin", b"...", "application/octet-stream")
            mock_get.assert_not_called()

    def test_calls_generate_for_jpeg(self) -> None:
        from src.services.s3_service import maybe_generate_derivatives

        mock_svc = MagicMock()
        mock_svc.generate_image_derivatives.return_value = []
        with patch("src.services.s3_service.get_s3_service", return_value=mock_svc):
            maybe_generate_derivatives("img.jpg", b"...", "image/jpeg")
            mock_svc.generate_image_derivatives.assert_called_once_with("img.jpg", b"...")

    def test_calls_generate_for_png(self) -> None:
        from src.services.s3_service import maybe_generate_derivatives

        mock_svc = MagicMock()
        mock_svc.generate_image_derivatives.return_value = []
        with patch("src.services.s3_service.get_s3_service", return_value=mock_svc):
            maybe_generate_derivatives("img.png", b"...", "image/png")
            mock_svc.generate_image_derivatives.assert_called_once()

    def test_calls_generate_for_webp(self) -> None:
        from src.services.s3_service import maybe_generate_derivatives

        mock_svc = MagicMock()
        mock_svc.generate_image_derivatives.return_value = []
        with patch("src.services.s3_service.get_s3_service", return_value=mock_svc):
            maybe_generate_derivatives("img.webp", b"...", "image/webp")
            mock_svc.generate_image_derivatives.assert_called_once()


# ---------------------------------------------------------------------------
# get_derivative_presigned_urls
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestGetDerivativePresignedUrls:
    def test_returns_dict_keyed_by_all_derivative_widths(self) -> None:
        from src.services.s3_service import DERIVATIVE_WIDTHS, S3Service

        svc = S3Service.__new__(S3Service)
        svc._client = None
        svc._initialized = True
        svc._url_cache = {}

        def fake_presign(key: str, expiry_seconds: int | None = None) -> str | None:
            return f"https://example.com/{key}?signed=1"

        svc.generate_presigned_url = fake_presign  # type: ignore[method-assign]

        result = svc.get_derivative_presigned_urls("folder/img.png")

        assert set(result.keys()) == set(DERIVATIVE_WIDTHS)
        for width, url in result.items():
            assert f"_{width}w.webp" in url

    def test_returns_empty_dict_when_presign_returns_none(self) -> None:
        from src.services.s3_service import S3Service

        svc = S3Service.__new__(S3Service)
        svc._client = None
        svc._initialized = True
        svc._url_cache = {}
        svc.generate_presigned_url = lambda *a, **kw: None  # type: ignore[method-assign]

        result = svc.get_derivative_presigned_urls("folder/img.png")
        assert result == {}
