// src/components/admin/announcements/__tests__/AnnouncementCreateForm.test.tsx

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AnnouncementCreateForm, useAnnouncementCreateForm } from '../AnnouncementCreateForm';

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
  function Harness() {
    const form = useAnnouncementCreateForm();
    return <AnnouncementCreateForm form={form} />;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all form fields', () => {
    render(<Harness />);

    expect(screen.getByTestId('announcement-title-input')).toBeInTheDocument();
    expect(screen.getByTestId('announcement-message-input')).toBeInTheDocument();
    expect(screen.getByTestId('announcement-link-input')).toBeInTheDocument();
  });

  it('shows character counters for all fields', () => {
    render(<Harness />);

    const counters = screen.getAllByTestId('character-counter');
    expect(counters).toHaveLength(3);
    expect(counters[0]).toHaveTextContent('0/100');
    expect(counters[1]).toHaveTextContent('0/500');
    expect(counters[2]).toHaveTextContent('0/500');
  });

  it('updates character counters in real-time', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const titleInput = screen.getByTestId('announcement-title-input');
    await user.type(titleInput, 'Test title');

    const counters = screen.getAllByTestId('character-counter');
    expect(counters[0]).toHaveTextContent('10/100');
  });

  it('shows validation error for empty title', async () => {
    const user = userEvent.setup();
    render(<Harness />);

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
    render(<Harness />);

    const longTitle = 'a'.repeat(101);
    await user.type(screen.getByTestId('announcement-title-input'), longTitle);

    await waitFor(() => {
      expect(screen.getByText(/title must be at most 100 characters/i)).toBeInTheDocument();
    });
  });

  it('shows validation error for message exceeding max length', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const longMessage = 'a'.repeat(501);
    await user.type(screen.getByTestId('announcement-message-input'), longMessage);

    await waitFor(() => {
      expect(screen.getByText(/message must be at most 500 characters/i)).toBeInTheDocument();
    });
  });

  it('shows validation error for invalid URL format', async () => {
    const user = userEvent.setup();
    render(<Harness />);

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
    render(<Harness />);

    await user.type(screen.getByTestId('announcement-title-input'), 'Test Title');
    await user.type(screen.getByTestId('announcement-message-input'), 'Test Message');
    await user.type(screen.getByTestId('announcement-link-input'), 'https://example.com/page');

    expect(screen.queryByText(/url must start with http/i)).not.toBeInTheDocument();
  });

  it('accepts valid http URL', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByTestId('announcement-title-input'), 'Test Title');
    await user.type(screen.getByTestId('announcement-message-input'), 'Test Message');
    await user.type(screen.getByTestId('announcement-link-input'), 'http://example.com/page');

    expect(screen.queryByText(/url must start with http/i)).not.toBeInTheDocument();
  });

  it('allows empty URL field without validation error', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByTestId('announcement-title-input'), 'Test Title');
    await user.type(screen.getByTestId('announcement-message-input'), 'Test Message');
    // Leave URL empty

    expect(screen.queryByText(/url must start with http/i)).not.toBeInTheDocument();
  });
});
