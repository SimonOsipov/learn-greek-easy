import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { MasteryDotsLegend } from '../MasteryDotsLegend';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: (_ns: string) => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

describe('MasteryDotsLegend', () => {
  const defaultProps = {
    namespace: 'culture' as const,
    legendKey: 'deck.masteryDotsLegend',
    ariaLabelKey: 'deck.masteryDotsInfo',
  };

  it('renders info icon trigger', () => {
    render(<MasteryDotsLegend {...defaultProps} />);
    const trigger = screen.getByTestId('mastery-dots-legend-trigger');
    expect(trigger).toBeInTheDocument();
    expect(trigger.querySelector('svg')).toBeInTheDocument();
  });

  it('trigger is a button element', () => {
    render(<MasteryDotsLegend {...defaultProps} />);
    const trigger = screen.getByTestId('mastery-dots-legend-trigger');
    expect(trigger.tagName).toBe('BUTTON');
  });

  it('has correct aria-label on trigger', () => {
    render(<MasteryDotsLegend {...defaultProps} />);
    const trigger = screen.getByTestId('mastery-dots-legend-trigger');
    expect(trigger).toHaveAttribute('aria-label', 'deck.masteryDotsInfo');
  });

  it('popover content is not visible initially', () => {
    render(<MasteryDotsLegend {...defaultProps} />);
    expect(screen.queryByTestId('mastery-dots-legend-content')).not.toBeInTheDocument();
  });

  it('opens popover on click', async () => {
    const user = userEvent.setup();
    render(<MasteryDotsLegend {...defaultProps} />);
    const trigger = screen.getByTestId('mastery-dots-legend-trigger');
    await user.click(trigger);
    expect(screen.getByTestId('mastery-dots-legend-content')).toBeInTheDocument();
  });

  it('shows mastery dots example in popover', async () => {
    const user = userEvent.setup();
    render(<MasteryDotsLegend {...defaultProps} />);
    await user.click(screen.getByTestId('mastery-dots-legend-trigger'));
    expect(screen.getByTestId('mastery-dots')).toBeInTheDocument();
  });

  it('shows legend text in popover', async () => {
    const user = userEvent.setup();
    render(<MasteryDotsLegend {...defaultProps} />);
    await user.click(screen.getByTestId('mastery-dots-legend-trigger'));
    const content = screen.getByTestId('mastery-dots-legend-content');
    expect(content).toHaveTextContent('deck.masteryDotsLegend');
  });
});
