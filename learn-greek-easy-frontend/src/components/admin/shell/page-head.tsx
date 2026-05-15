import * as React from 'react';

import { cn } from '@/lib/utils';

export interface PageHeadBreadcrumbItem {
  /** Translated label. */
  label: React.ReactNode;
  /** When set, the segment renders as a clickable <button> that fires onClick. */
  onClick?: () => void;
}

export interface PageHeadProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /**
   * Breadcrumb trail. Last item is rendered as plain text (not clickable)
   * regardless of `onClick`. Pass empty array or omit to hide the breadcrumb row.
   */
  breadcrumb?: PageHeadBreadcrumbItem[];
  /**
   * Eyebrow above the title. Pass the `Kicker` atom from ADMIN2-01 directly:
   *   <Kicker dot="amber">Needs your attention</Kicker>
   * Or omit to hide.
   */
  kicker?: React.ReactNode;
  /** Page title (h1). Required. */
  title: React.ReactNode;
  /**
   * Sub-title paragraph. ReactNode so callers can embed counts, bold spans, etc.
   * Omit to hide.
   */
  sub?: React.ReactNode;
  /**
   * Right-side action cluster. Pass any node; typically 1-3 buttons.
   * Omit to hide the action region.
   */
  actions?: React.ReactNode;
  /**
   * Optional data-testid forwarded to the <h1> element.
   * Used to preserve Playwright e2e selectors (e.g. "admin-title") when
   * the inline page header is replaced by <PageHead>.
   */
  titleTestId?: string;
  /**
   * Optional data-testid forwarded to the <p class="va-sub"> element.
   * Used to preserve Playwright e2e selectors (e.g. "admin-subtitle").
   */
  subTestId?: string;
}

export const PageHead = React.forwardRef<HTMLDivElement, PageHeadProps>(
  (
    { breadcrumb, kicker, title, sub, actions, titleTestId, subTestId, className, ...rest },
    ref
  ) => {
    const hasBreadcrumb = breadcrumb && breadcrumb.length > 0;
    const lastIndex = hasBreadcrumb ? breadcrumb.length - 1 : -1;

    return (
      <div ref={ref} className={cn('va-page-head', className)} {...rest}>
        {/* Left column */}
        <div>
          {hasBreadcrumb && (
            <div className="va-bcrumb" aria-label="Breadcrumb">
              {breadcrumb.map((item, i) => (
                <React.Fragment key={i}>
                  {i === lastIndex ? (
                    <span aria-current="page">{item.label}</span>
                  ) : item.onClick ? (
                    <button type="button" onClick={item.onClick}>
                      {item.label}
                    </button>
                  ) : (
                    <span>{item.label}</span>
                  )}
                  {i < lastIndex && <span> / </span>}
                </React.Fragment>
              ))}
            </div>
          )}

          {kicker !== undefined && kicker}

          <h1 className="va-h1" {...(titleTestId ? { 'data-testid': titleTestId } : {})}>
            {title}
          </h1>

          {sub !== undefined && (
            <p className="va-sub" {...(subTestId ? { 'data-testid': subTestId } : {})}>
              {sub}
            </p>
          )}
        </div>

        {/* Right column */}
        {actions !== undefined && <div className="va-page-actions">{actions}</div>}
      </div>
    );
  }
);

PageHead.displayName = 'PageHead';
