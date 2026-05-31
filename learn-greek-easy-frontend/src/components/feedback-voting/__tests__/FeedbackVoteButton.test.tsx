/**
 * FeedbackVoteButton Component Tests
 *
 * Tests for the FeedbackVoteButton component verifying:
 * - Toggle-vote semantics: upvote when current is "up" -> removeVote
 * - Upvote when current is "down" -> vote up
 * - Disabled state while isVoting (double-submit guard)
 * - Count color classes (positive = primary, negative = destructive, zero = neutral)
 */

import React from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { FeedbackVoteButton } from '../FeedbackVoteButton';

// Mock i18n translations
const enFeedback = {
  voting: {
    upvote: 'Upvote',
    downvote: 'Downvote',
  },
};

// Setup i18n for tests
const setupI18n = () => {
  const testI18n = i18n.createInstance();
  testI18n.use(initReactI18next).init({
    resources: {
      en: { feedback: enFeedback },
    },
    lng: 'en',
    fallbackLng: 'en',
    ns: ['feedback'],
    defaultNS: 'feedback',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  return testI18n;
};

const renderWithI18n = (ui: React.ReactElement) => {
  const testI18n = setupI18n();
  return render(<I18nextProvider i18n={testI18n}>{ui}</I18nextProvider>);
};

// Store mock controls — recreated per test via beforeEach
const mockVote = vi.fn();
const mockRemoveVote = vi.fn();

vi.mock('@/stores/feedbackStore', () => ({
  useFeedbackStore: vi.fn(() => ({
    vote: mockVote,
    removeVote: mockRemoveVote,
    isVoting: false,
  })),
}));

// Helper to update the mock return value for a specific test
const setStoreState = async (isVoting: boolean) => {
  const { useFeedbackStore } = await import('@/stores/feedbackStore');
  vi.mocked(useFeedbackStore).mockReturnValue({
    vote: mockVote,
    removeVote: mockRemoveVote,
    isVoting,
  });
};

describe('FeedbackVoteButton', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset to default (not voting) state
    await setStoreState(false);
  });

  describe('Basic Rendering', () => {
    it('renders upvote button, count and downvote button', () => {
      renderWithI18n(<FeedbackVoteButton feedbackId="fb-1" voteCount={5} userVote={null} />);

      expect(screen.getByTestId('vote-buttons')).toBeInTheDocument();
      expect(screen.getByTestId('upvote-button')).toBeInTheDocument();
      expect(screen.getByTestId('downvote-button')).toBeInTheDocument();
      expect(screen.getByTestId('vote-count')).toHaveTextContent('5');
    });

    it('renders aria-labels for accessibility', () => {
      renderWithI18n(<FeedbackVoteButton feedbackId="fb-1" voteCount={0} userVote={null} />);

      expect(screen.getByLabelText('Upvote')).toBeInTheDocument();
      expect(screen.getByLabelText('Downvote')).toBeInTheDocument();
    });
  });

  describe('Toggle-vote semantics — upvote button', () => {
    it('calls vote("up") when userVote is null', async () => {
      const user = userEvent.setup();
      renderWithI18n(<FeedbackVoteButton feedbackId="fb-1" voteCount={0} userVote={null} />);

      await user.click(screen.getByTestId('upvote-button'));

      expect(mockVote).toHaveBeenCalledOnce();
      expect(mockVote).toHaveBeenCalledWith('fb-1', 'up');
      expect(mockRemoveVote).not.toHaveBeenCalled();
    });

    it('calls removeVote when userVote is already "up" (toggle off)', async () => {
      const user = userEvent.setup();
      renderWithI18n(<FeedbackVoteButton feedbackId="fb-1" voteCount={3} userVote="up" />);

      await user.click(screen.getByTestId('upvote-button'));

      expect(mockRemoveVote).toHaveBeenCalledOnce();
      expect(mockRemoveVote).toHaveBeenCalledWith('fb-1');
      expect(mockVote).not.toHaveBeenCalled();
    });

    it('calls vote("up") when userVote is "down" (switch direction)', async () => {
      const user = userEvent.setup();
      renderWithI18n(<FeedbackVoteButton feedbackId="fb-1" voteCount={-1} userVote="down" />);

      await user.click(screen.getByTestId('upvote-button'));

      expect(mockVote).toHaveBeenCalledOnce();
      expect(mockVote).toHaveBeenCalledWith('fb-1', 'up');
      expect(mockRemoveVote).not.toHaveBeenCalled();
    });
  });

  describe('Toggle-vote semantics — downvote button', () => {
    it('calls vote("down") when userVote is null', async () => {
      const user = userEvent.setup();
      renderWithI18n(<FeedbackVoteButton feedbackId="fb-1" voteCount={0} userVote={null} />);

      await user.click(screen.getByTestId('downvote-button'));

      expect(mockVote).toHaveBeenCalledOnce();
      expect(mockVote).toHaveBeenCalledWith('fb-1', 'down');
      expect(mockRemoveVote).not.toHaveBeenCalled();
    });

    it('calls removeVote when userVote is already "down" (toggle off)', async () => {
      const user = userEvent.setup();
      renderWithI18n(<FeedbackVoteButton feedbackId="fb-1" voteCount={-2} userVote="down" />);

      await user.click(screen.getByTestId('downvote-button'));

      expect(mockRemoveVote).toHaveBeenCalledOnce();
      expect(mockRemoveVote).toHaveBeenCalledWith('fb-1');
      expect(mockVote).not.toHaveBeenCalled();
    });

    it('calls vote("down") when userVote is "up" (switch direction)', async () => {
      const user = userEvent.setup();
      renderWithI18n(<FeedbackVoteButton feedbackId="fb-1" voteCount={1} userVote="up" />);

      await user.click(screen.getByTestId('downvote-button'));

      expect(mockVote).toHaveBeenCalledOnce();
      expect(mockVote).toHaveBeenCalledWith('fb-1', 'down');
      expect(mockRemoveVote).not.toHaveBeenCalled();
    });
  });

  describe('Disabled state while isVoting (double-submit guard)', () => {
    it('disables both buttons when isVoting is true', async () => {
      await setStoreState(true);

      renderWithI18n(<FeedbackVoteButton feedbackId="fb-1" voteCount={0} userVote={null} />);

      expect(screen.getByTestId('upvote-button')).toBeDisabled();
      expect(screen.getByTestId('downvote-button')).toBeDisabled();
    });

    it('does not call vote when upvote button is clicked while isVoting', async () => {
      const user = userEvent.setup();
      await setStoreState(true);

      renderWithI18n(<FeedbackVoteButton feedbackId="fb-1" voteCount={0} userVote={null} />);

      await user.click(screen.getByTestId('upvote-button'));

      expect(mockVote).not.toHaveBeenCalled();
      expect(mockRemoveVote).not.toHaveBeenCalled();
    });

    it('does not call removeVote when downvote button is clicked while isVoting', async () => {
      const user = userEvent.setup();
      await setStoreState(true);

      renderWithI18n(<FeedbackVoteButton feedbackId="fb-1" voteCount={-1} userVote="down" />);

      await user.click(screen.getByTestId('downvote-button'));

      expect(mockVote).not.toHaveBeenCalled();
      expect(mockRemoveVote).not.toHaveBeenCalled();
    });

    it('enables both buttons when isVoting is false', () => {
      renderWithI18n(<FeedbackVoteButton feedbackId="fb-1" voteCount={0} userVote={null} />);

      expect(screen.getByTestId('upvote-button')).not.toBeDisabled();
      expect(screen.getByTestId('downvote-button')).not.toBeDisabled();
    });
  });

  describe('Vote count color classes', () => {
    it('applies text-primary class when voteCount > 0', () => {
      renderWithI18n(<FeedbackVoteButton feedbackId="fb-1" voteCount={3} userVote={null} />);

      const countEl = screen.getByTestId('vote-count');
      expect(countEl).toHaveClass('text-primary');
      expect(countEl).not.toHaveClass('text-destructive');
    });

    it('applies text-destructive class when voteCount < 0', () => {
      renderWithI18n(<FeedbackVoteButton feedbackId="fb-1" voteCount={-2} userVote={null} />);

      const countEl = screen.getByTestId('vote-count');
      expect(countEl).toHaveClass('text-destructive');
      expect(countEl).not.toHaveClass('text-primary');
    });

    it('applies neither text-primary nor text-destructive when voteCount is 0', () => {
      renderWithI18n(<FeedbackVoteButton feedbackId="fb-1" voteCount={0} userVote={null} />);

      const countEl = screen.getByTestId('vote-count');
      expect(countEl).not.toHaveClass('text-primary');
      expect(countEl).not.toHaveClass('text-destructive');
    });
  });

  describe('Active vote highlighting', () => {
    it('applies upvote active classes when userVote is "up"', () => {
      renderWithI18n(<FeedbackVoteButton feedbackId="fb-1" voteCount={1} userVote="up" />);

      const upBtn = screen.getByTestId('upvote-button');
      expect(upBtn).toHaveClass('bg-primary/10');
      expect(upBtn).toHaveClass('text-primary');
    });

    it('does not apply upvote active classes when userVote is null', () => {
      renderWithI18n(<FeedbackVoteButton feedbackId="fb-1" voteCount={0} userVote={null} />);

      const upBtn = screen.getByTestId('upvote-button');
      expect(upBtn).not.toHaveClass('bg-primary/10');
    });

    it('applies downvote active classes when userVote is "down"', () => {
      renderWithI18n(<FeedbackVoteButton feedbackId="fb-1" voteCount={-1} userVote="down" />);

      const downBtn = screen.getByTestId('downvote-button');
      expect(downBtn).toHaveClass('bg-destructive/10');
      expect(downBtn).toHaveClass('text-destructive');
    });

    it('does not apply downvote active classes when userVote is null', () => {
      renderWithI18n(<FeedbackVoteButton feedbackId="fb-1" voteCount={0} userVote={null} />);

      const downBtn = screen.getByTestId('downvote-button');
      expect(downBtn).not.toHaveClass('bg-destructive/10');
    });
  });
});
