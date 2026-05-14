import * as React from 'react';

import { renderInlineMarkdown } from '@/lib/markdown-inline';
import { cn } from '@/lib/utils';

export type TimelineTone = 'blue' | 'green' | 'amber' | 'cyan' | 'violet' | 'red';

export interface TimelineEntryProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  /** Dot color, mapped to `.cl-entry-dot.tone-{tone}`. */
  tone: TimelineTone;
  /** Header row content — typically Badge + version pill + date. */
  header: React.ReactNode;
  /** Headline, rendered in Inter Tight 18px. */
  title: React.ReactNode;
  /** Optional italic subtitle below title (RU translation in Changelog). */
  subtitle?: React.ReactNode;
  /**
   * Body markdown. Supports **bold** and *italic* only. Truncate before passing
   * for previews.
   */
  body: string;
  /** Hover-revealed action buttons (Edit / Delete). */
  actions?: React.ReactNode;
  /** Click handler for the whole entry. */
  onClick?: () => void;
}

export const TimelineEntry = React.forwardRef<HTMLElement, TimelineEntryProps>(
  ({ tone, header, title, subtitle, body, actions, onClick, className, ...rest }, ref) => (
    <article
      ref={ref}
      className={cn('cl-entry', onClick && 'is-clickable', className)}
      onClick={onClick}
      {...rest}
    >
      <div className="cl-entry-rail" aria-hidden="true">
        <span className={cn('cl-entry-dot', `tone-${tone}`)} />
      </div>
      <div className="cl-entry-body">
        <div className="cl-entry-head">
          <div className="cl-entry-l">{header}</div>
          {actions ? (
            <div className="cl-entry-actions" onClick={(e) => e.stopPropagation()}>
              {actions}
            </div>
          ) : null}
        </div>
        <h3 className="cl-entry-title">{title}</h3>
        {subtitle ? <div className="cl-entry-title-ru">{subtitle}</div> : null}
        <div className="cl-entry-content">{renderInlineMarkdown(body)}</div>
      </div>
    </article>
  )
);

TimelineEntry.displayName = 'TimelineEntry';
