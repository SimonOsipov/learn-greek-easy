/**
 * Tests for createMockSSEStream utility.
 */

import { describe, expect, it } from 'vitest';

import { createMockSSEStream } from '../sseTestUtils';

async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  return result;
}

describe('createMockSSEStream', () => {
  it('formats SSE events correctly', async () => {
    const stream = createMockSSEStream([{ type: 'update', data: { count: 1 }, id: '42' }]);
    const text = await readStream(stream);
    expect(text).toContain('event: update\n');
    expect(text).toContain('data:');
    expect(text).toContain('id: 42\n');
    expect(text).toContain('\n\n'); // event boundary
  });

  it('delivers events in order', async () => {
    const stream = createMockSSEStream([{ data: 'first' }, { data: 'second' }, { data: 'third' }]);
    const text = await readStream(stream);
    const firstPos = text.indexOf('first');
    const secondPos = text.indexOf('second');
    const thirdPos = text.indexOf('third');
    expect(firstPos).toBeLessThan(secondPos);
    expect(secondPos).toBeLessThan(thirdPos);
  });
});
