// src/components/admin/announcements/__tests__/AnnouncementJsonInput.test.tsx

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AnnouncementJsonInput } from '../AnnouncementJsonInput';

// Mock i18n — keys mirror the actual en/admin.json translations
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'announcements.create.jsonHint':
          'Paste a JSON object with title, message, and optional link_url.',
        'announcements.create.jsonPlaceholder':
          '{\n  "title": "Your announcement title",\n  "message": "Your announcement message",\n  "link_url": "https://example.com (optional)"\n}',
        'announcements.create.preview': 'Preview',
        'announcements.create.jsonInvalidJson': 'Invalid JSON. Please check your syntax.',
        'announcements.create.jsonTitleRequired': 'Title is required.',
        'announcements.create.jsonTitleTooLong': 'Title must be 100 characters or less.',
        'announcements.create.jsonMessageRequired': 'Message is required.',
        'announcements.create.jsonMessageTooLong': 'Message must be 500 characters or less.',
        'announcements.create.jsonInvalidUrl': 'Link URL must be a valid URL.',
        'announcements.create.jsonUrlTooLong': 'Link URL must be 500 characters or less.',
      };
      return translations[key] || key;
    },
  }),
}));

describe('AnnouncementJsonInput', () => {
  const mockOnPreview = vi.fn();
  const mockOnDirtyChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------- Rendering ----------

  it('renders textarea with hint text and preview button', () => {
    render(<AnnouncementJsonInput onPreview={mockOnPreview} />);

    expect(screen.getByTestId('announcement-json-textarea')).toBeInTheDocument();
    expect(screen.getByTestId('announcement-json-preview-button')).toBeInTheDocument();
    expect(
      screen.getByText('Paste a JSON object with title, message, and optional link_url.')
    ).toBeInTheDocument();
  });

  it('textarea has the schema-hint placeholder', () => {
    render(<AnnouncementJsonInput onPreview={mockOnPreview} />);

    const textarea = screen.getByTestId('announcement-json-textarea');
    expect(textarea).toHaveAttribute('placeholder');
    const placeholder = textarea.getAttribute('placeholder') ?? '';
    expect(placeholder).toContain('"title"');
    expect(placeholder).toContain('"message"');
    expect(placeholder).toContain('"link_url"');
  });

  it('preview button is disabled when textarea is empty', () => {
    render(<AnnouncementJsonInput onPreview={mockOnPreview} />);

    expect(screen.getByTestId('announcement-json-preview-button')).toBeDisabled();
  });

  it('preview button is disabled when isSubmitting is true', async () => {
    const user = userEvent.setup();
    render(<AnnouncementJsonInput onPreview={mockOnPreview} isSubmitting={true} />);

    const textarea = screen.getByTestId('announcement-json-textarea');
    await user.type(textarea, '{"title":"T","message":"M"}');

    expect(screen.getByTestId('announcement-json-preview-button')).toBeDisabled();
  });

  it('textarea is disabled when isSubmitting is true', () => {
    render(<AnnouncementJsonInput onPreview={mockOnPreview} isSubmitting={true} />);

    expect(screen.getByTestId('announcement-json-textarea')).toBeDisabled();
  });

  it('does not show error on initial render', () => {
    render(<AnnouncementJsonInput onPreview={mockOnPreview} />);

    expect(screen.queryByTestId('announcement-json-error')).not.toBeInTheDocument();
  });

  // ---------- Dirty state ----------

  it('calls onDirtyChange(true) when user types into textarea', async () => {
    const user = userEvent.setup();
    render(<AnnouncementJsonInput onPreview={mockOnPreview} onDirtyChange={mockOnDirtyChange} />);

    await user.type(screen.getByTestId('announcement-json-textarea'), 'x');

    expect(mockOnDirtyChange).toHaveBeenCalledWith(true);
  });

  it('calls onDirtyChange(false) when textarea is cleared to empty', async () => {
    const user = userEvent.setup();
    render(<AnnouncementJsonInput onPreview={mockOnPreview} onDirtyChange={mockOnDirtyChange} />);

    const textarea = screen.getByTestId('announcement-json-textarea');
    await user.type(textarea, 'x');
    await user.clear(textarea);

    expect(mockOnDirtyChange).toHaveBeenLastCalledWith(false);
  });

  // ---------- Reset via resetKey ----------

  it('clears value and error when resetKey changes', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<AnnouncementJsonInput onPreview={mockOnPreview} resetKey={0} />);

    // Type invalid JSON to trigger an error
    const textarea = screen.getByTestId('announcement-json-textarea');
    await user.type(textarea, 'not json');
    await user.click(screen.getByTestId('announcement-json-preview-button'));

    expect(await screen.findByTestId('announcement-json-error')).toBeInTheDocument();
    expect(textarea).toHaveValue('not json');

    // Change resetKey to simulate mode switch / form reset
    rerender(<AnnouncementJsonInput onPreview={mockOnPreview} resetKey={1} />);

    await waitFor(() => {
      expect(screen.queryByTestId('announcement-json-error')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('announcement-json-textarea')).toHaveValue('');
  });

  // ---------- JSON validation errors ----------

  it('shows invalid JSON error for malformed input', async () => {
    const user = userEvent.setup();
    render(<AnnouncementJsonInput onPreview={mockOnPreview} />);

    await user.type(screen.getByTestId('announcement-json-textarea'), 'not json at all');
    await user.click(screen.getByTestId('announcement-json-preview-button'));

    expect(await screen.findByTestId('announcement-json-error')).toHaveTextContent(
      'Invalid JSON. Please check your syntax.'
    );
    expect(mockOnPreview).not.toHaveBeenCalled();
  });

  it('shows error for JSON array (not an object) — title required since array has no .title', async () => {
    const user = userEvent.setup();
    render(<AnnouncementJsonInput onPreview={mockOnPreview} />);

    // Arrays parse as valid JSON but have no .title field, so validation
    // falls through to "title required" (typeof arr.title === 'undefined' → title = '')
    fireEvent.change(screen.getByTestId('announcement-json-textarea'), {
      target: { value: '[1,2,3]' },
    });
    await user.click(screen.getByTestId('announcement-json-preview-button'));

    expect(await screen.findByTestId('announcement-json-error')).toHaveTextContent(
      'Title is required.'
    );
    expect(mockOnPreview).not.toHaveBeenCalled();
  });

  it('shows title required error when title field is missing', async () => {
    const user = userEvent.setup();
    render(<AnnouncementJsonInput onPreview={mockOnPreview} />);

    fireEvent.change(screen.getByTestId('announcement-json-textarea'), {
      target: { value: '{"message":"Hello world"}' },
    });
    await user.click(screen.getByTestId('announcement-json-preview-button'));

    expect(await screen.findByTestId('announcement-json-error')).toHaveTextContent(
      'Title is required.'
    );
    expect(mockOnPreview).not.toHaveBeenCalled();
  });

  it('shows title required error when title is empty string', async () => {
    const user = userEvent.setup();
    render(<AnnouncementJsonInput onPreview={mockOnPreview} />);

    fireEvent.change(screen.getByTestId('announcement-json-textarea'), {
      target: { value: '{"title":"","message":"Hello"}' },
    });
    await user.click(screen.getByTestId('announcement-json-preview-button'));

    expect(await screen.findByTestId('announcement-json-error')).toHaveTextContent(
      'Title is required.'
    );
    expect(mockOnPreview).not.toHaveBeenCalled();
  });

  it('shows title too long error when title exceeds 100 characters', async () => {
    const user = userEvent.setup();
    render(<AnnouncementJsonInput onPreview={mockOnPreview} />);

    const longTitle = 'a'.repeat(101);
    const json = JSON.stringify({ title: longTitle, message: 'Hello world' });
    fireEvent.change(screen.getByTestId('announcement-json-textarea'), {
      target: { value: json },
    });
    await user.click(screen.getByTestId('announcement-json-preview-button'));

    expect(await screen.findByTestId('announcement-json-error')).toHaveTextContent(
      'Title must be 100 characters or less.'
    );
    expect(mockOnPreview).not.toHaveBeenCalled();
  });

  it('shows message required error when message field is missing', async () => {
    const user = userEvent.setup();
    render(<AnnouncementJsonInput onPreview={mockOnPreview} />);

    fireEvent.change(screen.getByTestId('announcement-json-textarea'), {
      target: { value: '{"title":"My Title"}' },
    });
    await user.click(screen.getByTestId('announcement-json-preview-button'));

    expect(await screen.findByTestId('announcement-json-error')).toHaveTextContent(
      'Message is required.'
    );
    expect(mockOnPreview).not.toHaveBeenCalled();
  });

  it('shows message required error when message is empty string', async () => {
    const user = userEvent.setup();
    render(<AnnouncementJsonInput onPreview={mockOnPreview} />);

    fireEvent.change(screen.getByTestId('announcement-json-textarea'), {
      target: { value: '{"title":"My Title","message":""}' },
    });
    await user.click(screen.getByTestId('announcement-json-preview-button'));

    expect(await screen.findByTestId('announcement-json-error')).toHaveTextContent(
      'Message is required.'
    );
    expect(mockOnPreview).not.toHaveBeenCalled();
  });

  it('shows message too long error when message exceeds 500 characters', async () => {
    const user = userEvent.setup();
    render(<AnnouncementJsonInput onPreview={mockOnPreview} />);

    const longMessage = 'a'.repeat(501);
    const json = JSON.stringify({ title: 'My Title', message: longMessage });
    fireEvent.change(screen.getByTestId('announcement-json-textarea'), {
      target: { value: json },
    });
    await user.click(screen.getByTestId('announcement-json-preview-button'));

    expect(await screen.findByTestId('announcement-json-error')).toHaveTextContent(
      'Message must be 500 characters or less.'
    );
    expect(mockOnPreview).not.toHaveBeenCalled();
  });

  it('shows invalid URL error when link_url is not a valid URL', async () => {
    const user = userEvent.setup();
    render(<AnnouncementJsonInput onPreview={mockOnPreview} />);

    const json = JSON.stringify({
      title: 'My Title',
      message: 'My message',
      link_url: 'not-a-valid-url',
    });
    fireEvent.change(screen.getByTestId('announcement-json-textarea'), {
      target: { value: json },
    });
    await user.click(screen.getByTestId('announcement-json-preview-button'));

    expect(await screen.findByTestId('announcement-json-error')).toHaveTextContent(
      'Link URL must be a valid URL.'
    );
    expect(mockOnPreview).not.toHaveBeenCalled();
  });

  it('shows URL too long error when link_url exceeds 500 characters', async () => {
    const user = userEvent.setup();
    render(<AnnouncementJsonInput onPreview={mockOnPreview} />);

    const longUrl = 'https://example.com/' + 'a'.repeat(481); // > 500 chars total
    const json = JSON.stringify({ title: 'My Title', message: 'My message', link_url: longUrl });
    fireEvent.change(screen.getByTestId('announcement-json-textarea'), {
      target: { value: json },
    });
    await user.click(screen.getByTestId('announcement-json-preview-button'));

    expect(await screen.findByTestId('announcement-json-error')).toHaveTextContent(
      'Link URL must be 500 characters or less.'
    );
    expect(mockOnPreview).not.toHaveBeenCalled();
  });

  // ---------- Successful preview ----------

  it('calls onPreview with parsed data when JSON is valid (no link)', async () => {
    const user = userEvent.setup();
    render(<AnnouncementJsonInput onPreview={mockOnPreview} />);

    const json = JSON.stringify({ title: 'My Title', message: 'My message' });
    fireEvent.change(screen.getByTestId('announcement-json-textarea'), {
      target: { value: json },
    });
    await user.click(screen.getByTestId('announcement-json-preview-button'));

    await waitFor(() => {
      expect(mockOnPreview).toHaveBeenCalledWith({
        title: 'My Title',
        message: 'My message',
        linkUrl: '',
      });
    });
    expect(screen.queryByTestId('announcement-json-error')).not.toBeInTheDocument();
  });

  it('calls onPreview with parsed data when JSON includes valid link_url', async () => {
    const user = userEvent.setup();
    render(<AnnouncementJsonInput onPreview={mockOnPreview} />);

    const json = JSON.stringify({
      title: 'My Title',
      message: 'My message',
      link_url: 'https://example.com/page',
    });
    fireEvent.change(screen.getByTestId('announcement-json-textarea'), {
      target: { value: json },
    });
    await user.click(screen.getByTestId('announcement-json-preview-button'));

    await waitFor(() => {
      expect(mockOnPreview).toHaveBeenCalledWith({
        title: 'My Title',
        message: 'My message',
        linkUrl: 'https://example.com/page',
      });
    });
  });

  it('allows link_url with http:// scheme', async () => {
    const user = userEvent.setup();
    render(<AnnouncementJsonInput onPreview={mockOnPreview} />);

    const json = JSON.stringify({
      title: 'Title',
      message: 'Message',
      link_url: 'http://example.com',
    });
    fireEvent.change(screen.getByTestId('announcement-json-textarea'), {
      target: { value: json },
    });
    await user.click(screen.getByTestId('announcement-json-preview-button'));

    await waitFor(() => {
      expect(mockOnPreview).toHaveBeenCalled();
    });
    expect(screen.queryByTestId('announcement-json-error')).not.toBeInTheDocument();
  });

  it('accepts title exactly at the 100-character limit', async () => {
    const user = userEvent.setup();
    render(<AnnouncementJsonInput onPreview={mockOnPreview} />);

    const title100 = 'a'.repeat(100);
    const json = JSON.stringify({ title: title100, message: 'My message' });
    fireEvent.change(screen.getByTestId('announcement-json-textarea'), {
      target: { value: json },
    });
    await user.click(screen.getByTestId('announcement-json-preview-button'));

    await waitFor(() => {
      expect(mockOnPreview).toHaveBeenCalledWith({
        title: title100,
        message: 'My message',
        linkUrl: '',
      });
    });
  });

  it('accepts message exactly at the 500-character limit', async () => {
    const user = userEvent.setup();
    render(<AnnouncementJsonInput onPreview={mockOnPreview} />);

    const message500 = 'a'.repeat(500);
    const json = JSON.stringify({ title: 'Title', message: message500 });
    fireEvent.change(screen.getByTestId('announcement-json-textarea'), {
      target: { value: json },
    });
    await user.click(screen.getByTestId('announcement-json-preview-button'));

    await waitFor(() => {
      expect(mockOnPreview).toHaveBeenCalledWith({
        title: 'Title',
        message: message500,
        linkUrl: '',
      });
    });
  });

  it('trims whitespace from title, message, and link_url before calling onPreview', async () => {
    const user = userEvent.setup();
    render(<AnnouncementJsonInput onPreview={mockOnPreview} />);

    const json = JSON.stringify({
      title: '  My Title  ',
      message: '  My message  ',
      link_url: '  https://example.com  ',
    });
    fireEvent.change(screen.getByTestId('announcement-json-textarea'), {
      target: { value: json },
    });
    await user.click(screen.getByTestId('announcement-json-preview-button'));

    await waitFor(() => {
      expect(mockOnPreview).toHaveBeenCalledWith({
        title: 'My Title',
        message: 'My message',
        linkUrl: 'https://example.com',
      });
    });
  });

  it('clears error message after user modifies textarea content', async () => {
    const user = userEvent.setup();
    render(<AnnouncementJsonInput onPreview={mockOnPreview} />);

    const textarea = screen.getByTestId('announcement-json-textarea');

    // Trigger an error
    await user.type(textarea, 'bad json');
    await user.click(screen.getByTestId('announcement-json-preview-button'));
    expect(await screen.findByTestId('announcement-json-error')).toBeInTheDocument();

    // User corrects the input — error should clear on change
    await user.type(textarea, ' more');
    expect(screen.queryByTestId('announcement-json-error')).not.toBeInTheDocument();
  });

  it('preview button becomes enabled once valid content is typed', async () => {
    render(<AnnouncementJsonInput onPreview={mockOnPreview} />);

    // Initially disabled
    expect(screen.getByTestId('announcement-json-preview-button')).toBeDisabled();

    fireEvent.change(screen.getByTestId('announcement-json-textarea'), {
      target: { value: '{"title":"T","message":"M"}' },
    });

    await waitFor(() => {
      expect(screen.getByTestId('announcement-json-preview-button')).toBeEnabled();
    });
  });
});
