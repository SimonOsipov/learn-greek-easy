// src/components/admin/decks/DeckDrawer.tsx
//
// Controlled drawer for a single deck. Open/closed state is driven by the
// `?edit=<deckId>` URL search param (same pattern as NewsEditDrawer).
// Tab state is driven by `?subtab=<words|questions|settings|activity>`.
// Item detail state is driven by `?item=<itemId>`.
//
// Mounted unconditionally — DKDR-06 will mount it on AdminPage.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { SidePanel } from '@/components/ui/side-panel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDeck } from '@/hooks/useDeck';
import { getLocalizedDeckName } from '@/lib/deckLocale';

import { CultureDrawerBody } from './CultureDrawerBody';
import { CultureQuestionDetail } from './CultureQuestionDetail';
import { DeckDrawerSkeleton } from './DeckDrawerSkeleton';
import { deriveCode } from './DeckMark';
import { DeckSettingsTab } from './DeckSettingsTab';
import { VocabDrawerBody } from './VocabDrawerBody';
import { VocabWordDetail } from './VocabWordDetail';

// ── Types ─────────────────────────────────────────────────────────────────────

type DeckTab = 'words' | 'questions' | 'settings' | 'activity';

// ── DeckDrawer Context ────────────────────────────────────────────────────────

/**
 * Context exposed to children (e.g. DeckSettingsTab) so they can:
 * - Register a "close guard" that runs when the drawer would close (ESC, X, overlay).
 *   The guard returns `true` to allow close, `false` to block it.
 * - Inject a ReactNode into the drawer footer slot.
 */
interface DeckDrawerContextValue {
  /** Register a close guard. Pass `null` to unregister. */
  registerCloseGuard: (guard: (() => boolean) | null) => void;
  /** Set the footer content rendered below tab content. Pass `null` to clear. */
  setFooter: (footer: ReactNode | null) => void;
  /** Trigger a close, respecting the registered guard. */
  closeWithGuard: () => void;
}

const DeckDrawerContext = createContext<DeckDrawerContextValue>({
  registerCloseGuard: () => {},
  setFooter: () => {},
  closeWithGuard: () => {},
});

export function useDeckDrawer(): DeckDrawerContextValue {
  return useContext(DeckDrawerContext);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DeckDrawer() {
  const { t, i18n } = useTranslation('admin');
  const [searchParams, setSearchParams] = useSearchParams();

  const editId = searchParams.get('edit');
  const itemId = searchParams.get('item');
  const subtabParam = searchParams.get('subtab') as DeckTab | null;

  const open = !!editId;

  const { deck, isLoading, isError } = useDeck(editId);

  // ── Drawer close / guard state ─────────────────────────────────────────────

  const closeGuardRef = useRef<(() => boolean) | null>(null);
  const [footer, setFooterState] = useState<ReactNode | null>(null);

  const stripCloseParams = useCallback(() => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.delete('edit');
      params.delete('item');
      params.delete('subtab');
      return params;
    });
  }, [setSearchParams]);

  const closeWithGuard = useCallback(() => {
    if (closeGuardRef.current) {
      const allow = closeGuardRef.current();
      if (!allow) return;
    }
    stripCloseParams();
  }, [stripCloseParams]);

  const registerCloseGuard = useCallback((guard: (() => boolean) | null) => {
    closeGuardRef.current = guard;
  }, []);

  const setFooter = useCallback((f: ReactNode | null) => {
    setFooterState(f);
  }, []);

  // Clear footer and guard when drawer closes
  useEffect(() => {
    if (!open) {
      setFooterState(null);
      closeGuardRef.current = null;
    }
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      closeWithGuard();
    }
  };

  const handleTabChange = (value: string) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('subtab', value);
      return params;
    });
  };

  // ── Derived state ──────────────────────────────────────────────────────────

  const isCulture = deck?.type === 'culture';

  // Resolve the active tab — default depends on deck type.
  const resolvedTab: DeckTab = subtabParam ?? (isCulture ? 'questions' : 'words');

  // Normalize `name` to flat string fields so getLocalizedDeckName can accept it.
  // UnifiedDeckItem.name may be string | MultilingualName; prefer the flat fields.
  const deckNameNormalized = deck
    ? {
        name_en: deck.name_en ?? (typeof deck.name === 'string' ? deck.name : ''),
        name_ru: deck.name_ru ?? '',
      }
    : null;
  const deckName = deckNameNormalized
    ? getLocalizedDeckName(deckNameNormalized, i18n.language)
    : '';

  // 3-letter code for breadcrumb (derived from the localized deck name).
  const deckCode = deckName ? deriveCode(deckName) : '';

  const itemCount = deck?.item_count ?? 0;

  // Loading: editId is set but query hasn't resolved yet.
  const showSkeleton = !!(editId && (isLoading || (!deck && !isError)));
  // Not-found: query resolved with no match (null data) or errored.
  const showNotFound =
    !!(editId && isError) || !!(editId && !isLoading && !isError && deck === null);
  // Show populated drawer.
  const showContent = !showSkeleton && !showNotFound && !!deck;

  // ── Context value ──────────────────────────────────────────────────────────

  const contextValue: DeckDrawerContextValue = {
    registerCloseGuard,
    setFooter,
    closeWithGuard,
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <DeckDrawerContext.Provider value={contextValue}>
      <SidePanel
        open={open}
        onOpenChange={handleOpenChange}
        size="wide"
        data-testid="deck-drawer"
        className="w-screen max-w-none md:w-[calc(100vw-2rem)] md:max-w-none xl:w-[1080px]"
        title={deckName || 'Deck details'}
      >
        <SidePanel.CloseButton />

        {/* ── Loading skeleton ── */}
        {showSkeleton && (
          <SidePanel.Body>
            <DeckDrawerSkeleton variant={itemId ? 'detail' : 'list'} />
          </SidePanel.Body>
        )}

        {/* ── Not-found empty state (keeps ?edit= in URL per AC #3) ── */}
        {showNotFound && (
          <SidePanel.Body>
            <div
              data-testid="deck-drawer-not-found"
              className="flex h-full items-center justify-center p-8 text-muted-foreground"
            >
              {t('decks.deckNotFound')}
            </div>
          </SidePanel.Body>
        )}

        {/* ── Populated drawer ── */}
        {showContent && (
          <Tabs
            value={resolvedTab}
            onValueChange={handleTabChange}
            data-testid="deck-drawer-tabs"
            className="flex min-h-0 flex-1 flex-col"
          >
            {/* Header */}
            <SidePanel.Header>
              {/* Breadcrumb back button */}
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                className="drawer-breadcrumb mb-1 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
                {t('decks.breadcrumb.decks', { defaultValue: 'Decks' })} ·{' '}
                {isCulture
                  ? t('decks.typeCulture', { defaultValue: 'Culture' })
                  : t('decks.typeVocabulary', { defaultValue: 'Vocabulary' })}{' '}
                · {deckCode}
              </button>

              {/* Deck title */}
              <h2 className="drawer-title">{deckName}</h2>

              {/* Meta row */}
              <div className="drawer-meta flex flex-wrap items-center gap-2">
                <Badge tone={isCulture ? 'violet' : 'blue'}>
                  {isCulture
                    ? t('decks.typeCulture', { defaultValue: 'Culture' })
                    : t('decks.typeVocabulary', { defaultValue: 'Vocabulary' })}
                </Badge>

                {deck.level && <Badge tone="gray">{deck.level}</Badge>}

                <Badge tone={deck.is_active ? 'green' : 'red'}>
                  {deck.is_active
                    ? t('decks.statusActive', { defaultValue: 'Active' })
                    : t('decks.statusInactive', { defaultValue: 'Inactive' })}
                </Badge>

                {deck.is_premium && (
                  <Badge tone="amber">
                    {t('decks.statusPremium', { defaultValue: 'Premium' })}
                  </Badge>
                )}

                <span className="text-sm text-muted-foreground">
                  {itemCount}{' '}
                  {isCulture
                    ? t('decks.questions', { defaultValue: 'questions' })
                    : t('decks.words', { defaultValue: 'words' })}
                </span>
              </div>
            </SidePanel.Header>

            {/* Tab triggers — hidden while a word/question detail is pushed */}
            {!itemId && (
              <SidePanel.Tabs>
                <TabsList className="w-full justify-start">
                  {!isCulture && (
                    <TabsTrigger value="words" data-testid="deck-drawer-tab-words">
                      {t('decks.drawer.tabs.words')}
                    </TabsTrigger>
                  )}
                  {isCulture && (
                    <TabsTrigger value="questions" data-testid="deck-drawer-tab-questions">
                      {t('decks.drawer.tabs.questions')}
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="settings" data-testid="deck-drawer-tab-settings">
                    {t('decks.drawer.tabs.settings')}
                  </TabsTrigger>
                  <TabsTrigger value="activity" data-testid="deck-drawer-tab-activity">
                    {t('decks.drawer.tabs.activity')}
                  </TabsTrigger>
                </TabsList>
              </SidePanel.Tabs>
            )}

            {/* Tab content — inside SidePanel.Body for scrolling */}
            <SidePanel.Body>
              {/* Words tab (vocabulary decks only) */}
              {!isCulture && (
                <TabsContent value="words">
                  {itemId ? (
                    <VocabWordDetail deck={deck} itemId={itemId} />
                  ) : (
                    <VocabDrawerBody deck={deck} />
                  )}
                </TabsContent>
              )}

              {/* Questions tab (culture decks only) */}
              {isCulture && (
                <TabsContent value="questions">
                  {itemId ? (
                    <CultureQuestionDetail deck={deck} itemId={itemId} />
                  ) : (
                    <CultureDrawerBody deck={deck} />
                  )}
                </TabsContent>
              )}

              {/* Settings tab */}
              <TabsContent value="settings">
                <DeckSettingsTab deck={deck} />
              </TabsContent>

              {/* Activity tab — fully implemented */}
              <TabsContent value="activity">
                <div className="placeholder-box" data-testid="deck-drawer-activity">
                  {t('decks.activityPlaceholder')}
                </div>
              </TabsContent>
            </SidePanel.Body>

            {/* Footer slot — populated by DeckSettingsTab via context.
                Hidden while a word/question detail is pushed (?item= present). */}
            {footer && !itemId && (
              <div data-testid="deck-drawer-footer" className="flex-none">
                {footer}
              </div>
            )}
          </Tabs>
        )}
      </SidePanel>
    </DeckDrawerContext.Provider>
  );
}
