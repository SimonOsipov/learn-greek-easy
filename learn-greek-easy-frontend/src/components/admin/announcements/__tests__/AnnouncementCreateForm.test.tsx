// src/components/admin/announcements/__tests__/AnnouncementCreateForm.test.tsx

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AnnouncementCreateForm } from '../AnnouncementCreateForm';

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'announcements.create.titleLabel': 'Title',
        'announcements.create.titlePlaceholder': 'Enter announcement title',
        'announcements.create.messageLabel': 'Message',
        'announcements.create.messagePlaceholder': 'Enter the announcement message...',
        'announcements.create.linkLabel': 'Link URL',
        'announcements.create.linkPlaceholder': 'https://example.com/page',
        'announcements.create.linkDescription': 'Users can click this link',
        'announcements.create.optional': 'optional',
        'announcements.create.preview': 'Preview',
      };
      return translations[key] || key;
    },
  }),
}));

describe('AnnouncementCreateForm', () => {
  const mockOnPreview = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all form fields', () => {
    render(<AnnouncementCreateForm onPreview={mockOnPreview} />);

    expect(screen.getByTestId('announcement-title-input')).toBeInTheDocument();
    expect(screen.getByTestId('announcement-message-input')).toBeInTheDocument();
    expect(screen.getByTestId('announcement-link-input')).toBeInTheDocument();
    expect(screen.getByTestId('announcement-preview-button')).toBeInTheDocument();
  });

  it('shows character counters for all fields', () => {
    render(<AnnouncementCreateForm onPreview={mockOnPreview} />);

    const counters = screen.getAllByTestId('character-counter');
    expect(counters).toHaveLength(3);
    expect(counters[0]).toHaveTextContent('0/100');
    expect(counters[1]).toHaveTextContent('0/500');
    expect(counters[2]).toHaveTextContent('0/500');
  });

  it('updates character counters in real-time', async () => {
    const user = userEvent.setup();
    render(<AnnouncementCreateForm onPreview={mockOnPreview} />);

    const titleInput = screen.getByTestId('announcement-title-input');
    await user.type(titleInput, 'Test title');

    const counters = screen.getAllByTestId('character-counter');
    expect(counters[0]).toHaveTextContent('10/100');
  });

  it('disables preview button when form is invalid', () => {
    render(<AnnouncementCreateForm onPreview={mockOnPreview} />);

    const previewButton = screen.getByTestId('announcement-preview-button');
    expect(previewButton).toBeDisabled();
  });

  it('enables preview button when required fields are filled', async () => {
    const user = userEvent.setup();
    render(<AnnouncementCreateForm onPreview={mockOnPreview} />);

    await user.type(screen.getByTestId('announcement-title-input'), 'Test Title');
    await user.type(screen.getByTestId('announcement-message-input'), 'Test Message');

    await waitFor(() => {
      expect(screen.getByTestId('announcement-preview-button')).toBeEnabled();
    });
  });

  it('calls onPreview with form data when preview is clicked', async () => {
    const user = userEvent.setup();
    render(<AnnouncementCreateForm onPreview={mockOnPreview} />);

    await user.type(screen.getByTestId('announcement-title-input'), 'Test Title');
    await user.type(screen.getByTestId('announcement-message-input'), 'Test Message');
    await user.type(screen.getByTestId('announcement-link-input'), 'https://example.com');

    await waitFor(() => {
      expect(screen.getByTestId('announcement-preview-button')).toBeEnabled();
    });

    await user.click(screen.getByTestId('announcement-preview-button'));

    await waitFor(() => {
      expect(mockOnPreview).toHaveBeenCalledWith({
        title: 'Test Title',
        message: 'Test Message',
        linkUrl: 'https://example.com',
      });
    });
  });

  it('shows validation error for empty title', async () => {
    const user = userEvent.setup();
    render(<AnnouncementCreateForm onPreview={mockOnPreview} />);

    const titleInput = screen.getByTestId('announcement-title-input');
    await user.type(titleInput, 'a');
    await user.clear(titleInput);

    // Tab away to trigger validation
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText(/title is required/i)).toBeInTheDocument();
    });
  });

  it('shows validation error for title exceeding max length', async () => {
    const user = userEvent.setup();
    render(<AnnouncementCreateForm onPreview={mockOnPreview} />);

    const longTitle = 'a'.repeat(101);
    await user.type(screen.getByTestId('announcement-title-input'), longTitle);

    await waitFor(() => {
      expect(screen.getByText(/title must be at most 100 characters/i)).toBeInTheDocument();
    });
  });

  it('shows validation error for message exceeding max length', async () => {
    const user = userEvent.setup();
    render(<AnnouncementCreateForm onPreview={mockOnPreview} />);

    const longMessage = 'a'.repeat(501);
    await user.type(screen.getByTestId('announcement-message-input'), longMessage);

    await waitFor(() => {
      expect(screen.getByText(/message must be at most 500 characters/i)).toBeInTheDocument();
    });
  });

  it('shows validation error for invalid URL format', async () => {
    const user = userEvent.setup();
    render(<AnnouncementCreateForm onPreview={mockOnPreview} />);

    await user.type(screen.getByTestId('announcement-title-input'), 'Test Title');
    await user.type(screen.getByTestId('announcement-message-input'), 'Test Message');
    await user.type(screen.getByTestId('announcement-link-input'), 'invalid-url');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText(/url must start with http/i)).toBeInTheDocument();
    });
  });

  it('accepts valid https URL', async () => {
    const user = userEvent.setup();
    render(<AnnouncementCreateForm onPreview={mockOnPreview} />);

    await user.type(screen.getByTestId('announcement-title-input'), 'Test Title');
    await user.type(screen.getByTestId('announcement-message-input'), 'Test Message');
    await user.type(screen.getByTestId('announcement-link-input'), 'https://example.com/page');

    await waitFor(() => {
      expect(screen.getByTestId('announcement-preview-button')).toBeEnabled();
    });

    expect(screen.queryByText(/url must start with http/i)).not.toBeInTheDocument();
  });

  it('accepts valid http URL', async () => {
    const user = userEvent.setup();
    render(<AnnouncementCreateForm onPreview={mockOnPreview} />);

    await user.type(screen.getByTestId('announcement-title-input'), 'Test Title');
    await user.type(screen.getByTestId('announcement-message-input'), 'Test Message');
    await user.type(screen.getByTestId('announcement-link-input'), 'http://example.com/page');

    await waitFor(() => {
      expect(screen.getByTestId('announcement-preview-button')).toBeEnabled();
    });

    expect(screen.queryByText(/url must start with http/i)).not.toBeInTheDocument();
  });

  it('allows empty URL field', async () => {
    const user = userEvent.setup();
    render(<AnnouncementCreateForm onPreview={mockOnPreview} />);

    await user.type(screen.getByTestId('announcement-title-input'), 'Test Title');
    await user.type(screen.getByTestId('announcement-message-input'), 'Test Message');
    // Leave URL empty

    await waitFor(() => {
      expect(screen.getByTestId('announcement-preview-button')).toBeEnabled();
    });
  });

  it('disables preview button when submitting', () => {
    render(<AnnouncementCreateForm onPreview={mockOnPreview} isSubmitting={true} />);

    expect(screen.getByTestId('announcement-preview-button')).toBeDisabled();
  });
});
