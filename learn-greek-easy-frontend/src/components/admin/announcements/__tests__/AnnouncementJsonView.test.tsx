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

// ── Adversarial / edge coverage (ADMIN2-43-06 QA, test(ADMIN2-43-06)) ────────
// These tests extend beyond the 4 AC specs above to harden the serialization
// contract against edge cases not covered by the happy-path specs.

describe('AnnouncementJsonView — adversarial edge cases', () => {
  // ── Special characters in title & message are JSON-escaped correctly ───────

  it('special chars in title are JSON-escaped (double quotes, backslash)', () => {
    // A title with embedded double-quotes and backslash — both require escaping
    // in JSON. If the serialization is wrong, JSON.parse will throw.
    const title = 'Update: "New" feature \\ released';
    render(<AnnouncementJsonView title={title} message="OK" linkUrl="" />);

    const textarea = screen.getByTestId('announcement-json-view-textarea') as HTMLTextAreaElement;
    // Must not throw — means the output is valid JSON
    const parsed = JSON.parse(textarea.value) as Record<string, unknown>;
    expect(parsed.title).toBe(title);
  });

  it('special chars in message are JSON-escaped (double quotes, angle brackets)', () => {
    const message = 'Hello <World> & "friends" — enjoy!';
    render(<AnnouncementJsonView title="Hi" message={message} linkUrl="" />);

    const textarea = screen.getByTestId('announcement-json-view-textarea') as HTMLTextAreaElement;
    const parsed = JSON.parse(textarea.value) as Record<string, unknown>;
    expect(parsed.message).toBe(message);
  });

  it('special chars in linkUrl are JSON-escaped (query params with & and =)', () => {
    const url = 'https://greeklish.eu/promo?ref=admin&utm_campaign="test"&redirect=%2Fhome';
    render(<AnnouncementJsonView title="Hi" message="Body" linkUrl={url} />);

    const textarea = screen.getByTestId('announcement-json-view-textarea') as HTMLTextAreaElement;
    const parsed = JSON.parse(textarea.value) as Record<string, unknown>;
    expect(parsed.link_url).toBe(url);
  });

  // ── Newlines in message are preserved (JSON \n escaping) ──────────────────

  it('newlines in message are preserved in the serialized output', () => {
    const message = 'Line 1\nLine 2\nLine 3';
    render(<AnnouncementJsonView title="Hi" message={message} linkUrl="" />);

    const textarea = screen.getByTestId('announcement-json-view-textarea') as HTMLTextAreaElement;
    const parsed = JSON.parse(textarea.value) as Record<string, unknown>;
    expect(parsed.message).toBe(message);
    // Confirm the raw JSON output contains the \n escape sequence
    expect(textarea.value).toContain('\\n');
  });

  // ── Very long values don't break serialization ─────────────────────────────

  it('a 500-char message serializes without truncation', () => {
    const message = 'M'.repeat(500);
    render(<AnnouncementJsonView title="Hi" message={message} linkUrl="" />);

    const textarea = screen.getByTestId('announcement-json-view-textarea') as HTMLTextAreaElement;
    const parsed = JSON.parse(textarea.value) as Record<string, unknown>;
    expect(typeof parsed.message).toBe('string');
    expect((parsed.message as string).length).toBe(500);
  });

  it('a 100-char title serializes without truncation', () => {
    const title = 'T'.repeat(100);
    render(<AnnouncementJsonView title={title} message="Body" linkUrl="" />);

    const textarea = screen.getByTestId('announcement-json-view-textarea') as HTMLTextAreaElement;
    const parsed = JSON.parse(textarea.value) as Record<string, unknown>;
    expect((parsed.title as string).length).toBe(100);
  });

  // ── Payload shape: exactly 3 keys in the correct order ────────────────────

  it('payload has exactly 3 keys: title, message, link_url (no extras)', () => {
    render(<AnnouncementJsonView title="Hi" message="Body" linkUrl="https://x.io" />);

    const textarea = screen.getByTestId('announcement-json-view-textarea') as HTMLTextAreaElement;
    const parsed = JSON.parse(textarea.value) as Record<string, unknown>;
    expect(Object.keys(parsed)).toStrictEqual(['title', 'message', 'link_url']);
  });

  it('link_url is never null — even when linkUrl prop is empty string', () => {
    render(<AnnouncementJsonView title="Hi" message="Body" linkUrl="" />);

    const textarea = screen.getByTestId('announcement-json-view-textarea') as HTMLTextAreaElement;
    const parsed = JSON.parse(textarea.value) as Record<string, unknown>;
    // prototype.jsx:108 convention: link_url is always present, never null
    expect(parsed.link_url).not.toBeNull();
    expect(parsed.link_url).not.toBeUndefined();
    expect(parsed.link_url).toBe('');
  });

  // ── Textarea cannot be edited by the user ──────────────────────────────────

  it('the textarea element has the readOnly attribute set', () => {
    render(<AnnouncementJsonView title="Hi" message="Body" linkUrl="" />);

    const textarea = screen.getByTestId('announcement-json-view-textarea') as HTMLTextAreaElement;
    // HTMLTextAreaElement.readOnly is true when the attribute is present
    expect(textarea.readOnly).toBe(true);
  });

  // ── Unicode / emoji chars are handled correctly ───────────────────────────

  it('unicode and emoji in title/message are preserved in the JSON output', () => {
    const title = 'Γειά σου 🇬🇷'; // Greek greeting + flag
    const message = 'Learn Greek! αβγ — αβγ emoji: 😀';
    render(<AnnouncementJsonView title={title} message={message} linkUrl="" />);

    const textarea = screen.getByTestId('announcement-json-view-textarea') as HTMLTextAreaElement;
    const parsed = JSON.parse(textarea.value) as Record<string, unknown>;
    expect(parsed.title).toBe(title);
    expect(parsed.message).toBe(message);
  });

  // ── All three fields update reactively on re-render ───────────────────────

  it('all three fields update correctly when all props change simultaneously', () => {
    const { rerender } = render(
      <AnnouncementJsonView title="Old title" message="Old message" linkUrl="https://old.io" />
    );

    rerender(
      <AnnouncementJsonView title="New title" message="New message" linkUrl="https://new.io" />
    );

    const textarea = screen.getByTestId('announcement-json-view-textarea') as HTMLTextAreaElement;
    const parsed = JSON.parse(textarea.value) as Record<string, unknown>;
    expect(parsed.title).toBe('New title');
    expect(parsed.message).toBe('New message');
    expect(parsed.link_url).toBe('https://new.io');
  });
});
