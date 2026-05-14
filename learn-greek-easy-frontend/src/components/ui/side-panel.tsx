import * as React from 'react';

import * as VisuallyHidden from '@radix-ui/react-visually-hidden';

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

export type SidePanelSize = 'default' | 'wide';

export interface SidePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "default" ≈ 640px, "wide" 1080px (for Decks). */
  size?: SidePanelSize;
  /** Subcomponent slots (Header/Tabs/Body/Footer) plus any other content. */
  children: React.ReactNode;
  /** Optional className passed to the inner SheetContent. */
  className?: string;
  /** Accessible label for the underlying Radix dialog. */
  ariaLabel?: string;
}

/**
 * Admin drawer chrome on top of shadcn `Sheet`.
 *
 * Hides Sheet's built-in absolute close button so the consumer can place
 * its own close button inside `SidePanel.Header`. Esc + click-outside still
 * close (Radix Dialog defaults).
 *
 * Use subcomponent composition:
 *
 *   <SidePanel open={isOpen} onOpenChange={setOpen} size="wide">
 *     <SidePanel.Header>…</SidePanel.Header>
 *     <SidePanel.Tabs>…</SidePanel.Tabs>
 *     <SidePanel.Body>…</SidePanel.Body>
 *     <SidePanel.Footer>…</SidePanel.Footer>
 *   </SidePanel>
 */
function SidePanelRoot({
  open,
  onOpenChange,
  size = 'default',
  children,
  className,
  ariaLabel = 'Side panel',
}: SidePanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        aria-label={ariaLabel}
        className={cn(
          // Layout: full height flex column so Header/Tabs/Body/Footer stack.
          'flex h-full flex-col gap-0 p-0',
          // Width by size.
          size === 'wide' ? 'w-[95vw] sm:!max-w-[1080px]' : 'w-[95vw] sm:!max-w-[640px]',
          // Hide Sheet's built-in absolute close button (Radix Dialog Close).
          '[&>button.absolute]:hidden',
          className
        )}
      >
        {/*
          Radix Dialog requires a DialogTitle for screen readers. The visible
          title lives in <SidePanel.Header>; this is a hidden a11y-only title
          driven by the `ariaLabel` prop.
        */}
        <VisuallyHidden.Root asChild>
          <SheetTitle>{ariaLabel}</SheetTitle>
        </VisuallyHidden.Root>
        {children}
      </SheetContent>
    </Sheet>
  );
}

const SidePanelHeader = ({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('drawer-head', className)} {...rest}>
    {children}
  </div>
);
SidePanelHeader.displayName = 'SidePanel.Header';

const SidePanelTabs = ({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('drawer-tabs', className)} {...rest}>
    {children}
  </div>
);
SidePanelTabs.displayName = 'SidePanel.Tabs';

const SidePanelBody = ({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('drawer-body', className)} {...rest}>
    {children}
  </div>
);
SidePanelBody.displayName = 'SidePanel.Body';

const SidePanelFooter = ({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('drawer-foot', className)} {...rest}>
    {children}
  </div>
);
SidePanelFooter.displayName = 'SidePanel.Footer';

type SidePanelComponent = typeof SidePanelRoot & {
  Header: typeof SidePanelHeader;
  Tabs: typeof SidePanelTabs;
  Body: typeof SidePanelBody;
  Footer: typeof SidePanelFooter;
};

export const SidePanel = SidePanelRoot as SidePanelComponent;
SidePanel.Header = SidePanelHeader;
SidePanel.Tabs = SidePanelTabs;
SidePanel.Body = SidePanelBody;
SidePanel.Footer = SidePanelFooter;
