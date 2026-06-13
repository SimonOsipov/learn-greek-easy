/**
 * EMAIL-19-01: PersonalInfoSection — email change UI tests
 *
 * Covers:
 * 1. "Change email" affordance renders (no more readOnly lock with emailCannotChange copy).
 * 2. Submitting the email form calls requestEmailChange.
 * 3. A Supabase error from requestEmailChange surfaces a toast.
 * 4. A "duplicate / in use" Supabase error sets a field-level error (not just toast).
 * 5. Pending change banner renders when Supabase reports a pending new_email.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, _opts?: Record<string, unknown>) => key,
    i18n: { language: 'en' },
  }),
}));

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockRequestEmailChange = vi.fn();
const mockUpdateProfile = vi.fn();

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      updateProfile: mockUpdateProfile,
      requestEmailChange: mockRequestEmailChange,
    }),
  // We need setState for the avatar-removal code path, but it's not exercised here
}));

// Mock Supabase client so we can control the pending email state
let mockGetUserNewEmail: string | null = null;
const mockGetUser = vi.fn();
vi.mock('@/lib/supabaseClient', () => ({
  getSupabase: vi.fn(() =>
    Promise.resolve({
      auth: {
        getUser: mockGetUser,
      },
    })
  ),
}));

// Mock authAPI (not called in email-change path, but used by avatar methods)
vi.mock('@/services/authAPI', () => ({
  authAPI: {
    getAvatarUploadUrl: vi.fn(),
    uploadToS3: vi.fn(),
    removeAvatar: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { PersonalInfoSection } from '../PersonalInfoSection';

const mockUser = {
  id: 'user-1',
  email: 'current@example.com',
  name: 'Test User',
  avatar: undefined,
  role: 'free' as const,
  preferences: {
    language: 'en' as const,
    dailyGoal: 20,
    notifications: true,
    theme: 'light' as const,
  },
  stats: {
    streak: 0,
    wordsLearned: 0,
    totalXP: 0,
    joinedDate: new Date('2025-01-01'),
  },
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  authProvider: 'email' as string | undefined,
};

const renderComponent = () => render(<PersonalInfoSection user={mockUser} />);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PersonalInfoSection — email change UI (EMAIL-19-01)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserNewEmail = null;
    // Default: no pending change
    mockGetUser.mockResolvedValue({
      data: { user: { new_email: mockGetUserNewEmail } },
    });
  });

  // -------------------------------------------------------------------------
  // AC 1: "Change email" affordance is present; emailCannotChange copy is gone
  // -------------------------------------------------------------------------
  it('renders a "Change email" button and no emailCannotChange text', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('personalInfo.changeEmail')).toBeInTheDocument();
    });

    expect(screen.queryByText('personalInfo.emailCannotChange')).not.toBeInTheDocument();
  });

  it('shows the current email in a read-only input', async () => {
    renderComponent();

    const emailInput = screen.getByDisplayValue('current@example.com');
    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toHaveAttribute('readonly');
  });

  // -------------------------------------------------------------------------
  // AC 2: opening the form reveals an email input
  // -------------------------------------------------------------------------
  it('clicking "Change email" reveals the new email input', async () => {
    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('personalInfo.changeEmail')).toBeInTheDocument();
    });

    await user.click(screen.getByText('personalInfo.changeEmail'));

    expect(screen.getByLabelText('personalInfo.newEmailLabel')).toBeInTheDocument();
  });

  // Helper: open the email change form and return a reference to the submit button inside it
  const openEmailForm = async (user: ReturnType<typeof userEvent.setup>) => {
    await waitFor(() => {
      expect(screen.getByText('personalInfo.changeEmail')).toBeInTheDocument();
    });
    await user.click(screen.getByText('personalInfo.changeEmail'));
    await waitFor(() => {
      expect(screen.getByLabelText('personalInfo.newEmailLabel')).toBeInTheDocument();
    });
    // The email-form submit button is type="button" (not the name-form's type="submit")
    // We can find it by its role and position within the form box
    return screen
      .getAllByRole('button')
      .find(
        (btn) =>
          btn.textContent === 'personalInfo.saveChanges' && btn.getAttribute('type') === 'button'
      )!;
  };

  // -------------------------------------------------------------------------
  // AC 3: submitting the email form calls requestEmailChange
  // -------------------------------------------------------------------------
  it('submitting the email form calls requestEmailChange with the new email', async () => {
    const user = userEvent.setup();
    mockRequestEmailChange.mockResolvedValue(undefined);
    mockGetUser.mockResolvedValue({ data: { user: { new_email: null } } });

    renderComponent();

    const submitBtn = await openEmailForm(user);
    await user.type(screen.getByLabelText('personalInfo.newEmailLabel'), 'new@example.com');
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockRequestEmailChange).toHaveBeenCalledWith('new@example.com');
    });
  });

  // -------------------------------------------------------------------------
  // AC 4: on success, a toast is shown (emailChangeSent)
  // -------------------------------------------------------------------------
  it('shows emailChangeSent toast on successful submission', async () => {
    const user = userEvent.setup();
    mockRequestEmailChange.mockResolvedValue(undefined);
    mockGetUser.mockResolvedValue({ data: { user: { new_email: null } } });

    renderComponent();

    const submitBtn = await openEmailForm(user);
    await user.type(screen.getByLabelText('personalInfo.newEmailLabel'), 'new@example.com');
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'personalInfo.emailChangeSent' })
      );
    });
  });

  // -------------------------------------------------------------------------
  // AC 5: Supabase generic error surfaces a destructive toast
  // -------------------------------------------------------------------------
  it('shows emailChangeError toast when requestEmailChange throws a generic error', async () => {
    const user = userEvent.setup();
    mockRequestEmailChange.mockRejectedValue(new Error('Something went wrong'));
    mockGetUser.mockResolvedValue({ data: { user: { new_email: null } } });

    renderComponent();

    const submitBtn = await openEmailForm(user);
    await user.type(screen.getByLabelText('personalInfo.newEmailLabel'), 'new@example.com');
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'personalInfo.emailChangeError',
          variant: 'destructive',
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // AC 6: "already in use" Supabase error maps to emailInUse field error
  // -------------------------------------------------------------------------
  it('maps "already in use" Supabase error to emailInUse field-level error', async () => {
    const user = userEvent.setup();
    mockRequestEmailChange.mockRejectedValue(new Error('Email already registered'));
    mockGetUser.mockResolvedValue({ data: { user: { new_email: null } } });

    renderComponent();

    const submitBtn = await openEmailForm(user);
    await user.type(screen.getByLabelText('personalInfo.newEmailLabel'), 'taken@example.com');
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('personalInfo.emailInUse')).toBeInTheDocument();
    });

    // Should NOT show the generic toast for this case
    expect(mockToast).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'personalInfo.emailChangeError' })
    );
  });

  // -------------------------------------------------------------------------
  // AC 7: invalid email format is blocked client-side
  // -------------------------------------------------------------------------
  it('blocks submission of an invalid email format with a validation message', async () => {
    const user = userEvent.setup();
    mockGetUser.mockResolvedValue({ data: { user: { new_email: null } } });

    renderComponent();

    const submitBtn = await openEmailForm(user);
    await user.type(screen.getByLabelText('personalInfo.newEmailLabel'), 'not-an-email');
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('personalInfo.emailInvalid')).toBeInTheDocument();
    });

    expect(mockRequestEmailChange).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // AC 8: pending banner renders when Supabase user has new_email set
  // -------------------------------------------------------------------------
  it('shows pending change banner when Supabase reports a pending new_email', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { new_email: 'pending@example.com' } },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('personalInfo.emailChangePending')).toBeInTheDocument();
    });

    // Resubmit affordance is present in the banner
    expect(screen.getByText('personalInfo.emailChangeResubmit')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC 9: no pending banner when new_email is null
  // -------------------------------------------------------------------------
  it('does NOT show the pending banner when there is no pending new_email', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { new_email: null } },
    });

    renderComponent();

    // Wait for mount effect to resolve
    await waitFor(() => {
      expect(mockGetUser).toHaveBeenCalled();
    });

    expect(screen.queryByText('personalInfo.emailChangePending')).not.toBeInTheDocument();
  });
});
