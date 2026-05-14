import * as React from 'react';

import { X } from 'lucide-react';

import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

// ── Context ──────────────────────────────────────────────────────────────────

type SidePanelContextValue = {
  onOpenChange: (open: boolean) => void;
};

const SidePanelContext = React.createContext<SidePanelContextValue | null>(null);

function useSidePanelContext(): SidePanelContextValue {
  const ctx = React.useContext(SidePanelContext);
  if (!ctx) {
    throw new Error('SidePanel.* subcomponents must be rendered inside <SidePanel>');
  }
  return ctx;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type SidePanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  size?: 'default' | 'wide';
  className?: string;
  children: React.ReactNode;
};

// ── Root component ────────────────────────────────────────────────────────────

function SidePanel({ open, onOpenChange, size = 'default', className, children }: SidePanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SidePanelContext.Provider value={{ onOpenChange }}>
        <SheetContent
          side="right"
          data-side-panel=""
          data-size={size}
          className={cn(
            'drawer-wrap flex flex-col gap-0 p-0',
            size === 'wide' && 'w-[95vw] !max-w-[1080px] sm:!max-w-[1080px]',
            className
          )}
        >
          {children}
        </SheetContent>
      </SidePanelContext.Provider>
    </Sheet>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function Header({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('drawer-head', className)} {...props}>
      {children}
    </div>
  );
}

function Tabs({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('drawer-tabs', className)} {...props}>
      {children}
    </div>
  );
}

function Body({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('drawer-body', className)} {...props}>
      {children}
    </div>
  );
}

function Footer({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('drawer-foot', className)} {...props}>
      {children}
    </div>
  );
}

function CloseButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { onOpenChange } = useSidePanelContext();
  return (
    <button
      type="button"
      aria-label="Close"
      onClick={() => onOpenChange(false)}
      className={cn('drawer-close', className)}
      {...props}
    >
      <X className="size-4" aria-hidden="true" />
    </button>
  );
}

// ── Static property attachment ────────────────────────────────────────────────

SidePanel.Header = Header;
SidePanel.Tabs = Tabs;
SidePanel.Body = Body;
SidePanel.Footer = Footer;
SidePanel.CloseButton = CloseButton;

export { SidePanel };
