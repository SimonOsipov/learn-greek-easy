import * as React from 'react';

import { ArrowRight } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * The five tone variants available for StatCard.
 * Note: 'red' is intentionally excluded — only the five tones
 * whose icon + bar CSS is ported in ATOM-01 are supported.
 */
export type StatCardTone = 'blue' | 'violet' | 'amber' | 'cyan' | 'green';

export interface StatCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title' | 'onClick'> {
  /** Top label, e.g. "Decks", "Total articles". */
  title: React.ReactNode;
  /** Sub-label below title. Accepts ReactNode so callers can embed <b>...</b>. */
  sub?: React.ReactNode;
  /** Big number / KPI. String or number; renders in .stat-n (Inter Tight 40px). */
  n: React.ReactNode;
  /**
   * Pre-instantiated lucide icon element, e.g. `<Layers />` (NOT a component
   * reference like `Layers`). The atom wraps it in a `.stat-icon` span that
   * carries `aria-hidden="true"` so callers don't need to pre-mark icons.
   */
  icon: React.ReactNode;
  /** Tone drives icon background tint AND sparkline bar color via .tone-{tone}. */
  tone: StatCardTone;
  /**
   * Sparkline bar heights — raw integers in the input range 1–20.
   * 9 values is conventional (matches the prototype's 9-bar sparkline)
   * but any length is accepted. The atom multiplies each by 1.6 and
   * adds 6px to derive the rendered span height (formula: `value * 1.6 + 6` px).
   * `bars=[]` or `bars=undefined` hides the `.stat-bars` row entirely.
   */
  bars?: number[];
  /**
   * Optional data-testid forwarded to the `.stat-bars` div.
   * Allows tests (and QA selectors) to target the sparkline row per card.
   */
  barsTestId?: string;
  /**
   * When provided, the card becomes clickable: applies `.is-clickable`,
   * sets `role="button"` + `tabIndex={0}`, handles Enter/Space keyboard,
   * and renders the "Open →" arrow link in the footer right slot.
   * When absent, the footer renders `footerLabel` only.
   */
  onClick?: () => void;
  /** Optional override for the footer left text. Defaults to "Last 30 days". */
  footerLabel?: string;
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  (
    { title, sub, n, icon, tone, bars, barsTestId, onClick, footerLabel, className, ...rest },
    ref
  ) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick?.();
      }
    };

    return (
      <div
        ref={ref}
        {...rest}
        className={cn('stat-card', `tone-${tone}`, onClick && 'is-clickable', className)}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={onClick ? handleKeyDown : undefined}
      >
        <div className="stat-head">
          <span className="stat-icon" aria-hidden="true">
            {icon}
          </span>
          <div>
            <div className="stat-label">{title}</div>
            {sub !== undefined && <div className="stat-sub">{sub}</div>}
          </div>
        </div>
        <div className="stat-n">{n}</div>
        {bars && bars.length > 0 && (
          <div className="stat-bars" {...(barsTestId ? { 'data-testid': barsTestId } : {})}>
            {bars.map((h, i) => (
              <span key={i} style={{ height: `${h * 1.6 + 6}px` }} />
            ))}
          </div>
        )}
        <div className="stat-foot">
          <span>{footerLabel ?? 'Last 30 days'}</span>
          {onClick && (
            <span className="stat-link">
              Open <ArrowRight aria-hidden="true" />
            </span>
          )}
        </div>
      </div>
    );
  }
);

StatCard.displayName = 'StatCard';

export { StatCard };
