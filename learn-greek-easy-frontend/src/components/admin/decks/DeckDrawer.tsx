// src/components/admin/decks/DeckDrawer.tsx
//
// Controlled drawer for a single deck. Open/closed state is driven by the
// `?edit=<deckId>` URL search param (same pattern as NewsEditDrawer).
// Tab state is driven by `?subtab=<words|questions|settings>`.
// Item detail state is driven by `?item=<itemId>`.
//
// Mounted unconditionally — DKDR-06 will mount it on AdminPage.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { SidePanel } from '@/components/ui/side-panel';
import { toast } from '@/hooks/use-toast';
import { useDeck } from '@/hooks/useDeck';
import { getLocalizedDeckName } from '@/lib/deckLocale';
import { adminAPI } from '@/services/adminAPI';
import { useAdminTabCountsStore } from '@/stores/adminTabCountsStore';

import { CultureDrawerBody } from './CultureDrawerBody';
import { CultureQuestionDetail } from './CultureQuestionDetail';
import { DeckDrawerSkeleton } from './DeckDrawerSkeleton';
import { deriveCode } from './DeckMark';
import { DeckSettingsTab } from './DeckSettingsTab';
import { DeckDeleteDialog } from '../DeckDeleteDialog';
import { VocabDrawerBody } from './VocabDrawerBody';
import { VocabWordDetail } from './VocabWordDetail';

// ── Types ─────────────────────────────────────────────────────────────────────

type DeckTab = 'words' | 'questions' | 'settings';

// ── DeckDrawer Context ────────────────────────────────────────────────────────

/**
 * Context exposed to children (e.g. DeckSettingsTab) so they can:
 * - Register a "close guard" that runs when the drawer would close (ESC, X, overlay).
 *   The guard returns `true` to allow close, `false` to block it.
 */
interface DeckDrawerContextValue {
  /** Register a close guard. Pass `null` to unregister. */
  registerCloseGuard: (guard: (() => boolean) | null) => void;
  /** Trigger a close, respecting the registered guard. */
  closeWithGuard: () => void;
}

const DeckDrawerContext = createContext<DeckDrawerContextValue>({
  registerCloseGuard: () => {},
  closeWithGuard: () => {},
});

export function useDeckDrawer(): DeckDrawerContextValue {
  return useContext(DeckDrawerContext);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DeckDrawer() {
  const { t, i18n } = useTranslation('admin');
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const editId = searchParams.get('edit');
  const itemId = searchParams.get('item');
  const subtabParam = searchParams.get('subtab');

  const open = !!editId;

  const { deck, isLoading, isError } = useDeck(editId);

  // ── Drawer close / guard state ─────────────────────────────────────────────

  const closeGuardRef = useRef<(() => boolean) | null>(null);

  // ── Delete-deck state (hoisted from DeckSettingsTab) ───────────────────────

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Add-item dialog state (lifted from VocabDrawerBody/CultureDrawerBody) ──

  const [addItemOpen, setAddItemOpen] = useState(false);

  // ── Word-detail unlink (D3b) ───────────────────────────────────────────────

  const [unlinkDialogOpen, setUnlinkDialogOpen] = useState(false);

  const unlinkMutation = useMutation({
    mutationFn: () => {
      if (!deck || !itemId) throw new Error('Missing deck or itemId');
      return adminAPI.unlinkWordEntry(deck.id, itemId);
    },
    onSuccess: () => {
      setUnlinkDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['deck-vocab', deck?.id] });
      // Also refresh the deck-level item count in the drawer header (mirrors delete flow)
      void queryClient.invalidateQueries({ queryKey: ['admin', 'deck', deck?.id] });
      toast({ description: t('wordEntry.unlinkSuccess'), variant: 'success' });
      // Navigate back to word list
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        p.delete('item');
        p.delete('subtab');
        return p;
      });
    },
    onError: () => {
      toast({ description: t('wordEntry.unlinkConfirm'), variant: 'destructive' });
    },
  });

  const popToWordList = useCallback(() => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.delete('item');
      p.delete('subtab');
      return p;
    });
  }, [setSearchParams]);

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

  // Clear guard and add-item dialog when drawer closes
  useEffect(() => {
    if (!open) {
      closeGuardRef.current = null;
      setAddItemOpen(false);
    }
  }, [open]);

  // ── Delete handler ─────────────────────────────────────────────────────────

  const handleDeleteConfirm = useCallback(async () => {
    if (!deck) return;
    setIsDeleting(true);
    try {
      if (deck.type === 'vocabulary') {
        await adminAPI.deleteVocabularyDeck(deck.id);
      } else {
        await adminAPI.deleteCultureDeck(deck.id);
      }
      // Close the drawer by stripping URL params.
      stripCloseParams();
      void queryClient.invalidateQueries({ queryKey: ['admin', 'decks'] });
      void useAdminTabCountsStore.getState().fetchCounts();
      toast({ title: t('toast.deckDeactivated'), variant: 'success' });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errors.saveFailed');
      toast({
        title: t('errors.saveFailed'),
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  }, [deck, stripCloseParams, queryClient, t]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      closeWithGuard();
    }
  };

  const handleTabChange = (value: string) => {
    setAddItemOpen(false);
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('subtab', value);
      return params;
    });
  };

  // ── Derived state ──────────────────────────────────────────────────────────

  const isCulture = deck?.type === 'culture';

  // Resolve the active tab — validate against the DECK-TYPE-appropriate set.
  // This prevents cross-type stale URLs (e.g. ?subtab=words on a culture deck,
  // or ?subtab=questions on a vocab deck) from landing on an empty tab body,
  // because those TabsContent nodes are conditionally rendered per deck type.
  const allowedTabs: DeckTab[] = isCulture ? ['questions', 'settings'] : ['words', 'settings'];
  const resolvedTab: DeckTab =
    subtabParam !== null && allowedTabs.includes(subtabParam as DeckTab)
      ? (subtabParam as DeckTab)
      : isCulture
        ? 'questions'
        : 'words';

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
    closeWithGuard,
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <DeckDrawerContext.Provider value={contextValue}>
      <SidePanel
        open={open}
        onOpenChange={handleOpenChange}
        size="half"
        data-testid="deck-drawer"
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
          <div data-testid="deck-drawer-tabs" className="flex min-h-0 flex-1 flex-col">
            {/* Header */}
            <SidePanel.Header>
              <div className="drawer-head-content">
                {/* Breadcrumb back button */}
                <button
                  type="button"
                  onClick={() => handleOpenChange(false)}
                  className="drawer-breadcrumb mb-1 flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                  {t('decks.breadcrumb.decks', { defaultValue: 'Decks' })} ·{' '}
                  {isCulture
                    ? t('decks.typeCulture', { defaultValue: 'Culture' })
                    : t('decks.typeVocabulary', { defaultValue: 'Vocabulary' })}{' '}
                  · {deckCode}
                </button>

                {/* Deck title */}
                <div className="drawer-head-row">
                  <h2 className="drawer-title">{deckName}</h2>
                </div>

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
                      : t('decks.statusDeactivated', { defaultValue: 'Deactivated' })}
                  </Badge>

                  {deck.is_premium && (
                    <Badge tone="amber">
                      {t('decks.statusPremium', { defaultValue: 'Premium' })}
                    </Badge>
                  )}

                  <span className="text-sm text-muted-foreground">
                    {t(isCulture ? 'decks.questionCount' : 'decks.wordCount', {
                      count: itemCount,
                    })}
                  </span>
                </div>
              </div>
            </SidePanel.Header>

            {/* Tab triggers — hidden while a word/question detail is pushed */}
            {!itemId && (
              <SidePanel.Tabs>
                <div className="drawer-tab-group" role="tablist">
                  {!isCulture && (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={resolvedTab === 'words'}
                      className={resolvedTab === 'words' ? 'drawer-tab is-active' : 'drawer-tab'}
                      onClick={() => handleTabChange('words')}
                      data-testid="deck-drawer-tab-words"
                    >
                      {t('decks.drawer.tabs.words')}
                    </button>
                  )}
                  {isCulture && (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={resolvedTab === 'questions'}
                      className={
                        resolvedTab === 'questions' ? 'drawer-tab is-active' : 'drawer-tab'
                      }
                      onClick={() => handleTabChange('questions')}
                      data-testid="deck-drawer-tab-questions"
                    >
                      {t('decks.drawer.tabs.questions')}
                    </button>
                  )}
                  <button
                    type="button"
                    role="tab"
                    aria-selected={resolvedTab === 'settings'}
                    className={resolvedTab === 'settings' ? 'drawer-tab is-active' : 'drawer-tab'}
                    onClick={() => handleTabChange('settings')}
                    data-testid="deck-drawer-tab-settings"
                  >
                    {t('decks.drawer.tabs.settings')}
                  </button>
                </div>

                {/* Add word/question button — right-aligned in the tab row, hidden on settings tab */}
                {resolvedTab !== 'settings' && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    data-testid={isCulture ? 'question-list-add-question' : 'word-list-add-word'}
                    onClick={() => setAddItemOpen(true)}
                  >
                    {isCulture ? t('decks.addQuestion') : t('decks.addWord')}
                  </button>
                )}
              </SidePanel.Tabs>
            )}

            {/* Tab content — inside SidePanel.Body for scrolling */}
            <SidePanel.Body>
              {/* Words tab (vocabulary decks only) */}
              {!isCulture && resolvedTab === 'words' && (
                <>
                  {itemId ? (
                    <VocabWordDetail deck={deck} itemId={itemId} />
                  ) : (
                    <VocabDrawerBody
                      deck={deck}
                      addOpen={addItemOpen}
                      onAddOpenChange={setAddItemOpen}
                    />
                  )}
                </>
              )}

              {/* Questions tab (culture decks only) */}
              {isCulture && resolvedTab === 'questions' && (
                <>
                  {itemId ? (
                    <CultureQuestionDetail deck={deck} itemId={itemId} />
                  ) : (
                    <CultureDrawerBody
                      deck={deck}
                      addOpen={addItemOpen}
                      onAddOpenChange={setAddItemOpen}
                    />
                  )}
                </>
              )}

              {/* Settings tab */}
              {resolvedTab === 'settings' && <DeckSettingsTab deck={deck} />}
            </SidePanel.Body>

            {/* Word-detail footer — Delete (unlink) / Back / Save changes (D3b) */}
            {itemId && !isCulture && (
              <SidePanel.Footer data-testid="deck-drawer-footer-detail">
                <div className="drawer-foot-left">
                  <button
                    type="button"
                    className="btn btn-glass btn-sm danger-text"
                    onClick={() => setUnlinkDialogOpen(true)}
                    data-testid="deck-drawer-footer-detail-delete"
                  >
                    {t('wordEntry.unlinkButton')}
                  </button>
                </div>
                <div className="drawer-foot-right">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={popToWordList}
                    data-testid="deck-drawer-footer-detail-back"
                  >
                    {t('wordEntryDetail.back')}
                  </button>
                  <button
                    type="button"
                    disabled
                    className="btn btn-primary btn-sm disabled:cursor-not-allowed disabled:opacity-50"
                    data-testid="deck-drawer-footer-detail-save"
                  >
                    <Check className="size-4" aria-hidden="true" />
                    {t('decks.saveChanges', { defaultValue: 'Save changes' })}
                  </button>
                </div>
              </SidePanel.Footer>
            )}

            {/* Standard drawer footer — list/settings view */}
            {!itemId && (
              <SidePanel.Footer data-testid="deck-drawer-footer">
                <div className="drawer-foot-left">
                  <button
                    type="button"
                    className="btn btn-glass btn-sm danger-text"
                    onClick={() => setDeleteDialogOpen(true)}
                    data-testid="deck-drawer-footer-delete"
                  >
                    {t('deckDelete.confirm', { defaultValue: 'Delete Deck' })}
                  </button>
                </div>

                <div className="drawer-foot-right">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleOpenChange(false)}
                    data-testid="deck-drawer-footer-cancel"
                  >
                    {t('deckEdit.cancel', { defaultValue: 'Cancel' })}
                  </button>
                  <button
                    type="submit"
                    form="deck-settings-form"
                    disabled={resolvedTab !== 'settings'}
                    className="btn btn-primary btn-sm disabled:cursor-not-allowed disabled:opacity-50"
                    data-testid="deck-drawer-footer-save"
                  >
                    <Check className="size-4" aria-hidden="true" />
                    {t('decks.saveChanges', { defaultValue: 'Save changes' })}
                  </button>
                </div>
              </SidePanel.Footer>
            )}
          </div>
        )}

        {/* Delete-deck dialog (hoisted from DeckSettingsTab). Reuses
            DeckDeleteDialog for its deactivate-specific impact copy. */}
        {deck && (
          <DeckDeleteDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            deck={deck}
            onConfirm={() => void handleDeleteConfirm()}
            isDeleting={isDeleting}
          />
        )}

        {/* Unlink word-from-deck confirmation (D3b) */}
        <AlertDialog open={unlinkDialogOpen} onOpenChange={setUnlinkDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('wordEntry.unlinkTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{t('wordEntry.unlinkConfirm')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                {t('deckEdit.cancel', { defaultValue: 'Cancel' })}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => unlinkMutation.mutate()}
                disabled={unlinkMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t('wordEntry.unlinkButton')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SidePanel>
    </DeckDrawerContext.Provider>
  );
}
