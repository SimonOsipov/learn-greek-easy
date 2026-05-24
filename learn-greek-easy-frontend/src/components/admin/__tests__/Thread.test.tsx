import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Thread } from '../Thread';

const FIXED_DATE = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago

describe('Thread', () => {
  it('compact single-message renders name, timestamp and body', () => {
    render(
      <Thread compact>
        <Thread.Message
          author={{ name: 'Maria Papadopoulos', avatarUrl: 'https://example.com/avatar.jpg' }}
          timestamp={FIXED_DATE}
        >
          Something went wrong with the audio.
        </Thread.Message>
      </Thread>
    );

    // Author name rendered
    expect(screen.getByText('Maria Papadopoulos')).toBeInTheDocument();
    // Relative timestamp rendered (matches "Xh ago" or "just now")
    expect(screen.getByText(/ago|just now/)).toBeInTheDocument();
    // Body text rendered
    expect(screen.getByText('Something went wrong with the audio.')).toBeInTheDocument();
    // Avatar wrapper renders (even if img falls back in jsdom)
    const { container } = render(
      <Thread compact>
        <Thread.Message
          author={{ name: 'A B', avatarUrl: 'https://x.com/a.jpg' }}
          timestamp={FIXED_DATE}
        >
          body
        </Thread.Message>
      </Thread>
    );
    expect(container.querySelector('[class*="admin-thread-msg"]')).toBeTruthy();
  });

  it('multi-message renders N messages in DOM order', () => {
    render(
      <Thread>
        <Thread.Message author={{ name: 'Alice' }} timestamp={FIXED_DATE}>
          First message
        </Thread.Message>
        <Thread.Message author={{ name: 'Bob' }} timestamp={FIXED_DATE}>
          Second message
        </Thread.Message>
      </Thread>
    );

    const msgs = screen
      .getAllByRole('generic')
      .filter((el) => el.classList.contains('admin-thread-msg'));
    expect(msgs).toHaveLength(2);
    // Verify DOM order: first message before second
    expect(msgs[0]).toHaveTextContent('First message');
    expect(msgs[1]).toHaveTextContent('Second message');
  });

  it('avatar falls back to initials when avatarUrl is absent', () => {
    render(
      <Thread compact>
        <Thread.Message author={{ name: 'Maria Papadopoulos' }} timestamp={FIXED_DATE}>
          Body
        </Thread.Message>
      </Thread>
    );

    // The AvatarFallback should render the initials "MP"
    expect(screen.getByText('MP')).toBeInTheDocument();
  });
});
