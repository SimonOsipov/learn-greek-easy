import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { TourCompletionDialog } from '../TourCompletionDialog';

describe('TourCompletionDialog', () => {
  it('renders with correct title and description when open', () => {
    render(<TourCompletionDialog open={true} onStartLearning={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText('tour.complete.title')).toBeInTheDocument();
    expect(screen.getByText('tour.complete.description')).toBeInTheDocument();
  });

  it('"Start Learning" button triggers onStartLearning', () => {
    const onStartLearning = vi.fn();
    render(
      <TourCompletionDialog open={true} onStartLearning={onStartLearning} onDismiss={vi.fn()} />
    );
    fireEvent.click(screen.getByText('tour.complete.startLearning'));
    expect(onStartLearning).toHaveBeenCalled();
  });

  it('"Maybe later" button triggers onDismiss', () => {
    const onDismiss = vi.fn();
    render(<TourCompletionDialog open={true} onStartLearning={vi.fn()} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByText('tour.complete.maybeLater'));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('does not render content when closed', () => {
    render(<TourCompletionDialog open={false} onStartLearning={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.queryByText('tour.complete.title')).not.toBeInTheDocument();
  });
});
