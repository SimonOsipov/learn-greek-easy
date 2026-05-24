// src/components/admin/StatusGrid.tsx
//
// Generic status-picker grid primitive.
// Used by FeedbackDrawer (with feedback statuses) and by the Card Errors
// Review tab (CER-29, with card-error statuses). Each caller supplies its
// own options array; the component owns only the wrapper DOM + click handling.

import { cn } from '@/lib/utils';

export type StatusOption<T extends string> = {
  key: T;
  /** Already-localized label string — call t() at the call site. */
  label: string;
  /** Semantic dot-tone class, e.g. 'primary', 'amber', 'success'. */
  dotTone: string;
};

export type StatusGridProps<T extends string> = {
  options: StatusOption<T>[];
  value: T;
  onChange: (next: T) => void;
  /** Optional extra class applied to the wrapper (spacing / override). */
  className?: string;
};

export function StatusGrid<T extends string>({
  options,
  value,
  onChange,
  className,
}: StatusGridProps<T>) {
  return (
    <div className={cn('admin-status-grid', className)} role="radiogroup">
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            role="radio"
            aria-checked={active}
            data-active={active || undefined}
            className={cn('admin-status-btn', active && 'is-active')}
            onClick={() => onChange(opt.key)}
          >
            <span className="admin-status-dot" data-tone={opt.dotTone} />
            <span className="admin-status-label">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
