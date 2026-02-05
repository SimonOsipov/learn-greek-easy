// src/features/decks/components/V2DeckPage/WordBrowser.tsx

import { BookText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Card, CardContent } from '@/components/ui/card';

/**
 * Props for WordBrowser component.
 */
interface WordBrowserProps {
  deckId: string;
}

/**
 * WordBrowser Component (Placeholder)
 *
 * Displays a placeholder for the word entries browser.
 * Full implementation with search, filters, and word grid in DUAL-07.
 */
export const WordBrowser: React.FC<WordBrowserProps> = ({ deckId: _deckId }) => {
  const { t } = useTranslation('deck');

  return (
    <Card>
      <CardContent className="py-12 text-center">
        <BookText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="text-lg font-medium">{t('v2.wordBrowserTitle')}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{t('v2.wordBrowserPlaceholder')}</p>
      </CardContent>
    </Card>
  );
};
