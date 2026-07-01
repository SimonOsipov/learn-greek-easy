/**
 * Button Component Tests
 * Validates React Testing Library setup
 */

import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { Button } from '@/components/ui/button';
import { render, screen } from '@/lib/test-utils';

describe('Button Component', () => {
  it('should render button with text', () => {
    render(<Button>Click Me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('should call onClick handler when clicked', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<Button onClick={handleClick}>Click Me</Button>);

    const button = screen.getByRole('button', { name: /click me/i });
    await user.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled Button</Button>);

    const button = screen.getByRole('button', { name: /disabled button/i });
    expect(button).toBeDisabled();
  });

  it('should apply variant styles correctly', () => {
    render(<Button variant="destructive">Delete</Button>);

    const button = screen.getByRole('button', { name: /delete/i });
    // Check if destructive class is applied
    expect(button.className).toContain('destructive');
  });

  it('should apply size variants correctly', () => {
    render(<Button size="sm">Small Button</Button>);

    const button = screen.getByRole('button', { name: /small button/i });
    expect(button.className).toContain('h-9');
  });

  it('should not call onClick when disabled', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(
      <Button disabled onClick={handleClick}>
        Disabled Button
      </Button>
    );

    const button = screen.getByRole('button', { name: /disabled button/i });
    await user.click(button);

    expect(handleClick).not.toHaveBeenCalled();
  });

  // DASH2-03-02 (test-first, RED until ghost/outline hover migrated to neutral):
  // Claude Design has no violet button hover anywhere — every ghost/outline/icon/
  // secondary button hovers neutral. Locks the resolved-class contract before the
  // migration lands.
  describe('variant hover contract (DASH2-03-02)', () => {
    it('ghost variant hover resolves to neutral hover:bg-muted, not hover:bg-accent', () => {
      render(<Button variant="ghost">Ghost</Button>);

      const button = screen.getByRole('button', { name: /ghost/i });
      expect(button.className).toContain('hover:bg-muted');
      expect(button.className).not.toContain('hover:bg-accent');
    });

    it('outline variant hover resolves to neutral hover:bg-muted, not hover:bg-accent', () => {
      render(<Button variant="outline">Outline</Button>);

      const button = screen.getByRole('button', { name: /outline/i });
      expect(button.className).toContain('hover:bg-muted');
      expect(button.className).not.toContain('hover:bg-accent');
    });

    // Adversarial coverage (QA, DASH2-03-02): the two tests above only pin ghost/
    // outline. These lock the surrounding contract so future edits can't quietly
    // reintroduce violet hover, either by touching an untested variant or by
    // "fixing" ghost/outline in a way that also drifts the untouched default variant.
    it.each([
      'default',
      'destructive',
      'outline',
      'secondary',
      'ghost',
      'landing-chrome',
      'landing-primary',
      'link',
      'success',
      'hero',
      'hero-outline',
    ] as const)(
      'variant="%s" never resolves to bg-accent (no violet button hover in CD)',
      (variant) => {
        render(<Button variant={variant}>Label</Button>);

        const button = screen.getByRole('button', { name: /label/i });
        expect(button.className).not.toContain('bg-accent');
      }
    );

    it('default variant hover is untouched by the ghost/outline migration (surgical-change guard)', () => {
      render(<Button variant="default">Default</Button>);

      const button = screen.getByRole('button', { name: /default/i });
      expect(button.className).toContain('hover:bg-primary/90');
      expect(button.className).not.toContain('hover:bg-muted');
    });
  });
});
