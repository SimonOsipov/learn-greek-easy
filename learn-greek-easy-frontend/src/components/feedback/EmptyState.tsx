import React from 'react';

import { InboxIcon, type LucideProps } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Props for the EmptyState component
 */
export interface EmptyStateProps {
  /** Icon component to display (default: InboxIcon) */
  icon?: React.ComponentType<LucideProps>;
  /** Title text for the empty state */
  title: string;
  /** Optional description text */
  description?: string;
  /** Optional action button configuration */
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  };
  /** Additional CSS classes */
  className?: string;
}

/**
 * EmptyState component for displaying consistent "no data" states
 *
 * @example
 * ```tsx
 * <EmptyState
 *   icon={BookOpenIcon}
 *   title="No decks yet"
 *   description="Create your first deck to start learning Greek words."
 *   action={{ label: 'Create Deck', onClick: () => setShowCreateDialog(true) }}
 * />
 * ```
 */
export function EmptyState({
  icon: Icon = InboxIcon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex min-h-[400px] flex-col items-center justify-center p-8 text-center',
        className
      )}
      role="status"
      aria-label={title}
    >
      <Icon className="mb-4 h-16 w-16 text-muted-foreground/50" aria-hidden="true" />
      <h3 className="mb-2 text-lg font-semibold text-gray-900">{title}</h3>
      {description && <p className="mb-6 max-w-sm text-muted-foreground">{description}</p>}
      {action && (
        <Button onClick={action.onClick} variant={action.variant || 'default'}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
