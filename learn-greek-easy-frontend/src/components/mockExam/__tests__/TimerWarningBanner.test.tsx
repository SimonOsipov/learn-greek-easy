import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { TimerWarningBanner } from '../TimerWarningBanner';

describe('TimerWarningBanner', () => {
  describe('visibility', () => {
    it('renders nothing when visible is false', () => {
      const { container } = render(<TimerWarningBanner visible={false} formattedTime="01:00" />);
      expect(container.firstChild).toBeNull();
    });

    it('renders the banner when visible is true', () => {
      render(<TimerWarningBanner visible={true} formattedTime="01:00" />);
      expect(screen.getByTestId('timer-warning-banner')).toBeInTheDocument();
    });
  });

  describe('content', () => {
    it('displays the formatted time in the banner text', () => {
      render(<TimerWarningBanner visible={true} formattedTime="00:45" />);
      const banner = screen.getByTestId('timer-warning-banner');
      expect(banner.textContent).toContain('00:45');
    });

    it('has role="alert" for screen readers', () => {
      render(<TimerWarningBanner visible={true} formattedTime="01:00" />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('has aria-live="assertive"', () => {
      render(<TimerWarningBanner visible={true} formattedTime="01:00" />);
      expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
    });
  });

  describe('className prop', () => {
    it('applies additional className to the banner', () => {
      render(<TimerWarningBanner visible={true} formattedTime="01:00" className="custom-class" />);
      expect(screen.getByTestId('timer-warning-banner')).toHaveClass('custom-class');
    });
  });
});
