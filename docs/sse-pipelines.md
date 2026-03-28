# SSE Pipeline Pattern

Admin-triggered generation tasks (audio, noun generation, dialog audio) use **SSE streaming pipelines** instead of background tasks. This document defines the canonical pattern.

## When to Use SSE vs BackgroundTasks

| Use case | Pattern |
|----------|---------|
| Admin triggers generation with progress feedback | SSE pipeline |
| Fire-and-forget side effects (XP, achievements, answer persistence) | BackgroundTasks |

**Rule:** If the admin UI needs to know when it's done or what stage it's at → use SSE. If the caller can forget about it immediately → use BackgroundTasks.

## Pipeline Function Pattern

Every SSE pipeline is an `async def` generator in `src/api/v1/admin.py` that follows this shape:

```python
async def _my_sse_pipeline(resource_id: UUID) -> AsyncGenerator[str, None]:
    from src.services.elevenlabs_service import get_elevenlabs_service  # lazy import
    from src.services.s3_service import get_s3_service

    yield format_sse_event("", event="connected")
    factory = get_session_factory()

    # Load & validate (own session)
    async with factory.begin() as session:
        obj = await session.scalar(select(MyModel).where(MyModel.id == resource_id))
        if obj is None:
            yield format_sse_event({"error": "Not found", "stage": "load"}, event="domain:error")
            return
        plain_value = obj.some_field  # extract plain Python value before session closes

    # Progress events + work (wrapped in try/except)
    current_stage = "tts"
    try:
        yield format_sse_event({"id": str(resource_id)}, event="domain:tts")
        audio_bytes = await get_elevenlabs_service().generate_speech(plain_value)

        current_stage = "upload"
        s3_key = f"prefix/{resource_id}.mp3"
        yield format_sse_event({"id": str(resource_id), "s3_key": s3_key}, event="domain:upload")
        if not get_s3_service().upload_object(s3_key, audio_bytes, "audio/mpeg"):
            raise RuntimeError("S3 upload failed")

        current_stage = "persist"
        yield format_sse_event({"id": str(resource_id)}, event="domain:persist")
        async with factory.begin() as session:
            await session.execute(update(MyModel).where(MyModel.id == resource_id).values(audio_s3_key=s3_key))

        yield format_sse_event({"id": str(resource_id), "s3_key": s3_key}, event="domain:complete")

    except Exception as exc:
        yield format_sse_event({"id": str(resource_id), "stage": current_stage, "error": str(exc)}, event="domain:error")
```

Key rules:
- **One session per DB operation** via `factory.begin()` — never reuse across stages
- **Extract plain Python values** before the session context closes
- **`try/except` wraps all stages after load** — all exceptions become `domain:error` SSE events
- **Lazy imports** for ElevenLabs and S3 services inside the function body
- **`asyncio.shield` is handled automatically** by `sse_stream()` — do not add it manually

## Endpoint Wrapper Pattern

```python
@router.post(
    "/resource/{resource_id}/generate/stream",
    summary="Generate resource via SSE stream",
    response_class=StreamingResponse,
)
async def generate_resource_stream(
    resource_id: UUID,
    sse_auth: SSEAuthResult = Depends(get_sse_auth),
) -> StreamingResponse:
    if not sse_auth.is_authenticated:
        return _sse_single_error(sse_auth.error_code or "auth_required", sse_auth.error_message or "Authentication required")
    assert sse_auth.user is not None
    if not sse_auth.user.is_superuser:
        return _sse_single_error("forbidden", "Admin access required")
    if not settings.service_configured:
        return _sse_single_error("service_unavailable", "Service is not configured")
    return create_sse_response(sse_stream(_my_sse_pipeline(resource_id), heartbeat_interval=15))
```

Key rules:
- **Auth via `get_sse_auth`** — not `get_current_superuser` (SSE token flow)
- **Pre-flight checks before pipeline** — auth, superuser, service availability
- **`create_sse_response(sse_stream(..., heartbeat_interval=15))`** — always wrap this way
- **`_sse_single_error()`** for pre-pipeline errors (returns a one-shot error stream)

## Event Naming Convention

Format: `{domain}:{stage}`

| Domain | Events |
|--------|--------|
| `news_audio` | `news_audio:start`, `news_audio:tts`, `news_audio:upload`, `news_audio:persist`, `news_audio:complete`, `news_audio:error` |
| `culture_audio` | `culture_audio:start`, `culture_audio:tts`, `culture_audio:upload`, `culture_audio:persist`, `culture_audio:complete`, `culture_audio:error` |
| `word_audio` | `word_audio:start`, `word_audio:tts`, `word_audio:upload`, `word_audio:persist`, `word_audio:complete`, `word_audio:error` |
| `dialog_audio` | `dialog_audio:start`, `dialog_audio:tts`, `dialog_audio:upload`, `dialog_audio:persist`, `dialog_audio:complete`, `dialog_audio:error` |
| `noun_generation` | `noun_generation:start`, `noun_generation:progress`, `noun_generation:complete`, `noun_generation:error` |

**Special event**: `connected` (no domain prefix) — always yielded first as handshake.

## Frontend Pattern

```typescript
// URL helper (in src/services/adminAPI.ts)
export function getMyResourceStreamUrl(id: string): string {
  return `/api/v1/admin/my-resource/${id}/generate/stream`;
}

// Component usage
const [streamEnabled, setStreamEnabled] = useState(false);

useSSE(
  item ? getMyResourceStreamUrl(item.id) : '',
  {
    method: 'POST',
    body: {},
    enabled: streamEnabled && !!item,
    maxRetries: 0,
    reconnect: false,
    onEvent: (event) => {
      switch (event.type) {
        case 'domain:complete':
          setStreamEnabled(false);
          // handle success
          break;
        case 'domain:error':
          setStreamEnabled(false);
          // handle error
          break;
      }
    },
    onError: () => {
      setStreamEnabled(false);
      // handle transport error
    },
  }
);

// Trigger generation
const handleGenerate = useCallback(() => {
  if (!item || streamEnabled) return;
  setStreamEnabled(true);
}, [item, streamEnabled]);
```

Key rules:
- **`method: 'POST'`** — SSE pipelines are triggered via POST, not GET
- **`maxRetries: 0, reconnect: false`** — never auto-retry generation
- **`enabled` flag** controls lifecycle — flip to `true` to start, set back to `false` on complete/error
- **Reset on modal close** — always set `streamEnabled(false)` in the close `useEffect`

## Examples (canonical implementations)

- **News audio (B2/A2)**: `src/api/v1/admin.py` — `_news_b2_audio_sse_pipeline`, `_news_a2_audio_sse_pipeline`
- **Culture question audio**: `src/api/v1/admin.py` — `_culture_question_audio_sse_pipeline`
- **Word entry audio**: `src/api/v1/admin.py` — `_word_audio_sse_pipeline`
- **Dialog audio**: `src/api/v1/admin.py` — `_dialog_audio_sse_pipeline`
- **Noun generation**: `src/api/v1/admin.py` — `_noun_generation_sse_pipeline`
- **Frontend (news)**: `src/components/admin/news/NewsItemEditModal.tsx`
- **Frontend (culture)**: `src/components/admin/CardEditModal.tsx`
