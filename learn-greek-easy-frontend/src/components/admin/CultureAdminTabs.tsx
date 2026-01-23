// src/components/admin/CultureAdminTabs.tsx

import React, { useState } from 'react';

import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { CultureDeckStats } from '@/services/adminAPI';

import { CultureBadge, type CultureCategory } from '../culture';
import { NewsSourcesSection } from './NewsSourcesSection';

type TabType = 'decks' | 'news';

interface CultureAdminTabsProps {
  cultureDecks: CultureDeckStats[];
  t: (key: string, options?: { count: number }) => string;
}

/**
 * Culture deck list item component
 */
interface CultureDeckListItemProps {
  deck: CultureDeckStats;
  t: (key: string, options?: { count: number }) => string;
}

const CultureDeckListItem: React.FC<CultureDeckListItemProps> = ({ deck, t }) => (
  <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50">
    <div className="flex items-center gap-3">
      <CultureBadge category={deck.category as CultureCategory} />
      <span className="font-medium">{deck.name}</span>
    </div>
    <span className="text-sm text-muted-foreground">
      {t('deck.questionCount', { count: deck.question_count })}
    </span>
  </div>
);

/**
 * Tabbed container for Culture admin section.
 *
 * Features:
 * - "Decks" tab showing culture deck list
 * - "News" tab showing NewsSourcesSection
 * - Button-based tab pattern (like TenseTabs)
 * - Default to "Decks" tab (no persistence)
 */
export const CultureAdminTabs: React.FC<CultureAdminTabsProps> = ({ cultureDecks, t }) => {
  const { t: adminT } = useTranslation('admin');
  const [selectedTab, setSelectedTab] = useState<TabType>('decks');

  const tabs: TabType[] = ['decks', 'news'];

  return (
    <Card data-testid="culture-admin-tabs">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle id="culture-admin-heading" data-testid="culture-admin-title">
              {adminT('sections.cultureDecks')}
            </CardTitle>
            <CardDescription data-testid="culture-admin-description">
              {adminT('sections.cultureDecksDescription')}
            </CardDescription>
          </div>
          {/* Tab buttons */}
          <div
            className="flex gap-2 rounded-lg bg-muted p-1"
            data-testid="culture-admin-tab-buttons"
          >
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setSelectedTab(tab)}
                className={cn(
                  'rounded-md px-4 py-2 text-sm font-medium transition-all',
                  selectedTab === tab
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
                )}
                aria-pressed={selectedTab === tab}
                type="button"
                data-testid={`culture-tab-${tab}`}
              >
                {adminT(`sources.tabs.${tab}`)}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Decks Tab Content */}
        {selectedTab === 'decks' && (
          <div data-testid="culture-decks-content">
            {cultureDecks.length === 0 ? (
              <p className="py-4 text-center text-muted-foreground">
                {adminT('states.noCultureDecks')}
              </p>
            ) : (
              <div className="space-y-3">
                {cultureDecks.map((deck) => (
                  <CultureDeckListItem key={deck.id} deck={deck} t={t} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* News Tab Content */}
        {selectedTab === 'news' && (
          <div data-testid="culture-news-content" className="-m-6">
            <NewsSourcesSection />
          </div>
        )}
      </CardContent>
    </Card>
  );
};
