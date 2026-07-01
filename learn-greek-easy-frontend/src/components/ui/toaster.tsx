import { AlertCircle, Check } from 'lucide-react';

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast';
import { useToast } from '@/hooks/use-toast';

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            {props.variant === 'success' && (
              <span className="aw-toast-icon">
                <Check aria-hidden />
              </span>
            )}
            {props.variant === 'destructive' && (
              <span className="aw-toast-icon">
                <AlertCircle aria-hidden />
              </span>
            )}
            <div className="grid min-w-0 flex-1 gap-1">
              {title && <ToastTitle data-testid="toast-title">{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
