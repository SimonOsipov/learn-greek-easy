import * as React from 'react';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import { Sheet } from '@/components/ui/sheet';
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
  size?: 'default' | 'wide' | 'full';
  className?: string;
  children: React.ReactNode;
  'data-testid'?: string;
  /** Accessible name for the dialog. Required for screen readers. Rendered via sr-only <Dialog.Title>. */
  title: string;
  /** Optional accessible description. When provided, rendered via sr-only <Dialog.Description>. */
  description?: string;
};

// ── Root component ────────────────────────────────────────────────────────────

function SidePanel({
  open,
  onOpenChange,
  size = 'default',
  className,
  children,
  'data-testid': dataTestId,
  title,
  description,
}: SidePanelProps) {
  if (import.meta.env.DEV && !title) {
    // eslint-disable-next-line no-console
    console.error('[SidePanel] `title` prop is required for accessibility (screen readers).');
  }
  const overlayClass =
    size === 'full'
      ? 'fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
      : 'fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0';

  const contentClass = cn(
    'fixed z-50 gap-4 bg-background shadow-lg transition ease-in-out',
    'inset-y-0 right-0 h-full border-l',
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
    'data-[state=closed]:duration-300 data-[state=open]:duration-500',
    'drawer-wrap flex flex-col gap-0 p-0',
    size === 'wide' && 'w-[95vw] !max-w-[1080px] sm:!max-w-[1080px]',
    size === 'full' && 'h-screen w-screen !max-w-none',
    className
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SidePanelContext.Provider value={{ onOpenChange }}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className={overlayClass} />
          <DialogPrimitive.Content
            data-side-panel=""
            data-size={size}
            data-testid={dataTestId}
            className={contentClass}
            {...(description ? {} : { 'aria-describedby': undefined })}
          >
            <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="sr-only">
                {description}
              </DialogPrimitive.Description>
            ) : null}
            {children}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
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
