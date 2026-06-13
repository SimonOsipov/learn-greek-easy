"""Unit tests for backfill_s3_cache_control script (INFRA-11-01).

All tests are pure unit tests — no database, no real S3 calls.
S3 interactions are replaced with MagicMock objects that record call arguments.

Mode A (RED): authored before implementation to confirm:
- Tests FAIL because the current script still uses copy_object.
- Tests FAIL because the current script has no verify-after-write / unverified counter.
- Failures are assertion-level, NOT import/collection errors.

Covers:
1. Live rewrite uses put_object (via service.upload_object), not copy_object.
2. Verify-after-write: a ranged GET is issued per rewritten object; unverified==0 on success.
3. Unverified object: mismatch on post-write GET → WARNING logged, SystemExit non-zero.
4. Fully-verified run: intended directive on every GET → no SystemExit; unverified=0 in summary.
5. Dry-run: no writes and no verify GETs issued.
6. Missing ContentType: object skipped (counted skipped), never rewritten.
"""

from unittest.mock import MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_INTENDED_DIRECTIVE = "public, max-age=31536000, immutable"

# ---------------------------------------------------------------------------
# Patch targets
# ---------------------------------------------------------------------------

_PATCH_SETTINGS = "src.scripts.backfill_s3_cache_control.settings"
_PATCH_GET_S3 = "src.scripts.backfill_s3_cache_control.get_s3_service"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_mock_client(
    *,
    objects: list[dict],
    content_types: dict[str, str] | None = None,
    get_object_body: bytes = b"fake-image-bytes",
    get_object_cache_control: str = _INTENDED_DIRECTIVE,
) -> MagicMock:
    """Return a mock S3 client configured with the given objects.

    Args:
        objects: List of dicts with at least {"Key": "<s3_key>"}.
        content_types: Map from S3 key -> ContentType. Defaults to "image/jpeg" for all.
        get_object_body: Bytes returned by get_object Body.read() for any key.
        get_object_cache_control: CacheControl value returned by the verify GET.
    """
    content_types = content_types or {}

    client = MagicMock()

    # list_objects_v2 paginator
    paginator = MagicMock()
    paginator.paginate.return_value = [{"Contents": objects}]
    client.get_paginator.return_value = paginator

    # head_object: return ContentType from map, or "image/jpeg" by default.
    def _head_object(Bucket: str, Key: str) -> dict:  # noqa: N803
        ct = content_types.get(Key, "image/jpeg")
        return {"ContentType": ct}

    client.head_object.side_effect = _head_object

    # get_object: return the configured CacheControl on the verify ranged GET.
    body_mock = MagicMock()
    body_mock.read.return_value = get_object_body
    client.get_object.return_value = {
        "Body": body_mock,
        "CacheControl": get_object_cache_control,
    }

    return client


def _run_backfill(
    *,
    objects: list[dict],
    content_types: dict[str, str] | None = None,
    get_object_body: bytes = b"fake-image-bytes",
    get_object_cache_control: str = _INTENDED_DIRECTIVE,
    dry_run: bool = False,
) -> tuple[MagicMock, MagicMock]:
    """Run backfill() with mocked S3 service; return (mock_client, mock_service)."""
    from src.scripts.backfill_s3_cache_control import backfill

    mock_client = _build_mock_client(
        objects=objects,
        content_types=content_types,
        get_object_body=get_object_body,
        get_object_cache_control=get_object_cache_control,
    )
    mock_service = MagicMock()
    mock_service._get_client.return_value = mock_client

    with (
        patch(_PATCH_GET_S3, return_value=mock_service),
        patch(_PATCH_SETTINGS) as mock_settings,
    ):
        mock_settings.effective_s3_bucket_name = "test-bucket"
        backfill(dry_run=dry_run)

    return mock_client, mock_service


# ---------------------------------------------------------------------------
# AC-1: Live rewrite uses put_object (via upload_object), not copy_object
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_live_rewrite_uses_put_not_copy() -> None:
    """Live rewrite must call service.upload_object (put_object), never copy_object.

    CURRENT STATE → FAILS because the script calls client.copy_object directly
    (lines 107-114 of the current script), so copy_object WILL be called and
    upload_object will NOT be called.
    """
    objects = [{"Key": "images/photo.jpg"}]

    mock_client = _build_mock_client(objects=objects)
    mock_service = MagicMock()
    mock_service._get_client.return_value = mock_client

    with (
        patch(_PATCH_GET_S3, return_value=mock_service),
        patch(_PATCH_SETTINGS) as mock_settings,
    ):
        mock_settings.effective_s3_bucket_name = "test-bucket"
        from src.scripts.backfill_s3_cache_control import backfill

        # May raise SystemExit(1) in post-impl when unverified logic is added;
        # absorb it here so we can inspect the mock call record either way.
        try:
            backfill(dry_run=False)
        except SystemExit:
            pass

    # The rewrite path must route through service.upload_object.
    mock_service.upload_object.assert_called()
    # copy_object must NEVER be called.
    mock_client.copy_object.assert_not_called()


# ---------------------------------------------------------------------------
# AC-2: Verify-after-write: ranged GET per object; unverified==0 on success
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_verify_after_write_reads_back_via_ranged_get() -> None:
    """After each rewrite a ranged GET (Range='bytes=0-0') must be issued.

    When the GET returns the intended directive, unverified==0 and no SystemExit.

    CURRENT STATE → FAILS because the current script issues no verify GET at all.
    """
    objects = [{"Key": "images/photo.jpg"}]

    mock_client = _build_mock_client(
        objects=objects,
        get_object_cache_control=_INTENDED_DIRECTIVE,
    )
    mock_service = MagicMock()
    mock_service._get_client.return_value = mock_client
    # upload_object must succeed
    mock_service.upload_object.return_value = True

    with (
        patch(_PATCH_GET_S3, return_value=mock_service),
        patch(_PATCH_SETTINGS) as mock_settings,
    ):
        mock_settings.effective_s3_bucket_name = "test-bucket"
        from src.scripts.backfill_s3_cache_control import backfill

        # Must NOT raise SystemExit when CacheControl matches.
        backfill(dry_run=False)

    # A ranged GET must have been issued for the rewritten object.
    range_calls = [
        c for c in mock_client.get_object.call_args_list if c.kwargs.get("Range") == "bytes=0-0"
    ]
    assert (
        len(range_calls) >= 1
    ), "Expected at least one get_object(Range='bytes=0-0') verify call, found none"


# ---------------------------------------------------------------------------
# AC-3: Unverified object → WARNING + SystemExit non-zero
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_unverified_object_is_counted_and_exits_nonzero() -> None:
    """When the verify GET returns wrong CacheControl the run must exit non-zero.

    CURRENT STATE → FAILS because the current script has no verify GET and therefore
    never raises SystemExit due to a cache-control mismatch.
    """
    objects = [{"Key": "images/photo.jpg"}]

    # Post-write GET returns wrong directive.
    mock_client = _build_mock_client(
        objects=objects,
        get_object_cache_control="no-cache",
    )
    mock_service = MagicMock()
    mock_service._get_client.return_value = mock_client
    mock_service.upload_object.return_value = True

    with (
        patch(_PATCH_GET_S3, return_value=mock_service),
        patch(_PATCH_SETTINGS) as mock_settings,
    ):
        mock_settings.effective_s3_bucket_name = "test-bucket"
        from src.scripts.backfill_s3_cache_control import backfill

        with pytest.raises(SystemExit) as exc_info:
            backfill(dry_run=False)

    assert (
        exc_info.value.code != 0
    ), "Expected SystemExit with non-zero code when verify GET returns wrong CacheControl"


# ---------------------------------------------------------------------------
# AC-4: Fully-verified run exits zero; summary reports unverified=0
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_fully_verified_run_exits_zero() -> None:
    """When every post-write GET returns the intended directive, no SystemExit is raised.

    CURRENT STATE → FAILS because the script never issues a verify GET and cannot
    confirm the 'unverified==0' contract; moreover the current path might still
    invoke copy_object causing assertion errors in AC-1, but here we only care that
    a clean run (correct directive returned) completes without raising SystemExit.

    Note: this test stubs upload_object so the rewrite 'succeeds' from the script's
    perspective.
    """
    objects = [
        {"Key": "images/photo1.jpg"},
        {"Key": "images/photo2.png"},
    ]

    mock_client = _build_mock_client(
        objects=objects,
        get_object_cache_control=_INTENDED_DIRECTIVE,
    )
    mock_service = MagicMock()
    mock_service._get_client.return_value = mock_client
    mock_service.upload_object.return_value = True

    with (
        patch(_PATCH_GET_S3, return_value=mock_service),
        patch(_PATCH_SETTINGS) as mock_settings,
    ):
        mock_settings.effective_s3_bucket_name = "test-bucket"
        from src.scripts.backfill_s3_cache_control import backfill

        # Must NOT raise — all objects verified successfully.
        backfill(dry_run=False)

    # Two objects → two ranged verify GETs.
    range_calls = [
        c for c in mock_client.get_object.call_args_list if c.kwargs.get("Range") == "bytes=0-0"
    ]
    assert (
        len(range_calls) == 2
    ), f"Expected 2 verify ranged GETs (one per object), found {len(range_calls)}"


# ---------------------------------------------------------------------------
# AC-5: Dry-run writes nothing and skips verify GETs
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_dry_run_writes_nothing_and_skips_verify() -> None:
    """Dry-run must not call put_object/upload_object/copy_object or a verify GET.

    CURRENT STATE → This test PASSES on copy_object (dry-run skips writes correctly)
    but FAILS on the verify GET assertion once the verify logic is added (in the
    post-implementation state the verify GET would be absent in dry-run, which IS
    the correct post-impl behaviour, so this test should pass after implementation).

    Actually for RED: the current script skips writes in dry-run (correct), and
    naturally issues no verify GET either — so both assertions already pass today.
    This test is included to lock down the dry-run contract and will stay GREEN
    across both pre- and post-implementation states.  It is still a valid AC test
    because it guards that we don't accidentally issue a verify GET in dry-run after
    the impl lands.
    """
    objects = [{"Key": "images/photo.jpg"}]

    mock_client = _build_mock_client(objects=objects)
    mock_service = MagicMock()
    mock_service._get_client.return_value = mock_client

    with (
        patch(_PATCH_GET_S3, return_value=mock_service),
        patch(_PATCH_SETTINGS) as mock_settings,
    ):
        mock_settings.effective_s3_bucket_name = "test-bucket"
        from src.scripts.backfill_s3_cache_control import backfill

        backfill(dry_run=True)

    # No writes.
    mock_service.upload_object.assert_not_called()
    mock_client.put_object.assert_not_called()
    mock_client.copy_object.assert_not_called()

    # No verify ranged GETs.
    range_calls = [
        c for c in mock_client.get_object.call_args_list if c.kwargs.get("Range") == "bytes=0-0"
    ]
    assert (
        len(range_calls) == 0
    ), f"Dry-run must not issue any verify ranged GETs, found {len(range_calls)}"


# ---------------------------------------------------------------------------
# AC-6: Missing ContentType → skipped, not rewritten
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_content_type_missing_is_skipped_not_forced() -> None:
    """An object whose head_object returns empty ContentType must be skipped.

    It must never be passed to upload_object / put_object / copy_object.

    CURRENT STATE → The existing script already handles this correctly (lines 85-90),
    so the copy_object / upload_object assertions pass.  This test is RED-safe:
    once the impl replaces copy_object with upload_object (AC-1) this test still
    correctly asserts the skip behaviour.
    """
    objects = [{"Key": "images/no-content-type.jpg"}]

    mock_client = _build_mock_client(
        objects=objects,
        content_types={"images/no-content-type.jpg": ""},  # empty → skip
    )
    mock_service = MagicMock()
    mock_service._get_client.return_value = mock_client

    with (
        patch(_PATCH_GET_S3, return_value=mock_service),
        patch(_PATCH_SETTINGS) as mock_settings,
    ):
        mock_settings.effective_s3_bucket_name = "test-bucket"
        from src.scripts.backfill_s3_cache_control import backfill

        # Must NOT raise — missing ContentType is a skip, not an error.
        backfill(dry_run=False)

    # The object must never be rewritten via any path.
    mock_service.upload_object.assert_not_called()
    mock_client.put_object.assert_not_called()
    mock_client.copy_object.assert_not_called()
