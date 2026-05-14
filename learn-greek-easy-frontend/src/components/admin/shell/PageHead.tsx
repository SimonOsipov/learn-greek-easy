import * as React from 'react';

import { cn } from '@/lib/utils';

export interface PageHeadBreadcrumbItem {
  /** Translated label. */
  label: React.ReactNode;
  /** When set, segment renders as a clickable <a>. Last segment is always plain text. */
  onClick?: () => void;
}

export interface PageHeadProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Breadcrumb trail. Final item is plain text regardless of onClick. */
  breadcrumb?: PageHeadBreadcrumbItem[];
  /** Eyebrow above the title. Typically a <Kicker> element. */
  kicker?: React.ReactNode;
  /** Page title (h1). Required. */
  title: React.ReactNode;
  /** Sub-title paragraph below title. */
  sub?: React.ReactNode;
  /** Right-side action cluster (typically 1-3 buttons). */
  actions?: React.ReactNode;
}

export const PageHead = React.forwardRef<HTMLDivElement, PageHeadProps>(
  ({ breadcrumb, kicker, title, sub, actions, className, ...rest }, ref) => {
    const hasBreadcrumb = Array.isArray(breadcrumb) && breadcrumb.length > 0;
    return (
      <div ref={ref} className={cn('va-page-head', className)} {...rest}>
        <div className="va-page-head-l">
          {hasBreadcrumb ? (
            <nav className="va-bcrumb" aria-label="Breadcrumb">
              {breadcrumb!.map((item, i) => {
                const isLast = i === breadcrumb!.length - 1;
                return (
                  <React.Fragment key={i}>
                    {!isLast && item.onClick ? (
                      <a onClick={item.onClick} role="link" tabIndex={0}>
                        {item.label}
                      </a>
                    ) : (
                      <span aria-current={isLast ? 'page' : undefined}>{item.label}</span>
                    )}
                    {!isLast ? <span className="sep">/</span> : null}
                  </React.Fragment>
                );
              })}
            </nav>
          ) : null}
          {kicker ? <div className="va-page-kicker">{kicker}</div> : null}
          <h1 className="va-h1">{title}</h1>
          {sub ? <p className="va-sub">{sub}</p> : null}
        </div>
        {actions ? <div className="va-page-actions">{actions}</div> : null}
      </div>
    );
  }
);

PageHead.displayName = 'PageHead';
