// src/components/admin/announcements/__tests__/AnnouncementJsonView.test.tsx
//
// Mode A — RED specs for ADMIN2-43-06.
//
// Assumed prop signature the executor must implement to:
//
//   interface AnnouncementJsonViewProps {
//     title: string;
//     message: string;
//     linkUrl: string;  // camelCase, mirrors compose-drawer form values
//   }
//
// The component must render a single monospaced, readOnly shadcn <Textarea>
// whose value is JSON.stringify({ title, message, link_url }, null, 2), where:
//   - link_url is ALWAYS present in the output (snake_case)
//   - link_url is an empty string when linkUrl prop is blank (never omitted, never null)
// No Preview button; no parse/validate path.

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AnnouncementJsonView } from '../AnnouncementJsonView';

// No i18n strings needed — this component only renders a textarea value.

describe('AnnouncementJsonView', () => {
  // ── Spec 1: renders serialized payload from form values ───────────────────

  it('renders_serialized_payload_from_form_values', () => {
    render(<AnnouncementJsonView title="Hi" message="Body" linkUrl="https://x.io" />);

    const textarea = screen.getByTestId('announcement-json-view-textarea') as HTMLTextAreaElement;
    const parsed = JSON.parse(textarea.value) as Record<string, unknown>;

    expect(parsed).toStrictEqual({
      title: 'Hi',
      message: 'Body',
      link_url: 'https://x.io',
    });
  });

  // ── Spec 2: link_url serialized as empty string when blank ────────────────

  it('serializes_blank_link_url_as_empty_string', () => {
    render(<AnnouncementJsonView title="Hi" message="Body" linkUrl="" />);

    const textarea = screen.getByTestId('announcement-json-view-textarea') as HTMLTextAreaElement;
    const parsed = JSON.parse(textarea.value) as Record<string, unknown>;

    // Key must be present
    expect(Object.prototype.hasOwnProperty.call(parsed, 'link_url')).toBe(true);
    // Value must be exactly empty string — not null, not undefined, not omitted
    expect(parsed.link_url).toBe('');
  });

  // ── Spec 3: textarea is readOnly and no Preview/validate button ───────────

  it('textarea_is_read_only', () => {
    render(<AnnouncementJsonView title="Hi" message="Body" linkUrl="" />);

    const textarea = screen.getByTestId('announcement-json-view-textarea');

    // Must have the readOnly attribute
    expect(textarea).toHaveAttribute('readonly');

    // Must NOT have any Preview or validate button
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  // ── Spec 4: reflects live title edits on re-render ────────────────────────

  it('reflects_live_title_edits', () => {
    const { rerender } = render(
      <AnnouncementJsonView title="Original" message="Body" linkUrl="" />
    );

    // Re-render with updated title (simulating live form binding)
    rerender(<AnnouncementJsonView title="New" message="Body" linkUrl="" />);

    const textarea = screen.getByTestId('announcement-json-view-textarea') as HTMLTextAreaElement;
    const parsed = JSON.parse(textarea.value) as Record<string, unknown>;

    expect(parsed.title).toBe('New');
  });
});
