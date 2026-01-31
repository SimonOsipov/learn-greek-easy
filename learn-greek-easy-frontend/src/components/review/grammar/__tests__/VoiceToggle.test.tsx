/**
 * VoiceToggle Component Tests
 *
 * Tests for the VoiceToggle component, verifying:
 * - Renders Active/Passive labels
 * - Correct initial state based on selectedVoice prop
 * - Toggle is disabled when disabled prop is true
 * - Toggle fires onVoiceChange callback when clicked
 * - Has proper aria-label for accessibility
 * - Applies disabled styling to labels
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { VoiceToggle } from '../VoiceToggle';

describe('VoiceToggle', () => {
  describe('Rendering', () => {
    it('should render Active and Passive labels', () => {
      const onVoiceChange = vi.fn();
      render(<VoiceToggle selectedVoice="active" onVoiceChange={onVoiceChange} />);

      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Passive')).toBeInTheDocument();
    });

    it('should render a switch element', () => {
      const onVoiceChange = vi.fn();
      render(<VoiceToggle selectedVoice="active" onVoiceChange={onVoiceChange} />);

      expect(screen.getByRole('switch')).toBeInTheDocument();
    });
  });

  describe('Initial State', () => {
    it('should have switch unchecked when selectedVoice is active', () => {
      const onVoiceChange = vi.fn();
      render(<VoiceToggle selectedVoice="active" onVoiceChange={onVoiceChange} />);

      const switchElement = screen.getByRole('switch');
      expect(switchElement).toHaveAttribute('data-state', 'unchecked');
    });

    it('should have switch checked when selectedVoice is passive', () => {
      const onVoiceChange = vi.fn();
      render(<VoiceToggle selectedVoice="passive" onVoiceChange={onVoiceChange} />);

      const switchElement = screen.getByRole('switch');
      expect(switchElement).toHaveAttribute('data-state', 'checked');
    });
  });

  describe('Disabled State', () => {
    it('should disable the switch when disabled prop is true', () => {
      const onVoiceChange = vi.fn();
      render(<VoiceToggle selectedVoice="active" onVoiceChange={onVoiceChange} disabled />);

      const switchElement = screen.getByRole('switch');
      expect(switchElement).toBeDisabled();
    });

    it('should apply disabled styling to labels when disabled', () => {
      const onVoiceChange = vi.fn();
      render(<VoiceToggle selectedVoice="active" onVoiceChange={onVoiceChange} disabled />);

      const labels = screen.getAllByText(/Active|Passive/);
      labels.forEach((label) => {
        expect(label).toHaveClass('opacity-50');
        expect(label).toHaveClass('cursor-not-allowed');
      });
    });

    it('should not apply disabled styling to labels when enabled', () => {
      const onVoiceChange = vi.fn();
      render(<VoiceToggle selectedVoice="active" onVoiceChange={onVoiceChange} />);

      const labels = screen.getAllByText(/Active|Passive/);
      labels.forEach((label) => {
        expect(label).not.toHaveClass('opacity-50');
        expect(label).not.toHaveClass('cursor-not-allowed');
      });
    });

    it('should not call onVoiceChange when disabled and clicked', async () => {
      const user = userEvent.setup();
      const onVoiceChange = vi.fn();
      render(<VoiceToggle selectedVoice="active" onVoiceChange={onVoiceChange} disabled />);

      const switchElement = screen.getByRole('switch');
      await user.click(switchElement);

      expect(onVoiceChange).not.toHaveBeenCalled();
    });
  });

  describe('Interaction', () => {
    it('should call onVoiceChange with passive when switch is toggled on', async () => {
      const user = userEvent.setup();
      const onVoiceChange = vi.fn();
      render(<VoiceToggle selectedVoice="active" onVoiceChange={onVoiceChange} />);

      const switchElement = screen.getByRole('switch');
      await user.click(switchElement);

      expect(onVoiceChange).toHaveBeenCalledTimes(1);
      expect(onVoiceChange).toHaveBeenCalledWith('passive');
    });

    it('should call onVoiceChange with active when switch is toggled off', async () => {
      const user = userEvent.setup();
      const onVoiceChange = vi.fn();
      render(<VoiceToggle selectedVoice="passive" onVoiceChange={onVoiceChange} />);

      const switchElement = screen.getByRole('switch');
      await user.click(switchElement);

      expect(onVoiceChange).toHaveBeenCalledTimes(1);
      expect(onVoiceChange).toHaveBeenCalledWith('active');
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria-label for accessibility', () => {
      const onVoiceChange = vi.fn();
      render(<VoiceToggle selectedVoice="active" onVoiceChange={onVoiceChange} />);

      const switchElement = screen.getByRole('switch');
      expect(switchElement).toHaveAttribute(
        'aria-label',
        'Toggle between active and passive voice'
      );
    });

    it('should have labels associated with the switch via htmlFor', () => {
      const onVoiceChange = vi.fn();
      render(<VoiceToggle selectedVoice="active" onVoiceChange={onVoiceChange} />);

      const switchElement = screen.getByRole('switch');
      expect(switchElement).toHaveAttribute('id', 'voice-toggle');

      // Both labels should be for the same switch
      const labels = screen.getAllByText(/Active|Passive/);
      labels.forEach((label) => {
        expect(label).toHaveAttribute('for', 'voice-toggle');
      });
    });
  });

  describe('Default Props', () => {
    it('should default disabled to false', () => {
      const onVoiceChange = vi.fn();
      render(<VoiceToggle selectedVoice="active" onVoiceChange={onVoiceChange} />);

      const switchElement = screen.getByRole('switch');
      expect(switchElement).not.toBeDisabled();
    });
  });
});
