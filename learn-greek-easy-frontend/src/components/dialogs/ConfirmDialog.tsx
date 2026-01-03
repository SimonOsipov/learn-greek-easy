import React, { useState } from 'react';

import { AlertTriangle, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { reportAPIError } from '@/lib/errorReporting';
import { cn } from '@/lib/utils';

export interface ConfirmDialogProps {
  /** Controls dialog open state (controlled mode) */
  open?: boolean;
  /** Callback when dialog open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Optional trigger element (for uncontrolled mode) */
  trigger?: React.ReactNode;
  /** Dialog title */
  title: string;
  /** Dialog description/message */
  description: string;
  /** Text for confirm button (default: "Confirm") */
  confirmText?: string;
  /** Text for cancel button (default: "Cancel") */
  cancelText?: string;
  /** Callback when user confirms */
  onConfirm: () => void | Promise<void>;
  /** Optional callback when user cancels */
  onCancel?: () => void;
  /** Visual variant (default: "default", destructive: red styling) */
  variant?: 'default' | 'destructive';
  /** External loading state (optional, component manages internal loading) */
  loading?: boolean;
  /** Optional custom icon (overrides default variant icon) */
  icon?: React.ReactNode;
}

/**
 * Reusable confirmation dialog for actions requiring user confirmation
 *
 * Supports both controlled and uncontrolled usage:
 * - Controlled: Pass `open` and `onOpenChange` props
 * - Uncontrolled: Pass `trigger` prop
 *
 * Features:
 * - Automatic loading state during async operations
 * - Variant support (default/destructive)
 * - Custom icons
 * - Keyboard navigation (Escape to close)
 * - Focus management
 *
 * @example
 * // Controlled usage
 * <ConfirmDialog
 *   open={showDialog}
 *   onOpenChange={setShowDialog}
 *   title="Delete Deck"
 *   description="This action cannot be undone."
 *   onConfirm={handleDelete}
 *   variant="destructive"
 * />
 *
 * @example
 * // Uncontrolled usage with trigger
 * <ConfirmDialog
 *   trigger={<Button>Delete</Button>}
 *   title="Delete Deck"
 *   description="This action cannot be undone."
 *   onConfirm={handleDelete}
 *   variant="destructive"
 * />
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'default',
  loading: externalLoading,
  icon,
}) => {
  const [internalLoading, setInternalLoading] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);

  // Use external loading if provided, otherwise use internal
  const loading = externalLoading ?? internalLoading;

  // Use controlled open state if provided, otherwise use internal
  const isOpen = open ?? internalOpen;
  const setIsOpen = onOpenChange ?? setInternalOpen;

  const handleConfirm = async () => {
    setInternalLoading(true);
    try {
      await onConfirm();
      // Close dialog after successful confirmation
      setIsOpen(false);
    } catch (error) {
      // Error should be handled by caller
      reportAPIError(error, { operation: 'confirmDialogAction' });
    } finally {
      setInternalLoading(false);
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    onCancel?.();
  };

  const dialogContent = (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle
          className={cn('flex items-center gap-2', variant === 'destructive' && 'text-red-600')}
        >
          {icon || (variant === 'destructive' && <AlertTriangle className="h-5 w-5" />)}
          {title}
        </DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      <DialogFooter className="gap-2 sm:justify-start">
        <Button variant="outline" onClick={handleCancel} disabled={loading}>
          {cancelText}
        </Button>
        <Button
          variant={variant === 'destructive' ? 'destructive' : 'default'}
          onClick={handleConfirm}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            confirmText
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  );

  // Uncontrolled mode with trigger
  if (trigger) {
    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        {dialogContent}
      </Dialog>
    );
  }

  // Controlled mode
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {dialogContent}
    </Dialog>
  );
};
