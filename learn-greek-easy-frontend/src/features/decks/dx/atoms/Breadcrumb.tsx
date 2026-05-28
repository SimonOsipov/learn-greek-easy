import React from 'react';

import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  /** If provided, renders as a link; omit for the last (current) item */
  to?: string;
}

export interface BreadcrumbProps {
  trail: BreadcrumbItem[];
}

/**
 * Breadcrumb — navigational trail.
 * Last item is rendered as plain text (current page, no link).
 * Intermediate items render as react-router Links.
 */
export function Breadcrumb({ trail }: BreadcrumbProps) {
  return (
    <nav className="dx-bcrumb" aria-label="Breadcrumb">
      {trail.map((item, i) => {
        const isLast = i === trail.length - 1;
        return (
          <React.Fragment key={i}>
            {i > 0 && <ChevronRight className="dx-bcrumb-sep" aria-hidden="true" />}
            {isLast ? (
              <span className="dx-bcrumb-cur" aria-current="page">
                {item.label}
              </span>
            ) : (
              <Link to={item.to ?? '#'}>{item.label}</Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
