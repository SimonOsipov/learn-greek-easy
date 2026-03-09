/**
 * Mock SSE stream utilities for testing SSE consumers.
 * Lives in src/lib/ (not __tests__/) so downstream consumers can import it.
 */

export interface MockSSEEvent {
  type?: string;
  data: unknown;
  id?: string;
  delay?: number;
}

/**
 * Creates a ReadableStream that emits events in SSE text/event-stream format.
 * Used by tests to simulate an SSE response from fetch().
 */
export function createMockSSEStream(events: MockSSEEvent[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      void (async () => {
        for (const event of events) {
          if (event.delay !== undefined) {
            await new Promise<void>((resolve) => setTimeout(resolve, event.delay));
          }

          let block = '';
          if (event.id !== undefined) {
            block += `id: ${event.id}\n`;
          }
          if (event.type !== undefined) {
            block += `event: ${event.type}\n`;
          }
          const dataStr = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
          block += `data: ${dataStr}\n`;
          block += '\n'; // SSE event boundary

          controller.enqueue(new TextEncoder().encode(block));
        }
        controller.close();
      })();
    },
  });
}
