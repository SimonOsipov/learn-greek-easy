import { describe, it, expect, vi } from 'vitest';

import type { TimelineEntryProps, TimelineTone } from '@/components/ui/timeline-entry';
import { TimelineEntry } from '@/components/ui/timeline-entry';
import { render, screen, fireEvent } from '@/lib/test-utils';

// --- 7. Type exports ---
// Satisfy TypeScript — verifies that TimelineEntryProps and TimelineTone are exported
const _typeCheck: TimelineEntryProps = {
  title: 'Hello',
  body: 'world',
};
void _typeCheck;
// TimelineTone is still exported for category-tone mapping in consumers (e.g. Badge tone).
const _toneCheck: TimelineTone = 'green';
void _toneCheck;

describe('TimelineEntry — markdown rendering', () => {
  it('renders **bold** as <b>, *italic* as <i>, and passes plain text through', () => {
    const { container } = render(
      <TimelineEntry title="T" body="Adds **bold** and *italic* and plain" />
    );

    const content = container.querySelector('.cl-entry-content')!;
    expect(content.querySelector('b')?.textContent).toBe('bold');
    expect(content.querySelector('i')?.textContent).toBe('italic');
    expect(content.textContent).toContain('plain');
  });
});

describe('TimelineEntry — XSS escape', () => {
  it('does not inject a <script> element when body contains raw HTML', () => {
    const { container } = render(<TimelineEntry title="T" body="<script>alert(1)</script> safe" />);

    const content = container.querySelector('.cl-entry-content')!;
    // No script element should exist
    expect(content.querySelector('script')).toBeNull();
    // The literal text should appear escaped
    expect(content.textContent).toContain('safe');
  });
});

describe('TimelineEntry — actions propagation stop', () => {
  it('action button click does not invoke the entry-level onClick', () => {
    const spy = vi.fn();
    render(
      <TimelineEntry
        title="T"
        body="body"
        onClick={spy}
        actions={<button data-testid="edit-btn">Edit</button>}
      />
    );

    fireEvent.click(screen.getByTestId('edit-btn'));
    expect(spy).not.toHaveBeenCalled();
  });

  it('Enter keydown on the action button does not invoke the entry-level onClick', () => {
    const spy = vi.fn();
    render(
      <TimelineEntry
        title="T"
        body="body"
        onClick={spy}
        actions={<button data-testid="edit-btn">Edit</button>}
      />
    );

    fireEvent.keyDown(screen.getByTestId('edit-btn'), { key: 'Enter' });
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('TimelineEntry — card surface', () => {
  it('renders the entry as a white .admin-card (no timeline dot)', () => {
    const { container } = render(<TimelineEntry title="T" body="body" />);

    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass('cl-entry');
    expect(root).toHaveClass('admin-card');
    // The legacy left-rail dot is gone.
    expect(container.querySelector('.cl-entry-dot')).toBeNull();
  });
});

describe('TimelineEntry — subtitle conditional', () => {
  it('does not render .cl-entry-title-ru when subtitle is omitted', () => {
    const { container } = render(<TimelineEntry title="T" body="body" />);

    expect(container.querySelector('.cl-entry-title-ru')).toBeNull();
  });

  it('renders .cl-entry-title-ru with text when subtitle is provided', () => {
    const { container } = render(<TimelineEntry title="T" subtitle="Subtitle text" body="body" />);

    const ru = container.querySelector('.cl-entry-title-ru');
    expect(ru).not.toBeNull();
    expect(ru!.textContent).toBe('Subtitle text');
  });
});

describe('TimelineEntry — interactive aria + keyboard', () => {
  it('has role="button" and tabIndex=0 when onClick is set', () => {
    const spy = vi.fn();
    const { container } = render(<TimelineEntry title="T" body="body" onClick={spy} />);

    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute('role')).toBe('button');
    expect(root.tabIndex).toBe(0);
  });

  it('fires onClick on Enter key', () => {
    const spy = vi.fn();
    const { container } = render(<TimelineEntry title="T" body="body" onClick={spy} />);

    const root = container.firstChild as HTMLElement;
    fireEvent.keyDown(root, { key: 'Enter' });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('fires onClick on Space key', () => {
    const spy = vi.fn();
    const { container } = render(<TimelineEntry title="T" body="body" onClick={spy} />);

    const root = container.firstChild as HTMLElement;
    fireEvent.keyDown(root, { key: ' ' });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not have role or tabIndex when onClick is absent', () => {
    const { container } = render(<TimelineEntry title="T" body="body" />);

    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute('role')).toBeNull();
    expect(root.getAttribute('tabindex')).toBeNull();
  });

  it('adds is-clickable class to root article when onClick is set', () => {
    const spy = vi.fn();
    const { container } = render(<TimelineEntry title="T" body="body" onClick={spy} />);

    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass('is-clickable');
  });

  it('does not add is-clickable class when onClick is absent', () => {
    const { container } = render(<TimelineEntry title="T" body="body" />);

    const root = container.firstChild as HTMLElement;
    expect(root).not.toHaveClass('is-clickable');
  });
});
