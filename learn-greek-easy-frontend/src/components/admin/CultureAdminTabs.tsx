// src/components/admin/CultureAdminTabs.tsx

import React from 'react';

import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { CultureDeckStats } from '@/services/adminAPI';

import { CultureBadge, type CultureCategory } from '../culture';

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
 * Culture decks list component.
 *
 * Displays all culture decks organized by category.
 * Tab switching is now handled at the AdminPage level.
 */
export const CultureAdminTabs: React.FC<CultureAdminTabsProps> = ({ cultureDecks, t }) => {
  const { t: adminT } = useTranslation('admin');

  return (
    <Card data-testid="culture-admin-tabs">
      <CardHeader>
        <CardTitle id="culture-admin-heading" data-testid="culture-admin-title">
          {adminT('sections.cultureDecks')}
        </CardTitle>
        <CardDescription data-testid="culture-admin-description">
          {adminT('sections.cultureDecksDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
};
