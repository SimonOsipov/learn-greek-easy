import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { TourDismissDialog } from '../TourDismissDialog';

describe('TourDismissDialog', () => {
  it('renders with correct title and description when open', () => {
    render(<TourDismissDialog open={true} onSkip={vi.fn()} onContinue={vi.fn()} />);
    expect(screen.getByText('tour.dismiss.title')).toBeInTheDocument();
    expect(screen.getByText('tour.dismiss.description')).toBeInTheDocument();
  });

  it('"Skip tour" button triggers onSkip', () => {
    const onSkip = vi.fn();
    render(<TourDismissDialog open={true} onSkip={onSkip} onContinue={vi.fn()} />);
    fireEvent.click(screen.getByText('tour.dismiss.skip'));
    expect(onSkip).toHaveBeenCalled();
  });

  it('"Continue tour" button triggers onContinue', () => {
    const onContinue = vi.fn();
    render(<TourDismissDialog open={true} onSkip={vi.fn()} onContinue={onContinue} />);
    fireEvent.click(screen.getByText('tour.dismiss.continue'));
    expect(onContinue).toHaveBeenCalled();
  });

  it('does not render content when closed', () => {
    render(<TourDismissDialog open={false} onSkip={vi.fn()} onContinue={vi.fn()} />);
    expect(screen.queryByText('tour.dismiss.title')).not.toBeInTheDocument();
  });
});
