/**
 * adminCardErrorStore Tests
 *
 * Covers:
 * - status null -> undefined (no status param forwarded to API)
 * - status "open" -> undefined (meta-filter, handled client-side per TODO CER-OOS)
 * - concrete status (e.g. FIXED) is forwarded to API as-is
 * - deleteError rejection does NOT mutate state (pessimistic, no-rollback gap documented)
 * - updateError reflects changes in both errorList + selectedError slices, triggers one refetchAdminTabCounts
 */

import { act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { useAdminCardErrorStore } from '../adminCardErrorStore';
import type { AdminCardErrorResponse } from '@/types/cardError';

// ── Mock API dependencies ──────────────────────────────────────────────────────

vi.mock('@/services/adminAPI', () => ({
  adminAPI: {
    listCardErrors: vi.fn(),
    updateCardError: vi.fn(),
    deleteCardError: vi.fn(),
  },
}));

vi.mock('@/stores/adminTabCountsStore', () => ({
  refetchAdminTabCounts: vi.fn(),
}));

// Import mocks AFTER vi.mock is hoisted
import { adminAPI } from '@/services/adminAPI';
import { refetchAdminTabCounts } from '@/stores/adminTabCountsStore';

// ── Fixture helpers ────────────────────────────────────────────────────────────

function makeError(overrides: Partial<AdminCardErrorResponse> = {}): AdminCardErrorResponse {
  return {
    id: 'err-1',
    card_id: 'card-1',
    card_type: 'WORD',
    user_id: 'user-1',
    description: 'Something is wrong',
    status: 'PENDING',
    admin_notes: null,
    resolved_by: null,
    resolved_at: null,
    reporter: { id: 'user-1', full_name: 'Alice' },
    resolver: null,
    card: null,
    deck: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

const BASE_RESPONSE = {
  items: [],
  total: 0,
  page: 1,
  page_size: 10,
};

// ── Reset helpers ──────────────────────────────────────────────────────────────

function resetStore() {
  useAdminCardErrorStore.setState({
    errorList: [],
    selectedError: null,
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
    filters: { status: null, cardType: null },
    isLoading: false,
    isUpdating: false,
    error: null,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// fetchErrorList — status param forwarding
// ══════════════════════════════════════════════════════════════════════════════

describe('adminCardErrorStore — fetchErrorList status param forwarding', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
    vi.mocked(adminAPI.listCardErrors).mockResolvedValue({ ...BASE_RESPONSE });
  });

  it('status null -> does not forward status param to API (undefined)', async () => {
    useAdminCardErrorStore.setState({ filters: { status: null, cardType: null } });

    await act(async () => {
      await useAdminCardErrorStore.getState().fetchErrorList();
    });

    expect(adminAPI.listCardErrors).toHaveBeenCalledOnce();
    const call = vi.mocked(adminAPI.listCardErrors).mock.calls[0][0];
    expect(call.status).toBeUndefined();
  });

  it('status "open" -> does not forward status param to API (undefined)', async () => {
    useAdminCardErrorStore.setState({ filters: { status: 'open', cardType: null } });

    await act(async () => {
      await useAdminCardErrorStore.getState().fetchErrorList();
    });

    expect(adminAPI.listCardErrors).toHaveBeenCalledOnce();
    const call = vi.mocked(adminAPI.listCardErrors).mock.calls[0][0];
    expect(call.status).toBeUndefined();
  });

  it('concrete status FIXED -> forwards FIXED to API', async () => {
    useAdminCardErrorStore.setState({ filters: { status: 'FIXED', cardType: null } });

    await act(async () => {
      await useAdminCardErrorStore.getState().fetchErrorList();
    });

    expect(adminAPI.listCardErrors).toHaveBeenCalledOnce();
    const call = vi.mocked(adminAPI.listCardErrors).mock.calls[0][0];
    expect(call.status).toBe('FIXED');
  });

  it('concrete status PENDING -> forwards PENDING to API', async () => {
    useAdminCardErrorStore.setState({ filters: { status: 'PENDING', cardType: null } });

    await act(async () => {
      await useAdminCardErrorStore.getState().fetchErrorList();
    });

    const call = vi.mocked(adminAPI.listCardErrors).mock.calls[0][0];
    expect(call.status).toBe('PENDING');
  });

  it('concrete status DISMISSED -> forwards DISMISSED to API', async () => {
    useAdminCardErrorStore.setState({ filters: { status: 'DISMISSED', cardType: null } });

    await act(async () => {
      await useAdminCardErrorStore.getState().fetchErrorList();
    });

    const call = vi.mocked(adminAPI.listCardErrors).mock.calls[0][0];
    expect(call.status).toBe('DISMISSED');
  });

  it('forwards cardType filter when set', async () => {
    useAdminCardErrorStore.setState({ filters: { status: null, cardType: 'CULTURE' } });

    await act(async () => {
      await useAdminCardErrorStore.getState().fetchErrorList();
    });

    const call = vi.mocked(adminAPI.listCardErrors).mock.calls[0][0];
    expect(call.card_type).toBe('CULTURE');
  });

  it('populates errorList and pagination fields on success', async () => {
    const items = [makeError({ id: 'err-a' }), makeError({ id: 'err-b' })];
    vi.mocked(adminAPI.listCardErrors).mockResolvedValue({
      items,
      total: 25,
      page: 2,
      page_size: 10,
    });
    useAdminCardErrorStore.setState({ page: 2 });

    await act(async () => {
      await useAdminCardErrorStore.getState().fetchErrorList();
    });

    const state = useAdminCardErrorStore.getState();
    expect(state.errorList).toHaveLength(2);
    expect(state.total).toBe(25);
    expect(state.totalPages).toBe(3); // Math.ceil(25/10)
    expect(state.isLoading).toBe(false);
  });

  it('sets error message and clears errorList on API failure', async () => {
    vi.mocked(adminAPI.listCardErrors).mockRejectedValue(new Error('Network error'));

    await act(async () => {
      await useAdminCardErrorStore
        .getState()
        .fetchErrorList()
        .catch(() => {});
    });

    const state = useAdminCardErrorStore.getState();
    expect(state.error).toBe('Network error');
    expect(state.errorList).toEqual([]);
    expect(state.isLoading).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// deleteError — pessimistic: no rollback on rejection
// ══════════════════════════════════════════════════════════════════════════════

describe('adminCardErrorStore — deleteError pessimistic (no-rollback gap)', () => {
  const ERR_A = makeError({ id: 'err-a' });
  const ERR_B = makeError({ id: 'err-b' });

  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
    useAdminCardErrorStore.setState({
      errorList: [ERR_A, ERR_B],
      selectedError: ERR_A,
    });
  });

  it('on success: removes the item from errorList', async () => {
    vi.mocked(adminAPI.deleteCardError).mockResolvedValue(undefined);

    await act(async () => {
      await useAdminCardErrorStore.getState().deleteError('err-a');
    });

    const { errorList } = useAdminCardErrorStore.getState();
    expect(errorList.map((e) => e.id)).toEqual(['err-b']);
  });

  it('on success: clears selectedError when it matches the deleted id', async () => {
    vi.mocked(adminAPI.deleteCardError).mockResolvedValue(undefined);

    await act(async () => {
      await useAdminCardErrorStore.getState().deleteError('err-a');
    });

    expect(useAdminCardErrorStore.getState().selectedError).toBeNull();
  });

  it('on success: preserves selectedError when it does not match the deleted id', async () => {
    vi.mocked(adminAPI.deleteCardError).mockResolvedValue(undefined);
    useAdminCardErrorStore.setState({ selectedError: ERR_B });

    await act(async () => {
      await useAdminCardErrorStore.getState().deleteError('err-a');
    });

    expect(useAdminCardErrorStore.getState().selectedError?.id).toBe('err-b');
  });

  it('on success: calls refetchAdminTabCounts once', async () => {
    vi.mocked(adminAPI.deleteCardError).mockResolvedValue(undefined);

    await act(async () => {
      await useAdminCardErrorStore.getState().deleteError('err-a');
    });

    expect(refetchAdminTabCounts).toHaveBeenCalledOnce();
  });

  /**
   * DOCUMENTED NO-ROLLBACK GAP:
   * deleteError is pessimistic — it awaits the API before mutating state.
   * If the API call rejects, state is NOT mutated (errorList stays intact).
   * There is no optimistic removal + rollback pattern here.
   * This is intentional by design (see comment in source: "Pessimistic").
   */
  it('on rejection: does NOT mutate errorList (pessimistic, no rollback needed)', async () => {
    vi.mocked(adminAPI.deleteCardError).mockRejectedValue(new Error('Delete failed'));

    await act(async () => {
      await useAdminCardErrorStore
        .getState()
        .deleteError('err-a')
        .catch(() => {});
    });

    // State is unchanged — the item is still there because state was never touched
    const { errorList } = useAdminCardErrorStore.getState();
    expect(errorList.map((e) => e.id)).toEqual(['err-a', 'err-b']);
  });

  it('on rejection: does NOT mutate selectedError', async () => {
    vi.mocked(adminAPI.deleteCardError).mockRejectedValue(new Error('Delete failed'));

    await act(async () => {
      await useAdminCardErrorStore
        .getState()
        .deleteError('err-a')
        .catch(() => {});
    });

    expect(useAdminCardErrorStore.getState().selectedError?.id).toBe('err-a');
  });

  it('on rejection: does NOT call refetchAdminTabCounts', async () => {
    vi.mocked(adminAPI.deleteCardError).mockRejectedValue(new Error('Delete failed'));

    await act(async () => {
      await useAdminCardErrorStore
        .getState()
        .deleteError('err-a')
        .catch(() => {});
    });

    expect(refetchAdminTabCounts).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// updateError — updates both slices + triggers one refetch
// ══════════════════════════════════════════════════════════════════════════════

describe('adminCardErrorStore — updateError', () => {
  const ORIGINAL = makeError({ id: 'err-1', status: 'PENDING', admin_notes: null });
  const UPDATED = makeError({ id: 'err-1', status: 'FIXED', admin_notes: 'Fixed in deck' });

  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
    useAdminCardErrorStore.setState({
      errorList: [ORIGINAL, makeError({ id: 'err-2' })],
      selectedError: ORIGINAL,
    });
  });

  it('updates the matching item in errorList', async () => {
    vi.mocked(adminAPI.updateCardError).mockResolvedValue(UPDATED);

    await act(async () => {
      await useAdminCardErrorStore.getState().updateError('err-1', { status: 'FIXED' });
    });

    const item = useAdminCardErrorStore.getState().errorList.find((e) => e.id === 'err-1');
    expect(item?.status).toBe('FIXED');
    expect(item?.admin_notes).toBe('Fixed in deck');
  });

  it('does not modify other items in errorList', async () => {
    vi.mocked(adminAPI.updateCardError).mockResolvedValue(UPDATED);

    await act(async () => {
      await useAdminCardErrorStore.getState().updateError('err-1', { status: 'FIXED' });
    });

    const other = useAdminCardErrorStore.getState().errorList.find((e) => e.id === 'err-2');
    expect(other?.status).toBe('PENDING'); // unchanged
  });

  it('updates selectedError when ids match', async () => {
    vi.mocked(adminAPI.updateCardError).mockResolvedValue(UPDATED);

    await act(async () => {
      await useAdminCardErrorStore.getState().updateError('err-1', { status: 'FIXED' });
    });

    expect(useAdminCardErrorStore.getState().selectedError?.status).toBe('FIXED');
    expect(useAdminCardErrorStore.getState().selectedError?.admin_notes).toBe('Fixed in deck');
  });

  it('does NOT update selectedError when ids differ', async () => {
    useAdminCardErrorStore.setState({
      selectedError: makeError({ id: 'err-2', status: 'PENDING' }),
    });
    vi.mocked(adminAPI.updateCardError).mockResolvedValue(UPDATED);

    await act(async () => {
      await useAdminCardErrorStore.getState().updateError('err-1', { status: 'FIXED' });
    });

    // selectedError belongs to a different item — should not be touched
    expect(useAdminCardErrorStore.getState().selectedError?.id).toBe('err-2');
    expect(useAdminCardErrorStore.getState().selectedError?.status).toBe('PENDING');
  });

  it('calls refetchAdminTabCounts exactly once', async () => {
    vi.mocked(adminAPI.updateCardError).mockResolvedValue(UPDATED);

    await act(async () => {
      await useAdminCardErrorStore.getState().updateError('err-1', { status: 'FIXED' });
    });

    expect(refetchAdminTabCounts).toHaveBeenCalledOnce();
  });

  it('clears isUpdating flag after success', async () => {
    vi.mocked(adminAPI.updateCardError).mockResolvedValue(UPDATED);

    await act(async () => {
      await useAdminCardErrorStore.getState().updateError('err-1', { status: 'FIXED' });
    });

    expect(useAdminCardErrorStore.getState().isUpdating).toBe(false);
  });

  it('returns the updated error from the API', async () => {
    vi.mocked(adminAPI.updateCardError).mockResolvedValue(UPDATED);

    let result: AdminCardErrorResponse | undefined;
    await act(async () => {
      result = await useAdminCardErrorStore.getState().updateError('err-1', { status: 'FIXED' });
    });

    expect(result?.id).toBe('err-1');
    expect(result?.status).toBe('FIXED');
  });

  it('on rejection: sets error message and clears isUpdating', async () => {
    vi.mocked(adminAPI.updateCardError).mockRejectedValue(new Error('Update failed'));

    await act(async () => {
      await useAdminCardErrorStore
        .getState()
        .updateError('err-1', { status: 'FIXED' })
        .catch(() => {});
    });

    const state = useAdminCardErrorStore.getState();
    expect(state.error).toBe('Update failed');
    expect(state.isUpdating).toBe(false);
  });

  it('on rejection: does NOT call refetchAdminTabCounts', async () => {
    vi.mocked(adminAPI.updateCardError).mockRejectedValue(new Error('Update failed'));

    await act(async () => {
      await useAdminCardErrorStore
        .getState()
        .updateError('err-1', { status: 'FIXED' })
        .catch(() => {});
    });

    expect(refetchAdminTabCounts).not.toHaveBeenCalled();
  });

  it('on rejection: does NOT mutate errorList', async () => {
    vi.mocked(adminAPI.updateCardError).mockRejectedValue(new Error('Update failed'));

    await act(async () => {
      await useAdminCardErrorStore
        .getState()
        .updateError('err-1', { status: 'FIXED' })
        .catch(() => {});
    });

    const item = useAdminCardErrorStore.getState().errorList.find((e) => e.id === 'err-1');
    expect(item?.status).toBe('PENDING'); // unchanged
  });
});
