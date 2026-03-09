/**
 * adminNewsStore SSE action tests
 *
 * Tests for the updateItemAudioFromSSE action added for SSE audio integration:
 * - Updates b2 audio_url on newsItems list
 * - Updates a2 audio_a2_url on newsItems list
 * - Also updates selectedItem when ids match
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { useAdminNewsStore } from '../adminNewsStore';

describe('adminNewsStore SSE actions', () => {
  beforeEach(() => {
    useAdminNewsStore.setState({ newsItems: [], selectedItem: null });
  });

  it('updateItemAudioFromSSE updates b2 audio url', () => {
    const item = { id: 'news-1', audio_url: null, audio_a2_url: null } as any;
    useAdminNewsStore.setState({ newsItems: [item] });

    useAdminNewsStore
      .getState()
      .updateItemAudioFromSSE('news-1', 'b2', 'https://cdn/audio.mp3', null);

    const updated = useAdminNewsStore.getState().newsItems[0];
    expect(updated.audio_url).toBe('https://cdn/audio.mp3');
  });

  it('updateItemAudioFromSSE updates a2 audio url', () => {
    const item = { id: 'news-1', audio_url: null, audio_a2_url: null } as any;
    useAdminNewsStore.setState({ newsItems: [item] });

    useAdminNewsStore.getState().updateItemAudioFromSSE('news-1', 'a2', 'https://cdn/a2.mp3', null);

    const updated = useAdminNewsStore.getState().newsItems[0];
    expect(updated.audio_a2_url).toBe('https://cdn/a2.mp3');
  });

  it('updateItemAudioFromSSE also updates selectedItem', () => {
    const item = { id: 'news-1', audio_url: null, audio_a2_url: null } as any;
    useAdminNewsStore.setState({ newsItems: [item], selectedItem: { ...item } });

    useAdminNewsStore
      .getState()
      .updateItemAudioFromSSE('news-1', 'b2', 'https://cdn/audio.mp3', null);

    expect(useAdminNewsStore.getState().selectedItem?.audio_url).toBe('https://cdn/audio.mp3');
  });

  it('updateItemAudioFromSSE does not affect other items in newsItems', () => {
    const item1 = { id: 'news-1', audio_url: null, audio_a2_url: null } as any;
    const item2 = {
      id: 'news-2',
      audio_url: 'https://cdn/existing.mp3',
      audio_a2_url: null,
    } as any;
    useAdminNewsStore.setState({ newsItems: [item1, item2] });

    useAdminNewsStore
      .getState()
      .updateItemAudioFromSSE('news-1', 'b2', 'https://cdn/audio.mp3', null);

    const items = useAdminNewsStore.getState().newsItems;
    expect(items[0].audio_url).toBe('https://cdn/audio.mp3');
    expect(items[1].audio_url).toBe('https://cdn/existing.mp3');
  });

  it('updateItemAudioFromSSE does not update selectedItem when ids differ', () => {
    const item1 = { id: 'news-1', audio_url: null, audio_a2_url: null } as any;
    const item2 = { id: 'news-2', audio_url: null, audio_a2_url: null } as any;
    useAdminNewsStore.setState({ newsItems: [item1, item2], selectedItem: { ...item2 } });

    useAdminNewsStore
      .getState()
      .updateItemAudioFromSSE('news-1', 'b2', 'https://cdn/audio.mp3', null);

    // selectedItem is news-2 — should remain unchanged
    expect(useAdminNewsStore.getState().selectedItem?.audio_url).toBeNull();
  });

  it('updateItemAudioFromSSE sets audio_generated_at when provided', () => {
    const item = { id: 'news-1', audio_url: null, audio_generated_at: null } as any;
    useAdminNewsStore.setState({ newsItems: [item] });

    const generatedAt = '2026-03-09T12:00:00Z';
    useAdminNewsStore
      .getState()
      .updateItemAudioFromSSE('news-1', 'b2', 'https://cdn/audio.mp3', generatedAt);

    const updated = useAdminNewsStore.getState().newsItems[0];
    expect(updated.audio_generated_at).toBe(generatedAt);
  });

  it('updateItemAudioFromSSE sets a2 audio_generated_at when provided', () => {
    const item = { id: 'news-1', audio_a2_url: null, audio_a2_generated_at: null } as any;
    useAdminNewsStore.setState({ newsItems: [item] });

    const generatedAt = '2026-03-09T12:00:00Z';
    useAdminNewsStore
      .getState()
      .updateItemAudioFromSSE('news-1', 'a2', 'https://cdn/a2.mp3', generatedAt);

    const updated = useAdminNewsStore.getState().newsItems[0];
    expect(updated.audio_a2_generated_at).toBe(generatedAt);
  });
});
