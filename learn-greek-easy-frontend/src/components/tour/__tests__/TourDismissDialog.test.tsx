import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

  it('"Skip tour" button triggers onSkip without firing onContinue', () => {
    const onSkip = vi.fn();
    const onContinue = vi.fn();
    render(<TourDismissDialog open={true} onSkip={onSkip} onContinue={onContinue} />);
    fireEvent.click(screen.getByText('tour.dismiss.skip'));
    expect(onSkip).toHaveBeenCalled();
    expect(onContinue).not.toHaveBeenCalled();
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

  describe('pointer-events management', () => {
    let overlay: HTMLElement;
    let popover: HTMLElement;

    beforeEach(() => {
      overlay = document.createElement('div');
      overlay.className = 'driver-overlay';
      document.body.appendChild(overlay);

      popover = document.createElement('div');
      popover.className = 'driver-popover';
      document.body.appendChild(popover);
    });

    afterEach(() => {
      overlay.remove();
      popover.remove();
    });

    it('sets pointer-events to none on driver elements when open', () => {
      render(<TourDismissDialog open={true} onSkip={vi.fn()} onContinue={vi.fn()} />);
      expect(overlay.style.pointerEvents).toBe('none');
      expect(popover.style.pointerEvents).toBe('none');
    });

    it('restores pointer-events on driver elements when closed', () => {
      const { rerender } = render(
        <TourDismissDialog open={true} onSkip={vi.fn()} onContinue={vi.fn()} />
      );
      expect(overlay.style.pointerEvents).toBe('none');
      rerender(<TourDismissDialog open={false} onSkip={vi.fn()} onContinue={vi.fn()} />);
      expect(overlay.style.pointerEvents).toBe('');
      expect(popover.style.pointerEvents).toBe('');
    });
  });
});
