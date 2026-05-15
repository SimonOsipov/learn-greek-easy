import * as React from 'react';

import { cn } from '@/lib/utils';
import type { AdminTabType } from '@/pages/admin/types';

export interface SectionTabItem {
  key: AdminTabType;
  label: React.ReactNode;
  count: number;
  tone?: 'amber' | 'default';
}

export interface SectionTabsProps extends React.HTMLAttributes<HTMLDivElement> {
  tabs: SectionTabItem[];
  active: AdminTabType;
  onTabChange: (tab: AdminTabType) => void;
}

export const SectionTabs = React.forwardRef<HTMLDivElement, SectionTabsProps>(
  ({ tabs, active, onTabChange, className, ...rest }, ref) => {
    return (
      <div ref={ref} role="tablist" className={cn('va-tabs', className)} {...rest}>
        {tabs.map(({ key, label, count, tone = 'default' }) => {
          const isActive = key === active;
          const showAttn = tone === 'amber' && count > 0;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={cn('va-tab', isActive && 'is-active')}
              onClick={() => onTabChange(key)}
            >
              <span>{label}</span>
              <span className={cn('va-tab-n', `tone-${tone}`, showAttn && 'is-attn')}>{count}</span>
            </button>
          );
        })}
      </div>
    );
  }
);

SectionTabs.displayName = 'SectionTabs';
