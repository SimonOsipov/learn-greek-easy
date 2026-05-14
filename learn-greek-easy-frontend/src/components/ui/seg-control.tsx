import { cn } from '@/lib/utils';

export type SegOption<T extends string = string> = {
  value: T;
  label: string;
  count?: number;
};

export type SegControlProps<T extends string = string> = {
  options: SegOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
  className?: string;
};

export function SegControl<T extends string = string>({
  options,
  value,
  onChange,
  label,
  className,
}: SegControlProps<T>) {
  return (
    <div className={cn('news-seg', className)}>
      {label ? <span className="news-seg-l">{label}</span> : null}
      <div className="news-seg-btns" role={label ? 'group' : undefined} aria-label={label}>
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              className={cn('news-seg-btn', active && 'is-active')}
              aria-pressed={active}
              onClick={() => onChange(opt.value)}
            >
              {opt.label}
              {opt.count !== undefined ? <span className="cl-tag-n">{opt.count}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
