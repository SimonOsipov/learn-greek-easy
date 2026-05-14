import * as React from 'react';

import { cn } from '@/lib/utils';

export type SectionTabTone = 'amber' | 'default';

export interface SectionTabItem<K extends string = string> {
  key: K;
  /** Translated label. */
  label: React.ReactNode;
  /** Count badge. Always rendered (even when 0). */
  count: number;
  /** Visual tone for the count pill. Defaults to 'default'. */
  tone?: SectionTabTone;
}

export interface SectionTabsProps<K extends string = string>
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  tabs: SectionTabItem<K>[];
  active: K;
  onTabChange: (tab: K) => void;
}

export function SectionTabs<K extends string = string>({
  tabs,
  active,
  onTabChange,
  className,
  ...rest
}: SectionTabsProps<K>) {
  return (
    <div className={cn('va-tabs', className)} role="tablist" {...rest}>
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        const tone = tab.tone ?? 'default';
        const isAttn = tone === 'amber' && tab.count > 0;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={cn('va-tab', isActive && 'is-active')}
            onClick={() => onTabChange(tab.key)}
          >
            <span>{tab.label}</span>
            <span
              className={cn('va-tab-n', tone === 'amber' && 'tone-amber', isAttn && 'is-attn')}
              aria-hidden="true"
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

SectionTabs.displayName = 'SectionTabs';
