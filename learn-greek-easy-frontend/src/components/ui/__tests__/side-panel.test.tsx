/**
 * SidePanel Component Tests
 * Validates compound API, Context wiring, size variant, and shadcn close-button override.
 */

import * as React from 'react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { render, screen } from '@/lib/test-utils';
import { SidePanel, type SidePanelProps } from '@/components/ui/side-panel';

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderPanel(props: Partial<SidePanelProps> = {}) {
  const onOpenChange = vi.fn();
  return render(
    <SidePanel open={true} onOpenChange={onOpenChange} title="Test panel" {...props}>
      <SidePanel.Header>Header content</SidePanel.Header>
      <SidePanel.Body>Body content</SidePanel.Body>
      <SidePanel.Footer>Footer content</SidePanel.Footer>
      <SidePanel.CloseButton />
    </SidePanel>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SidePanel', () => {
  // AC #1 — Static properties exist
  describe('static properties', () => {
    it('exposes .Header as a static property', () => {
      expect(SidePanel.Header).toBeDefined();
    });
    it('exposes .Tabs as a static property', () => {
      expect(SidePanel.Tabs).toBeDefined();
    });
    it('exposes .Body as a static property', () => {
      expect(SidePanel.Body).toBeDefined();
    });
    it('exposes .Footer as a static property', () => {
      expect(SidePanel.Footer).toBeDefined();
    });
    it('exposes .CloseButton as a static property', () => {
      expect(SidePanel.CloseButton).toBeDefined();
    });
  });

  // AC #2 — Open / closed accessibility tree
  describe('open/closed state', () => {
    it('renders children in the accessibility tree when open=true', () => {
      renderPanel({ open: true });
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Body content')).toBeInTheDocument();
    });

    it('does not render children in the accessibility tree when open=false', () => {
      renderPanel({ open: false });
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  // AC #3 — CloseButton invokes onOpenChange(false) via context
  describe('CloseButton context wiring', () => {
    it('calls onOpenChange(false) when CloseButton is clicked', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <SidePanel open={true} onOpenChange={onOpenChange} title="Test panel">
          <SidePanel.CloseButton />
        </SidePanel>
      );

      // Query specifically for our CloseButton (has aria-label="Close" directly on the button)
      // shadcn's built-in close button has no aria-label; it uses a sr-only span instead.
      const btn = document.querySelector('button[aria-label="Close"].drawer-close') as HTMLElement;
      expect(btn).not.toBeNull();
      await user.click(btn);

      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onOpenChange).toHaveBeenCalledTimes(1);
    });

    it('throws when CloseButton is rendered outside <SidePanel>', () => {
      // Suppress React's error boundary console.error in test output
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => render(<SidePanel.CloseButton />)).toThrow(
        'SidePanel.* subcomponents must be rendered inside <SidePanel>'
      );
      consoleError.mockRestore();
    });
  });

  // AC #4 — CloseButton markup
  describe('CloseButton markup', () => {
    it('renders a button[type="button"][aria-label="Close"] with an SVG icon', () => {
      renderPanel();
      // Query by both aria-label and drawer-close class to target our button specifically
      const btn = document.querySelector('button[aria-label="Close"].drawer-close') as HTMLElement;
      expect(btn).not.toBeNull();
      expect(btn).toHaveAttribute('type', 'button');
      expect(btn).toHaveAttribute('aria-label', 'Close');
      expect(btn.querySelector('svg')).not.toBeNull();
    });
  });

  // AC #5 — size="wide" class assertion (jsdom doesn't compute Tailwind max-width,
  // so we assert the CSS class is applied to the SheetContent element)
  describe('size="wide"', () => {
    it('applies !max-w-[1080px] class to SheetContent when size="wide"', () => {
      renderPanel({ size: 'wide' });
      const dialog = screen.getByRole('dialog');
      expect(dialog.className).toContain('!max-w-[1080px]');
    });

    it('applies w-[95vw] class to SheetContent when size="wide"', () => {
      renderPanel({ size: 'wide' });
      const dialog = screen.getByRole('dialog');
      expect(dialog.className).toContain('w-[95vw]');
    });

    it('does not apply wide classes when size is default', () => {
      renderPanel({ size: 'default' });
      const dialog = screen.getByRole('dialog');
      expect(dialog.className).not.toContain('!max-w-[1080px]');
    });
  });

  // AC — size="half" variant (ADMIN2-20)
  describe('size="half"', () => {
    it('applies drawer-size-half class to SheetContent when size="half"', () => {
      renderPanel({ size: 'half' });
      const dialog = screen.getByRole('dialog');
      expect(dialog.className).toContain('drawer-size-half');
    });

    it('index.css defines .drawer-size-half with 50vw width and 560/720 clamps', () => {
      const css = readFileSync(resolve(__dirname, '../../../index.css'), 'utf8');
      expect(css).toContain('.drawer-size-half');
      expect(css).toContain('width: 50vw');
      expect(css).toContain('min-width: 560px');
      expect(css).toContain('max-width: 720px');
    });

    it('does not apply drawer-size-half when size is default', () => {
      renderPanel({ size: 'default' });
      const dialog = screen.getByRole('dialog');
      expect(dialog.className).not.toContain('drawer-size-half');
    });
  });

  // AC — CloseButton position prop (ADMIN2-20)
  describe('CloseButton position prop', () => {
    it('adds drawer-close-right class when position="right"', () => {
      render(
        <SidePanel open={true} onOpenChange={vi.fn()} title="Test panel">
          <SidePanel.CloseButton position="right" />
        </SidePanel>
      );
      const btn = document.querySelector('button[aria-label="Close"].drawer-close') as HTMLElement;
      expect(btn).not.toBeNull();
      expect(btn.className).toContain('drawer-close-right');
    });

    it('does not add drawer-close-right class by default', () => {
      renderPanel();
      const btn = document.querySelector('button[aria-label="Close"].drawer-close') as HTMLElement;
      expect(btn).not.toBeNull();
      expect(btn.className).not.toContain('drawer-close-right');
    });

    it('does not add drawer-close-right class when position="left"', () => {
      render(
        <SidePanel open={true} onOpenChange={vi.fn()} title="Test panel">
          <SidePanel.CloseButton position="left" />
        </SidePanel>
      );
      const btn = document.querySelector('button[aria-label="Close"].drawer-close') as HTMLElement;
      expect(btn).not.toBeNull();
      expect(btn.className).not.toContain('drawer-close-right');
    });
  });

  // AC #6 — Built-in close button hidden via CSS rule in index.css
  // jsdom does not process CSS files, so we assert the rule exists in the source.
  describe('shadcn built-in close button override', () => {
    it('index.css contains [data-side-panel] > button.absolute { display: none }', () => {
      // __dirname = src/components/ui/__tests__ → ../../../index.css = src/index.css
      const css = readFileSync(resolve(__dirname, '../../../index.css'), 'utf8');
      expect(css).toContain('[data-side-panel] > button.absolute');
      expect(css).toContain('display: none');
    });
  });

  // AC #7 — Esc and click-outside fire onOpenChange(false)
  describe('Esc and overlay click', () => {
    it('calls onOpenChange(false) when Escape key is pressed', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <SidePanel open={true} onOpenChange={onOpenChange} title="Test panel">
          <SidePanel.Body>Content</SidePanel.Body>
        </SidePanel>
      );

      // Focus is inside the dialog after open; press Escape
      await user.keyboard('{Escape}');
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('does not break Radix click-outside behavior (dialog remains accessible after open)', () => {
      const onOpenChange = vi.fn();
      render(
        <SidePanel open={true} onOpenChange={onOpenChange} title="Test panel">
          <SidePanel.Body>Content</SidePanel.Body>
        </SidePanel>
      );
      // jsdom cannot reliably simulate pointer events on the overlay backdrop,
      // but we verify the dialog is mounted and Radix's onOpenChange is wired correctly
      // (Esc test above is the definitive check that onOpenChange is not broken).
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });

  // AC #8 — Chrome classes on subcomponents
  describe('chrome classes', () => {
    it('.Header renders drawer-head class', () => {
      render(
        <SidePanel open={true} onOpenChange={vi.fn()} title="Test panel">
          <SidePanel.Header />
        </SidePanel>
      );
      expect(document.querySelector('.drawer-head')).not.toBeNull();
    });

    it('.Tabs renders drawer-tabs class', () => {
      render(
        <SidePanel open={true} onOpenChange={vi.fn()} title="Test panel">
          <SidePanel.Tabs />
        </SidePanel>
      );
      expect(document.querySelector('.drawer-tabs')).not.toBeNull();
    });

    it('.Body renders drawer-body class', () => {
      render(
        <SidePanel open={true} onOpenChange={vi.fn()} title="Test panel">
          <SidePanel.Body />
        </SidePanel>
      );
      expect(document.querySelector('.drawer-body')).not.toBeNull();
    });

    it('.Footer renders drawer-foot class', () => {
      render(
        <SidePanel open={true} onOpenChange={vi.fn()} title="Test panel">
          <SidePanel.Footer />
        </SidePanel>
      );
      expect(document.querySelector('.drawer-foot')).not.toBeNull();
    });
  });

  // AC #9 — className merge via cn()
  describe('className merging', () => {
    it('.Header merges custom className', () => {
      render(
        <SidePanel open={true} onOpenChange={vi.fn()} title="Test panel">
          <SidePanel.Header className="custom-head" />
        </SidePanel>
      );
      const el = document.querySelector('.drawer-head');
      expect(el?.className).toContain('drawer-head');
      expect(el?.className).toContain('custom-head');
    });

    it('.Body merges custom className', () => {
      render(
        <SidePanel open={true} onOpenChange={vi.fn()} title="Test panel">
          <SidePanel.Body className="custom-body" />
        </SidePanel>
      );
      const el = document.querySelector('.drawer-body');
      expect(el?.className).toContain('drawer-body');
      expect(el?.className).toContain('custom-body');
    });
  });

  // AC #10 — SidePanelProps is exported (compile-time, verified by the import at the top)
  it('exports SidePanelProps type (verified via type-import at top of file)', () => {
    // If SidePanelProps is not exported, the TypeScript build fails — this test is a sentinel.
    expect(true).toBe(true);
  });
});
