import React from 'react';

import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export interface AlertDialogAction {
  /** Button label */
  label: string;
  /** Click handler */
  onClick: () => void;
  /** Button variant (default: "default") */
  variant?: 'default' | 'destructive' | 'outline';
}

export interface AlertDialogProps {
  /** Controls dialog open state */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Dialog title */
  title: string;
  /** Dialog description/message */
  description: string;
  /** Visual variant for icon and styling */
  variant?: 'info' | 'warning' | 'error' | 'success';
  /** Whether dialog can be dismissed by clicking overlay or Escape (default: true) */
  dismissible?: boolean;
  /** Optional array of action buttons (default: single "OK" button) */
  actions?: AlertDialogAction[];
  /** Optional custom icon (overrides default variant icon) */
  icon?: React.ReactNode;
}

/**
 * Variant configuration for icons and colors
 */
const VARIANT_CONFIG = {
  info: {
    icon: Info,
    color: 'text-blue-600',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-yellow-600',
  },
  error: {
    icon: AlertCircle,
    color: 'text-red-600',
  },
  success: {
    icon: CheckCircle,
    color: 'text-green-600',
  },
};

/**
 * Reusable alert dialog for informational messages and warnings
 *
 * Features:
 * - Multiple variants (info/warning/error/success) with color-coded icons
 * - Flexible action buttons (single or multiple)
 * - Optional non-dismissible mode
 * - Keyboard navigation (Escape to close if dismissible)
 * - Focus management
 * - Accessibility support (ARIA)
 *
 * @example
 * // Simple success message
 * <AlertDialog
 *   open={showSuccess}
 *   onOpenChange={setShowSuccess}
 *   title="Success"
 *   description="Your changes have been saved successfully."
 *   variant="success"
 * />
 *
 * @example
 * // Error with custom actions
 * <AlertDialog
 *   open={!!error}
 *   onOpenChange={() => setError(null)}
 *   title="Error"
 *   description={error}
 *   variant="error"
 *   actions={[
 *     { label: "Retry", onClick: handleRetry, variant: "default" },
 *     { label: "Cancel", onClick: handleCancel, variant: "outline" }
 *   ]}
 * />
 *
 * @example
 * // Non-dismissible warning
 * <AlertDialog
 *   open={showWarning}
 *   onOpenChange={setShowWarning}
 *   title="Session Expiring"
 *   description="Your session will expire soon."
 *   variant="warning"
 *   dismissible={false}
 *   actions={[
 *     { label: "Extend Session", onClick: handleExtend }
 *   ]}
 * />
 */
export const AlertDialog: React.FC<AlertDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  variant = 'info',
  dismissible = true,
  actions,
  icon,
}) => {
  const config = VARIANT_CONFIG[variant];
  const IconComponent = config.icon;

  // Default action if none provided
  const defaultActions: AlertDialogAction[] = [
    {
      label: 'OK',
      onClick: () => onOpenChange?.(false),
      variant: 'default',
    },
  ];

  const finalActions = actions || defaultActions;

  const handleOpenChange = (newOpen: boolean) => {
    // Only allow closing if dismissible
    if (!newOpen && !dismissible) {
      return;
    }
    onOpenChange?.(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={dismissible ? undefined : (e) => e.preventDefault()}
        onEscapeKeyDown={dismissible ? undefined : (e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className={cn('flex items-center gap-2', config.color)}>
            {icon || <IconComponent className="h-5 w-5" />}
            {title}
          </DialogTitle>
          <DialogDescription className="text-left">{description}</DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:justify-end">
          {finalActions.map((action, index) => (
            <Button
              key={index}
              variant={action.variant || 'default'}
              onClick={() => {
                action.onClick();
                // Close dialog after action unless it's non-dismissible
                if (dismissible) {
                  onOpenChange?.(false);
                }
              }}
            >
              {action.label}
            </Button>
          ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
