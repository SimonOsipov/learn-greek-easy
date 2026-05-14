import * as React from 'react';

import { ArrowRight } from 'lucide-react';

import { cn } from '@/lib/utils';

export type StatCardTone = 'blue' | 'violet' | 'amber' | 'cyan' | 'green' | 'red';

export interface StatCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Top label, e.g. "Decks", "Total articles". */
  title: React.ReactNode;
  /** Sub-label below title. Accepts ReactNode so callers can embed <b>…</b>. */
  sub?: React.ReactNode;
  /** Big number / KPI. */
  n: React.ReactNode;
  /** Lucide icon element (NOT a component reference — pass `<Layers />`). */
  icon: React.ReactNode;
  /** Tone drives icon background tint AND sparkline bar color. */
  tone: StatCardTone;
  /**
   * Sparkline bar heights — raw integers. The atom multiplies each by 1.6
   * and adds 6px to match the prototype. Empty array / undefined hides bars.
   */
  bars?: number[];
  /**
   * When provided, the card becomes clickable and renders the "Open →" footer.
   */
  onClick?: () => void;
  /** Optional override for the footer left text. Defaults to "Last 30 days". */
  footerLabel?: string;
  /** Label for the "Open" link (kept for i18n). Defaults to "Open". */
  openLabel?: string;
}

export const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  (
    {
      title,
      sub,
      n,
      icon,
      tone,
      bars,
      onClick,
      footerLabel = 'Last 30 days',
      openLabel = 'Open',
      className,
      ...rest
    },
    ref
  ) => {
    const clickable = typeof onClick === 'function';
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!clickable) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick!();
      }
    };

    return (
      <div
        ref={ref}
        className={cn('stat-card', `tone-${tone}`, clickable && 'is-clickable', className)}
        onClick={clickable ? onClick : undefined}
        onKeyDown={clickable ? handleKeyDown : undefined}
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        {...rest}
      >
        <div className="stat-head">
          <span className="stat-icon" aria-hidden="true">
            {icon}
          </span>
          <div>
            <div className="stat-label">{title}</div>
            {sub ? <div className="stat-sub">{sub}</div> : null}
          </div>
        </div>
        <div className="stat-n">{n}</div>
        {bars && bars.length > 0 ? (
          <div className="stat-bars" aria-hidden="true">
            {bars.map((h, i) => (
              <span key={i} style={{ height: `${h * 1.6 + 6}px` }} />
            ))}
          </div>
        ) : null}
        <div className="stat-foot">
          <span>{footerLabel}</span>
          {clickable ? (
            <span className="stat-link">
              {openLabel} <ArrowRight />
            </span>
          ) : null}
        </div>
      </div>
    );
  }
);

StatCard.displayName = 'StatCard';
