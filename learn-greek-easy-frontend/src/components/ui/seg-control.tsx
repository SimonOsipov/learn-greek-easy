import * as React from 'react';

import { cn } from '@/lib/utils';

export interface SegOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  /** Optional trailing count, e.g. "All 12". */
  count?: number;
}

export interface SegControlProps<T extends string = string>
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Uppercase eyebrow label rendered before the buttons. */
  label?: string;
  options: SegOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SegControl<T extends string = string>({
  label,
  options,
  value,
  onChange,
  className,
  ...rest
}: SegControlProps<T>) {
  return (
    <div className={cn('news-seg', className)} {...rest}>
      {label ? <span className="news-seg-l">{label}</span> : null}
      <div className="news-seg-btns" role="tablist">
        {options.map((opt) => {
          const isActive = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-pressed={isActive}
              className={cn('news-seg-btn', isActive && 'is-active')}
              onClick={() => onChange(opt.value)}
            >
              {opt.label}
              {typeof opt.count === 'number' ? <span className="cl-tag-n">{opt.count}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

SegControl.displayName = 'SegControl';
