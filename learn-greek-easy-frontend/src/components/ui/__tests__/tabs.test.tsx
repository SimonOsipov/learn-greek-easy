/**
 * Tabs Component Tests
 * Validates Radix UI Tabs wrapper with variants and accessibility
 */

import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { render, screen } from '@/lib/test-utils';

describe('Tabs Component', () => {
  const renderTabs = (props: React.ComponentProps<typeof Tabs> = {}) => {
    return render(
      <Tabs defaultValue="tab1" {...props}>
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          <TabsTrigger value="tab3" disabled>
            Tab 3
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
        <TabsContent value="tab3">Content 3</TabsContent>
      </Tabs>
    );
  };

  describe('Rendering', () => {
    it('should render tabs with correct ARIA roles', () => {
      renderTabs();

      expect(screen.getByRole('tablist')).toBeInTheDocument();
      expect(screen.getAllByRole('tab')).toHaveLength(3);
      expect(screen.getByRole('tabpanel')).toBeInTheDocument();
    });

    it('should show default tab content', () => {
      renderTabs();

      expect(screen.getByText('Content 1')).toBeInTheDocument();
      expect(screen.queryByText('Content 2')).not.toBeInTheDocument();
    });

    it('should mark default tab as selected', () => {
      renderTabs();

      const tab1 = screen.getByRole('tab', { name: /tab 1/i });
      expect(tab1).toHaveAttribute('data-state', 'active');
      expect(tab1).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Tab Switching', () => {
    it('should switch tab content on click', async () => {
      const user = userEvent.setup();
      renderTabs();

      const tab2 = screen.getByRole('tab', { name: /tab 2/i });
      await user.click(tab2);

      expect(screen.getByText('Content 2')).toBeInTheDocument();
      expect(screen.queryByText('Content 1')).not.toBeInTheDocument();
      expect(tab2).toHaveAttribute('data-state', 'active');
    });

    it('should call onValueChange callback when tab changes', async () => {
      const handleValueChange = vi.fn();
      const user = userEvent.setup();

      render(
        <Tabs defaultValue="tab1" onValueChange={handleValueChange}>
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      await user.click(screen.getByRole('tab', { name: /tab 2/i }));

      expect(handleValueChange).toHaveBeenCalledWith('tab2');
      expect(handleValueChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('Disabled State', () => {
    it('should render disabled tab with correct attributes', () => {
      renderTabs();

      const disabledTab = screen.getByRole('tab', { name: /tab 3/i });
      expect(disabledTab).toBeDisabled();
      expect(disabledTab).toHaveAttribute('data-disabled', '');
    });

    it('should not switch to disabled tab on click', async () => {
      const user = userEvent.setup();
      renderTabs();

      const disabledTab = screen.getByRole('tab', { name: /tab 3/i });
      await user.click(disabledTab);

      // Should still show Content 1, not Content 3
      expect(screen.getByText('Content 1')).toBeInTheDocument();
      expect(screen.queryByText('Content 3')).not.toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should navigate tabs with ArrowRight', async () => {
      const user = userEvent.setup();
      renderTabs();

      const tab1 = screen.getByRole('tab', { name: /tab 1/i });
      tab1.focus();

      await user.keyboard('{ArrowRight}');

      const tab2 = screen.getByRole('tab', { name: /tab 2/i });
      expect(tab2).toHaveFocus();
    });

    it('should navigate tabs with ArrowLeft', async () => {
      const user = userEvent.setup();
      renderTabs();

      const tab2 = screen.getByRole('tab', { name: /tab 2/i });
      tab2.focus();

      await user.keyboard('{ArrowLeft}');

      const tab1 = screen.getByRole('tab', { name: /tab 1/i });
      expect(tab1).toHaveFocus();
    });

    it('should skip disabled tabs during keyboard navigation', async () => {
      const user = userEvent.setup();
      renderTabs();

      const tab2 = screen.getByRole('tab', { name: /tab 2/i });
      tab2.focus();

      // ArrowRight from tab2 should skip disabled tab3 and wrap to tab1
      await user.keyboard('{ArrowRight}');

      const tab1 = screen.getByRole('tab', { name: /tab 1/i });
      expect(tab1).toHaveFocus();
    });
  });

  describe('Variants', () => {
    it('should apply default variant styling', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1" variant="default">
              Default Tab
            </TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content</TabsContent>
        </Tabs>
      );

      const tab = screen.getByRole('tab', { name: /default tab/i });
      // Default variant uses data-[state=active]:bg-background
      expect(tab.className).toContain('data-[state=active]:bg-background');
    });

    it('should apply gradient variant styling', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1" variant="gradient">
              Gradient Tab
            </TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content</TabsContent>
        </Tabs>
      );

      const tab = screen.getByRole('tab', { name: /gradient tab/i });
      // Gradient variant uses bg-gradient-primary
      expect(tab.className).toContain('data-[state=active]:bg-gradient-primary');
    });
  });

  describe('Controlled Mode', () => {
    it('should respect controlled value prop', () => {
      render(
        <Tabs value="tab2">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      expect(screen.getByText('Content 2')).toBeInTheDocument();
      expect(screen.queryByText('Content 1')).not.toBeInTheDocument();

      const tab2 = screen.getByRole('tab', { name: /tab 2/i });
      expect(tab2).toHaveAttribute('data-state', 'active');
    });

    it('should update when controlled value changes', () => {
      const { rerender } = render(
        <Tabs value="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      expect(screen.getByText('Content 1')).toBeInTheDocument();

      rerender(
        <Tabs value="tab2">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      expect(screen.getByText('Content 2')).toBeInTheDocument();
      expect(screen.queryByText('Content 1')).not.toBeInTheDocument();
    });
  });

  describe('Focus Styling', () => {
    it('should have focus-visible ring classes on TabsTrigger', () => {
      renderTabs();

      const tab = screen.getByRole('tab', { name: /tab 1/i });
      expect(tab.className).toContain('focus-visible:ring-2');
      expect(tab.className).toContain('focus-visible:ring-ring');
    });

    it('should have focus-visible ring classes on TabsContent', () => {
      renderTabs();

      const tabpanel = screen.getByRole('tabpanel');
      expect(tabpanel.className).toContain('focus-visible:ring-2');
      expect(tabpanel.className).toContain('focus-visible:ring-ring');
    });
  });

  describe('Custom Classes', () => {
    it('should merge custom className with TabsList', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList className="custom-class">
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content</TabsContent>
        </Tabs>
      );

      const tablist = screen.getByRole('tablist');
      expect(tablist.className).toContain('custom-class');
      expect(tablist.className).toContain('bg-muted');
    });

    it('should merge custom className with TabsTrigger', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1" className="custom-trigger-class">
              Tab 1
            </TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content</TabsContent>
        </Tabs>
      );

      const tab = screen.getByRole('tab', { name: /tab 1/i });
      expect(tab.className).toContain('custom-trigger-class');
    });

    it('should merge custom className with TabsContent', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1" className="custom-content-class">
            Content
          </TabsContent>
        </Tabs>
      );

      const tabpanel = screen.getByRole('tabpanel');
      expect(tabpanel.className).toContain('custom-content-class');
    });
  });
});
