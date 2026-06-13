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


# ---------------------------------------------------------------------------
# Adversarial / edge tests (Mode B additions)
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_verify_get_clienterror_is_isolated_per_object_not_fatal() -> None:
    """When the verify ranged GET raises ClientError the error is counted and
    the loop continues to process remaining objects.

    Guards: a transient verify-GET failure must NOT abort a bucket-wide backfill
    mid-run.  The outer try/except (BotoCoreError, ClientError) in backfill()
    wraps _process_object which calls _rewrite_and_verify, so any ClientError
    from the verify GET is caught → errors += 1, loop continues.

    Setup: two objects.  The verify GET raises ClientError for the first one.
    The second object is rewritten and its verify GET succeeds.  Expected outcome:
    SystemExit(1) from errors > 0, and upload_object is called twice (both objects
    were rewritten, no early abort).
    """
    from unittest.mock import MagicMock as _MagicMock

    from botocore.exceptions import ClientError as BotoClientError

    objects = [{"Key": "images/fail-verify.jpg"}, {"Key": "images/ok.jpg"}]

    call_count = {"n": 0}
    upload_call_count = {"n": 0}

    def _head_object(Bucket: str, Key: str) -> dict:  # noqa: N803
        return {"ContentType": "image/jpeg"}

    def _get_object(**kwargs: object) -> dict:
        # Calls in order:
        #  1 = read body for fail-verify.jpg (no Range kwarg)
        #  2 = verify GET for fail-verify.jpg (Range=bytes=0-0) → raise ClientError
        #  3 = read body for ok.jpg (no Range kwarg)
        #  4 = verify GET for ok.jpg (Range=bytes=0-0) → return correct directive
        call_count["n"] += 1
        n = call_count["n"]
        if n == 2:
            raise BotoClientError(
                error_response={"Error": {"Code": "503", "Message": "Slow Down"}},
                operation_name="GetObject",
            )
        body_mock = _MagicMock()
        body_mock.read.return_value = b"bytes"
        return {"Body": body_mock, "CacheControl": _INTENDED_DIRECTIVE}

    mock_service = _MagicMock()
    mock_client = _MagicMock()
    paginator = _MagicMock()
    paginator.paginate.return_value = [{"Contents": objects}]
    mock_client.get_paginator.return_value = paginator
    mock_client.head_object.side_effect = _head_object
    mock_client.get_object.side_effect = _get_object
    mock_service._get_client.return_value = mock_client

    def _upload_object(key: str, body: bytes, content_type: str) -> bool:
        upload_call_count["n"] += 1
        return True

    mock_service.upload_object.side_effect = _upload_object

    from src.scripts.backfill_s3_cache_control import backfill

    with (
        patch(_PATCH_GET_S3, return_value=mock_service),
        patch(_PATCH_SETTINGS) as mock_settings,
    ):
        mock_settings.effective_s3_bucket_name = "test-bucket"
        with pytest.raises(SystemExit) as exc_info:
            backfill(dry_run=False)

    # Non-zero exit because errors > 0.
    assert exc_info.value.code != 0, "Expected non-zero exit when verify GET raises ClientError"

    # Both objects were attempted (no early abort after the first error).
    assert (
        upload_call_count["n"] == 2
    ), f"Expected 2 upload_object calls (one per object), got {upload_call_count['n']}"


@pytest.mark.unit
def test_upload_object_returns_false_verify_still_runs_and_run_fails() -> None:
    """When upload_object returns False (put failed silently), the verify GET
    still runs because the script does not check the return value.

    This exposes a real risk: a failed upload is not counted as an error; instead
    the verify GET decides the outcome.  If the verify GET returns a wrong
    CacheControl (simulating the object never receiving the intended header because
    the put never happened), the mismatch is counted as unverified → SystemExit(1).

    NOTE: the complementary case — upload returns False but verify GET returns the
    intended directive from a pre-existing object → false-zero exit — is NOT tested
    because the current impl cannot distinguish it.  This is a known limitation:
    upload_object return value is silently ignored (line 71 of backfill script).
    """
    objects = [{"Key": "images/photo.jpg"}]

    mock_client = _build_mock_client(
        objects=objects,
        get_object_cache_control="no-cache",  # verify GET returns wrong directive
    )
    mock_service = MagicMock()
    mock_service._get_client.return_value = mock_client
    # upload_object returns False (put silently failed).
    mock_service.upload_object.return_value = False

    from src.scripts.backfill_s3_cache_control import backfill

    with (
        patch(_PATCH_GET_S3, return_value=mock_service),
        patch(_PATCH_SETTINGS) as mock_settings,
    ):
        mock_settings.effective_s3_bucket_name = "test-bucket"
        with pytest.raises(SystemExit) as exc_info:
            backfill(dry_run=False)

    # Non-zero exit: verify mismatch counts as unverified.
    assert (
        exc_info.value.code != 0
    ), "Expected non-zero exit when upload fails and verify GET returns wrong CacheControl"

    # Verify GET was still called despite upload returning False (documents current behavior:
    # the script does not check upload_object's return value before issuing the verify GET).
    range_calls = [
        c for c in mock_client.get_object.call_args_list if c.kwargs.get("Range") == "bytes=0-0"
    ]
    assert len(range_calls) >= 1, (
        "Verify GET was expected to run even when upload_object returned False "
        "(script does not check upload return value)"
    )


@pytest.mark.unit
def test_unmapped_content_type_uses_default_cache_control_in_verify() -> None:
    """An object whose ContentType is not in CONTENT_TYPE_TO_CACHE_CONTROL
    (e.g. 'image/gif') must fall back to _DEFAULT_CACHE_CONTROL for BOTH the
    rewrite and the verify comparison.

    Guards a subtle false-unverified bug: if the verify step compared against a
    hardcoded type-specific directive instead of the same fallback the rewrite used,
    a gif object would always appear unverified even when the write succeeded.

    The verify GET returns _DEFAULT_CACHE_CONTROL ('public, max-age=31536000,
    immutable') which is exactly the rewrite target for unmapped types → no
    mismatch → no SystemExit.
    """
    from src.services.s3_service import _DEFAULT_CACHE_CONTROL, CONTENT_TYPE_TO_CACHE_CONTROL

    unmapped_ct = "image/gif"
    # Confirm gif is NOT in the explicit map (pre-condition).
    assert unmapped_ct not in CONTENT_TYPE_TO_CACHE_CONTROL, (
        f"Test pre-condition failed: {unmapped_ct!r} was added to "
        "CONTENT_TYPE_TO_CACHE_CONTROL; choose a different unmapped type"
    )
    expected_directive = _DEFAULT_CACHE_CONTROL

    objects = [{"Key": "images/animation.gif"}]

    mock_client = _build_mock_client(
        objects=objects,
        content_types={"images/animation.gif": unmapped_ct},
        # Verify GET returns the fallback directive — must not be counted as unverified.
        get_object_cache_control=expected_directive,
    )
    mock_service = MagicMock()
    mock_service._get_client.return_value = mock_client
    mock_service.upload_object.return_value = True

    from src.scripts.backfill_s3_cache_control import backfill

    with (
        patch(_PATCH_GET_S3, return_value=mock_service),
        patch(_PATCH_SETTINGS) as mock_settings,
    ):
        mock_settings.effective_s3_bucket_name = "test-bucket"
        # Must NOT raise: fallback directive matches on both sides of the comparison.
        backfill(dry_run=False)

    # Exactly one verify ranged GET was issued for the gif object.
    range_calls = [
        c for c in mock_client.get_object.call_args_list if c.kwargs.get("Range") == "bytes=0-0"
    ]
    assert (
        len(range_calls) == 1
    ), f"Expected 1 verify ranged GET for the gif object, found {len(range_calls)}"

    # upload_object was called with the gif's own content-type (not image/jpeg or similar).
    upload_calls = mock_service.upload_object.call_args_list
    assert len(upload_calls) == 1
    positional = upload_calls[0][0]  # positional args tuple
    assert positional[2] == unmapped_ct, (
        f"Expected upload_object to be called with content_type={unmapped_ct!r}, "
        f"got {positional[2]!r}"
    )


@pytest.mark.unit
def test_multiple_objects_mixed_outcomes_no_early_abort() -> None:
    """With multiple objects where one verifies and one does not, the run must
    exit non-zero (unverified > 0) AND both objects must have been rewritten
    (no early abort on the first mismatch).

    Guards: per-object isolation for the verify-mismatch path (distinct from the
    ClientError isolation tested above — this is a clean-write-but-wrong-header
    scenario for object 1, and a clean verified write for object 2).
    """
    from unittest.mock import MagicMock as _MagicMock

    objects = [
        {"Key": "images/bad-verify.jpg"},
        {"Key": "images/good-verify.jpg"},
    ]

    call_index = {"n": 0}

    def _head_object(Bucket: str, Key: str) -> dict:  # noqa: N803
        return {"ContentType": "image/jpeg"}

    def _get_object(**kwargs: object) -> dict:
        call_index["n"] += 1
        n = call_index["n"]
        body_mock = _MagicMock()
        body_mock.read.return_value = b"bytes"
        # Calls in order:
        #  1 = read body for bad-verify.jpg (no Range)
        #  2 = verify GET for bad-verify.jpg (Range) → wrong directive
        #  3 = read body for good-verify.jpg (no Range)
        #  4 = verify GET for good-verify.jpg (Range) → correct directive
        if n == 2:
            return {"Body": body_mock, "CacheControl": "no-cache"}
        return {"Body": body_mock, "CacheControl": _INTENDED_DIRECTIVE}

    mock_service = _MagicMock()
    mock_client = _MagicMock()
    paginator = _MagicMock()
    paginator.paginate.return_value = [{"Contents": objects}]
    mock_client.get_paginator.return_value = paginator
    mock_client.head_object.side_effect = _head_object
    mock_client.get_object.side_effect = _get_object
    mock_service._get_client.return_value = mock_client
    mock_service.upload_object.return_value = True

    from src.scripts.backfill_s3_cache_control import backfill

    with (
        patch(_PATCH_GET_S3, return_value=mock_service),
        patch(_PATCH_SETTINGS) as mock_settings,
    ):
        mock_settings.effective_s3_bucket_name = "test-bucket"
        with pytest.raises(SystemExit) as exc_info:
            backfill(dry_run=False)

    # Non-zero exit: one object is unverified.
    assert exc_info.value.code != 0, "Expected non-zero exit when at least one object is unverified"

    # Both objects were rewritten (no early abort on the first mismatch).
    assert mock_service.upload_object.call_count == 2, (
        f"Expected 2 upload_object calls (both objects rewritten), "
        f"got {mock_service.upload_object.call_count}"
    )

    # Two verify ranged GETs were issued (one per object).
    range_calls = [
        c for c in mock_client.get_object.call_args_list if c.kwargs.get("Range") == "bytes=0-0"
    ]
    assert (
        len(range_calls) == 2
    ), f"Expected 2 verify ranged GETs (one per object), found {len(range_calls)}"
