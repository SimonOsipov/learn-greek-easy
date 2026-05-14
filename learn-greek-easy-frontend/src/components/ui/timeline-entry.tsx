import * as React from 'react';

import { renderInlineMarkdown } from '@/lib/markdown-inline';
import { cn } from '@/lib/utils';

/**
 * Tone variants that map to `.cl-entry-dot.tone-{tone}` CSS classes
 * defined by ATOM-01 in `src/index.css`.
 */
export type TimelineTone = 'blue' | 'green' | 'amber' | 'cyan' | 'violet' | 'red';

export interface TimelineEntryProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  /** Dot colour variant — must match one of the six ATOM-01 CSS tones. */
  tone: TimelineTone;
  /** Primary heading of the entry. */
  title: React.ReactNode;
  /** Optional secondary / translated title (renders in `.cl-entry-title-ru`). */
  subtitle?: React.ReactNode;
  /** Markdown body string. `**bold**` → `<b>`, `*italic*` → `<i>`. Raw HTML is escaped. */
  body: string;
  /** Slot for date/tag/meta content in the left column of the header row. */
  header?: React.ReactNode;
  /** Slot for action buttons / links. Clicks here never bubble to the entry-level handler. */
  actions?: React.ReactNode;
  /**
   * When provided, the root `<article>` becomes keyboard-activatable:
   * `role="button"`, `tabIndex={0}`, Enter and Space fire this callback.
   */
  onClick?: () => void;
  className?: string;
}

/**
 * Changelog row atom (ATOM-09).
 *
 * Renders a left-rail coloured dot, a header row with optional meta + action
 * slots, a title/subtitle pair, and an inline-markdown body. Matches the
 * `.cl-entry` family shipped in ATOM-01.
 */
const TimelineEntry = React.forwardRef<HTMLElement, TimelineEntryProps>(
  ({ tone, title, subtitle, body, header, actions, onClick, className, ...rest }, ref) => {
    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLElement>) => {
        if (!onClick) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      },
      [onClick]
    );

    const interactiveProps = onClick
      ? {
          role: 'button' as const,
          tabIndex: 0,
          onClick,
          onKeyDown: handleKeyDown,
        }
      : {};

    return (
      <article ref={ref} className={cn('cl-entry', className)} {...interactiveProps} {...rest}>
        <div className="cl-entry-rail">
          <span className={cn('cl-entry-dot', `tone-${tone}`)} />
        </div>
        <div className="cl-entry-body">
          <div className="cl-entry-head">
            <div className="cl-entry-l">{header}</div>
            {actions ? (
              <div
                className="cl-entry-actions"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                {actions}
              </div>
            ) : null}
          </div>
          <h3 className="cl-entry-title">{title}</h3>
          {subtitle ? <p className="cl-entry-title-ru">{subtitle}</p> : null}
          <div className="cl-entry-content">{renderInlineMarkdown(body)}</div>
        </div>
      </article>
    );
  }
);
TimelineEntry.displayName = 'TimelineEntry';

export { TimelineEntry };
