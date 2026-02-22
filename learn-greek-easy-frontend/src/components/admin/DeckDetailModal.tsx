// src/components/admin/DeckDetailModal.tsx

import React, { useCallback, useEffect, useRef, useState } from 'react';

import {
  AlertCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import {
  trackAdminWordEntryDetailOpened,
  trackAdminWordEntryDetailTabSwitched,
} from '@/lib/analytics/adminAnalytics';
import { getLocalizedDeckName } from '@/lib/deckLocale';
import { cn } from '@/lib/utils';
import { adminAPI } from '@/services/adminAPI';
import type {
  AdminCultureQuestion,
  AdminVocabularyCard,
  MultilingualName,
  PartOfSpeech,
  UnifiedDeckItem,
} from '@/services/adminAPI';

import { CardCreateModal } from './CardCreateModal';
import { CardDeleteDialog } from './CardDeleteDialog';
import { CardEditModal } from './CardEditModal';
import { V1CardEditInDialog, VocabularyCardCreateModal } from './vocabulary';
import { WordEntryCards } from './WordEntryCards';
import { WordEntryContent } from './WordEntryContent';

interface DeckDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deck: UnifiedDeckItem | null;
  onItemDeleted?: () => void;
}

/**
 * Get display name for a deck (handles multilingual names)
 * Uses shared getLocalizedDeckName for flat fields; falls back to
 * MultilingualName for legacy support.
 */
function getDeckDisplayName(
  deck: { name?: string | MultilingualName; name_en?: string; name_ru?: string },
  locale: string
): string {
  // If flat bilingual fields are available, prefer them
  if (deck.name_en || deck.name_ru) {
    return getLocalizedDeckName(deck as { name_en?: string; name_ru?: string }, locale);
  }
  // Fallback to MultilingualName object
  const name = deck.name;
  if (typeof name === 'string') {
    return name;
  }
  if (name) {
    if (locale === 'ru' && name.ru) return name.ru;
    return name.en || name.ru || '';
  }
  return '';
}

/**
 * Format card preview text for vocabulary cards
 */
function formatCardPreview(card: AdminVocabularyCard): string {
  return `${card.front_text} - ${card.back_text_en}`;
}

/**
 * Format question preview text for culture questions
 */
function formatQuestionPreview(question: AdminCultureQuestion, locale: string): string {
  const questionText = question.question_text[locale] || question.question_text.en || '';
  return questionText.length > 80 ? `${questionText.substring(0, 80)}...` : questionText;
}

/**
 * Modal showing all cards/questions in a deck with delete functionality.
 *
 * Displays:
 * - Deck name and item count
 * - List of cards (vocabulary) or questions (culture)
 * - Delete button for each item
 * - Pagination for large decks
 */
export const DeckDetailModal: React.FC<DeckDetailModalProps> = ({
  open,
  onOpenChange,
  deck,
  onItemDeleted,
}) => {
  const { t, i18n } = useTranslation('admin');
  const locale = i18n.language;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  // Vocabulary cards state
  const [cards, setCards] = useState<AdminVocabularyCard[]>([]);

  // Culture questions state
  const [questions, setQuestions] = useState<AdminCultureQuestion[]>([]);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<
    AdminVocabularyCard | AdminCultureQuestion | null
  >(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit modal state (culture questions)
  const [editingCard, setEditingCard] = useState<AdminCultureQuestion | null>(null);

  // Create modal state (culture questions)
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Vocabulary card modal state
  const [vocabularyCreateModalOpen, setVocabularyCreateModalOpen] = useState(false);

  // Word entry detail view state (V2)
  const [selectedWordEntry, setSelectedWordEntry] = useState<AdminVocabularyCard | null>(null);
  // V1 card edit in-dialog state
  const [selectedV1Card, setSelectedV1Card] = useState<AdminVocabularyCard | null>(null);
  const scrollPositionRef = useRef<number>(0);
  const dialogContentRef = useRef<HTMLDivElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const v1BackButtonRef = useRef<HTMLButtonElement>(null);
  const clickedRowIdRef = useRef<string | null>(null);

  // Search, filter, and sort state (V2 word list)
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [posFilter, setPosFilter] = useState<PartOfSpeech | 'all'>('all');
  const [sortBy, setSortBy] = useState<'lemma' | 'created_at'>('lemma');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const totalCountRef = useRef<number | null>(null);

  // Bulk selection state (V2 word list)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!deck) return;

    setIsLoading(true);
    setError(null);

    try {
      if (deck.type === 'vocabulary') {
        const response =
          deck.card_system === 'V2'
            ? await adminAPI.listWordEntries(deck.id, page, pageSize, {
                search: debouncedSearch || undefined,
                partOfSpeech: posFilter !== 'all' ? (posFilter as PartOfSpeech) : undefined,
                sortBy,
                sortOrder,
              })
            : await adminAPI.listVocabularyCards(deck.id, page, pageSize);
        setCards(response.cards);
        setSelectedIds(new Set());
        setTotal(response.total);
        // Cache unfiltered total on first load
        if (!debouncedSearch && posFilter === 'all' && totalCountRef.current === null) {
          totalCountRef.current = response.total;
        }
        setQuestions([]);
      } else {
        const response = await adminAPI.listCultureQuestions(deck.id, page, pageSize);
        setQuestions(response.questions);
        setTotal(response.total);
        setCards([]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t('errors.loadingDecks');
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [deck, page, t, debouncedSearch, posFilter, sortBy, sortOrder]);

  // Fetch items when modal opens or page changes
  useEffect(() => {
    if (open && deck) {
      fetchItems();
    }
  }, [open, deck, fetchItems]);

  // Reset page and all filter state when deck changes
  useEffect(() => {
    setPage(1);
    setSelectedWordEntry(null);
    setSelectedV1Card(null);
    setSearchQuery('');
    setDebouncedSearch('');
    setPosFilter('all');
    setSortBy('lemma');
    setSortOrder('asc');
    totalCountRef.current = null;
    setSelectedIds(new Set());
  }, [deck?.id]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, posFilter, sortBy, sortOrder]);

  const totalPages = Math.ceil(total / pageSize);

  const handleDeleteClick = (item: AdminVocabularyCard | AdminCultureQuestion) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete || !deck) return;

    setIsDeleting(true);

    try {
      if (deck.type === 'vocabulary') {
        await adminAPI.deleteVocabularyCard(itemToDelete.id);
        toast({
          title: t('cardDelete.successCard'),
        });
      } else {
        await adminAPI.deleteCultureQuestion(itemToDelete.id);
        toast({
          title: t('cardDelete.successQuestion'),
        });
      }

      // Close delete dialog
      setDeleteDialogOpen(false);
      setItemToDelete(null);

      // Refresh the list
      await fetchItems();

      // Notify parent to refresh deck counts
      onItemDeleted?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : t('cardDelete.error');
      toast({
        title: t('cardDelete.error'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteDialogClose = (openState: boolean) => {
    if (!openState) {
      setItemToDelete(null);
    }
    setDeleteDialogOpen(openState);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === cards.length && cards.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(cards.map((c) => c.id)));
    }
  };

  const handleSelectCard = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (!deck) return;
    setIsBulkDeleting(true);
    const count = selectedIds.size;
    try {
      const results = await Promise.allSettled(
        Array.from(selectedIds).map((id) => adminAPI.deleteVocabularyCard(id))
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      setBulkDeleteDialogOpen(false);
      if (failed > 0) {
        toast({ title: t('wordList.bulkDeleteError'), variant: 'destructive' });
      } else {
        toast({ title: t('wordList.bulkDeleteSuccess', { count }) });
      }
      await fetchItems();
      onItemDeleted?.();
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleWordEntryClick = (card: AdminVocabularyCard) => {
    if (dialogContentRef.current) {
      scrollPositionRef.current = dialogContentRef.current.scrollTop;
    }
    clickedRowIdRef.current = card.id;
    setSelectedWordEntry(card);
    trackAdminWordEntryDetailOpened({
      word_entry_id: card.id,
      deck_id: deck!.id,
      lemma: card.front_text,
      part_of_speech: card.part_of_speech,
    });
  };

  const handleBack = useCallback(() => {
    setSelectedWordEntry(null);
    requestAnimationFrame(() => {
      if (dialogContentRef.current) {
        dialogContentRef.current.scrollTop = scrollPositionRef.current;
      }
      if (clickedRowIdRef.current) {
        const row = document.querySelector(
          `[data-testid="word-entry-row-${clickedRowIdRef.current}"]`
        );
        if (row instanceof HTMLElement) row.focus();
        clickedRowIdRef.current = null;
      }
    });
  }, []);

  // Focus management for word entry detail view
  useEffect(() => {
    if (selectedWordEntry && backButtonRef.current) {
      backButtonRef.current.focus();
    }
  }, [selectedWordEntry]);

  const handleV1CardClick = (card: AdminVocabularyCard) => {
    if (dialogContentRef.current) {
      scrollPositionRef.current = dialogContentRef.current.scrollTop;
    }
    clickedRowIdRef.current = card.id;
    setSelectedV1Card(card);
  };

  const handleV1Back = useCallback(() => {
    setSelectedV1Card(null);
    requestAnimationFrame(() => {
      if (dialogContentRef.current) {
        dialogContentRef.current.scrollTop = scrollPositionRef.current;
      }
      if (clickedRowIdRef.current) {
        const row = document.querySelector(`[data-testid="card-item-${clickedRowIdRef.current}"]`);
        if (row instanceof HTMLElement) row.focus();
        clickedRowIdRef.current = null;
      }
    });
  }, []);

  // Focus management for V1 card edit view
  useEffect(() => {
    if (selectedV1Card && v1BackButtonRef.current) {
      v1BackButtonRef.current.focus();
    }
  }, [selectedV1Card]);

  if (!deck) return null;

  const deckName = getDeckDisplayName(deck, locale);
  const isVocabulary = deck.type === 'vocabulary';
  const isV2Vocabulary = isVocabulary && deck.card_system === 'V2';
  const itemCountKey = isVocabulary ? 'deckDetail.cardsCount' : 'deckDetail.questionsCount';
  const noItemsKey = isVocabulary ? 'deckDetail.noCards' : 'deckDetail.noQuestions';

  // Get preview text for delete dialog
  const getItemPreview = (): string => {
    if (!itemToDelete) return '';
    if (isVocabulary) {
      return formatCardPreview(itemToDelete as AdminVocabularyCard);
    }
    return formatQuestionPreview(itemToDelete as AdminCultureQuestion, locale);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          ref={dialogContentRef}
          className="max-h-[85vh] overflow-y-auto sm:max-w-4xl"
          data-testid="deck-detail-modal"
          hideCloseButton
          onEscapeKeyDown={(e) => {
            if (selectedWordEntry) {
              e.preventDefault();
              handleBack();
            } else if (selectedV1Card) {
              e.preventDefault();
              handleV1Back();
            }
          }}
        >
          {selectedWordEntry ? (
            <>
              <DialogHeader>
                <Button
                  ref={backButtonRef}
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  className="mb-2 w-fit"
                  data-testid="word-entry-detail-back"
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  {t('wordEntryDetail.back')}
                </Button>
                <div data-testid="word-entry-detail-header">
                  <div className="flex items-center gap-2">
                    <DialogTitle data-testid="deck-detail-title">
                      {selectedWordEntry.front_text}
                    </DialogTitle>
                    {selectedWordEntry.part_of_speech && (
                      <Badge variant="secondary">{selectedWordEntry.part_of_speech}</Badge>
                    )}
                  </div>
                  <DialogDescription>{selectedWordEntry.back_text_en}</DialogDescription>
                </div>
              </DialogHeader>
              <div data-testid="word-entry-detail-view">
                <Tabs
                  key={selectedWordEntry.id}
                  defaultValue="entry"
                  data-testid="word-entry-detail-tabs"
                  onValueChange={(value) =>
                    trackAdminWordEntryDetailTabSwitched({
                      word_entry_id: selectedWordEntry.id,
                      tab: value,
                    })
                  }
                >
                  <TabsList className="w-full">
                    <TabsTrigger
                      value="entry"
                      className="flex-1"
                      data-testid="word-entry-tab-entry"
                    >
                      {t('wordEntryDetail.tabWordEntry')}
                    </TabsTrigger>
                    <TabsTrigger
                      value="cards"
                      className="flex-1"
                      data-testid="word-entry-tab-cards"
                    >
                      {t('wordEntryDetail.tabCards')}
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="entry" data-testid="word-entry-tab-content-entry">
                    <WordEntryContent wordEntryId={selectedWordEntry.id} />
                  </TabsContent>
                  <TabsContent value="cards" data-testid="word-entry-tab-content-cards">
                    <WordEntryCards entryId={selectedWordEntry.id} />
                  </TabsContent>
                </Tabs>
              </div>
            </>
          ) : selectedV1Card ? (
            <>
              <DialogHeader>
                <Button
                  ref={v1BackButtonRef}
                  variant="ghost"
                  size="sm"
                  onClick={handleV1Back}
                  className="mb-2 w-fit"
                  data-testid="v1-card-edit-back"
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  {t('v1CardEdit.back')}
                </Button>
                <DialogTitle data-testid="deck-detail-title">
                  {selectedV1Card.front_text}
                </DialogTitle>
                <DialogDescription>{selectedV1Card.back_text_en}</DialogDescription>
              </DialogHeader>
              <V1CardEditInDialog
                card={selectedV1Card}
                deckId={deck.id}
                deckLevel={deck.level ?? undefined}
                onBack={handleV1Back}
                onSaved={() => {
                  handleV1Back();
                  fetchItems();
                }}
              />
            </>
          ) : (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <DialogTitle data-testid="deck-detail-title">{deckName}</DialogTitle>
                    <DialogDescription>
                      {isV2Vocabulary &&
                      (debouncedSearch || posFilter !== 'all') &&
                      totalCountRef.current !== null
                        ? t('wordList.filteredCount', {
                            filtered: total,
                            total: totalCountRef.current,
                          })
                        : t(itemCountKey, { count: total })}
                    </DialogDescription>
                  </div>
                  <Button
                    size="sm"
                    onClick={() =>
                      isVocabulary ? setVocabularyCreateModalOpen(true) : setCreateModalOpen(true)
                    }
                    data-testid="create-card-btn"
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    {t('deckDetail.createCard')}
                  </Button>
                </div>
              </DialogHeader>

              {/* Search/Filter/Sort Toolbar — V2 vocabulary only */}
              {isV2Vocabulary && (
                <div
                  className="flex flex-col gap-2 sm:flex-row sm:items-center"
                  data-testid="word-list-toolbar"
                >
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t('wordList.search')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                      data-testid="word-list-search"
                    />
                  </div>
                  <Select
                    value={posFilter}
                    onValueChange={(val) => setPosFilter(val as PartOfSpeech | 'all')}
                  >
                    <SelectTrigger
                      className="w-full sm:w-[180px]"
                      data-testid="word-list-pos-filter"
                    >
                      <SelectValue placeholder={t('wordList.filterByPos')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('wordList.allPartsOfSpeech')}</SelectItem>
                      <SelectItem value="noun">{t('wordList.posNoun')}</SelectItem>
                      <SelectItem value="verb">{t('wordList.posVerb')}</SelectItem>
                      <SelectItem value="adjective">{t('wordList.posAdjective')}</SelectItem>
                      <SelectItem value="adverb">{t('wordList.posAdverb')}</SelectItem>
                      <SelectItem value="phrase">{t('wordList.posPhrase')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" data-testid="word-list-sort-trigger">
                        {t('wordList.sortBy')}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuRadioGroup
                        value={`${sortBy}-${sortOrder}`}
                        onValueChange={(val) => {
                          const parts = val.split('-');
                          setSortBy(parts[0] as 'lemma' | 'created_at');
                          setSortOrder(parts[1] as 'asc' | 'desc');
                        }}
                      >
                        <DropdownMenuRadioItem value="lemma-asc">
                          {t('wordList.sortAlphaGreek')}
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="created_at-desc">
                          {t('wordList.sortDateAdded')}
                        </DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}

              {/* Bulk Actions Bar — V2 vocabulary only */}
              {isV2Vocabulary && !isLoading && !error && cards.length > 0 && (
                <div className="flex items-center gap-2" data-testid="word-list-bulk-bar">
                  <Checkbox
                    id="select-all-words"
                    checked={selectedIds.size === cards.length && cards.length > 0}
                    onCheckedChange={handleSelectAll}
                    data-testid="word-list-select-all"
                  />
                  <label
                    htmlFor="select-all-words"
                    className="cursor-pointer select-none text-sm text-muted-foreground"
                  >
                    {selectedIds.size > 0
                      ? t('wordList.selectedCount', { count: selectedIds.size })
                      : t('wordList.selectAll')}
                  </label>
                  {selectedIds.size > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setBulkDeleteDialogOpen(true)}
                      data-testid="word-list-bulk-delete-btn"
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      {t('wordList.bulkDeleteButton')}
                    </Button>
                  )}
                </div>
              )}

              {/* Loading State */}
              {isLoading && (
                <div className="space-y-3" data-testid="deck-detail-loading">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-8 w-8" />
                    </div>
                  ))}
                </div>
              )}

              {/* Error State */}
              {error && !isLoading && (
                <Alert variant="destructive" data-testid="deck-detail-error">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Empty State */}
              {!isLoading && !error && total === 0 && (
                <p
                  className="py-8 text-center text-muted-foreground"
                  data-testid="deck-detail-empty"
                >
                  {isV2Vocabulary && (debouncedSearch || posFilter !== 'all')
                    ? t('wordList.noResults')
                    : t(noItemsKey)}
                </p>
              )}

              {/* Vocabulary Cards List */}
              {!isLoading && !error && isVocabulary && cards.length > 0 && (
                <TooltipProvider delayDuration={200}>
                  <div className="space-y-2" data-testid="vocabulary-cards-list">
                    {cards.map((card) => (
                      <div
                        key={card.id}
                        className={cn(
                          'flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50',
                          isVocabulary && 'cursor-pointer'
                        )}
                        data-testid={
                          isV2Vocabulary ? `word-entry-row-${card.id}` : `card-item-${card.id}`
                        }
                        onClick={(e: React.MouseEvent) => {
                          if ((e.target as HTMLElement).closest('button')) return;
                          isV2Vocabulary ? handleWordEntryClick(card) : handleV1CardClick(card);
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e: React.KeyboardEvent) => {
                          if ((e.target as HTMLElement).closest('button')) return;
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            isV2Vocabulary ? handleWordEntryClick(card) : handleV1CardClick(card);
                          }
                        }}
                      >
                        {isV2Vocabulary && (
                          <Checkbox
                            checked={selectedIds.has(card.id)}
                            onCheckedChange={() => handleSelectCard(card.id)}
                            className="mr-2 shrink-0"
                            data-testid={`word-entry-select-${card.id}`}
                          />
                        )}
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-medium">{card.front_text}</p>
                            {card.part_of_speech && (
                              <Badge
                                variant="secondary"
                                className="shrink-0"
                                data-testid={`vocabulary-card-pos-badge-${card.id}`}
                              >
                                {card.part_of_speech}
                              </Badge>
                            )}
                            {/* Gender badge — nouns only */}
                            {card.gender && (
                              <Badge
                                variant="outline"
                                className="shrink-0"
                                data-testid={`vocabulary-card-gender-badge-${card.id}`}
                              >
                                {card.gender === 'masculine'
                                  ? '♂'
                                  : card.gender === 'feminine'
                                    ? '♀'
                                    : '⚬'}
                              </Badge>
                            )}
                            {card.level && card.level !== deck?.level && (
                              <Badge
                                variant="outline"
                                className="shrink-0"
                                data-testid={`vocabulary-card-level-badge-${card.id}`}
                              >
                                {card.level}
                              </Badge>
                            )}
                            {/* Completeness indicators — V2 only */}
                            {isV2Vocabulary && (
                              <div className="flex shrink-0 items-center gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span
                                      className={cn(
                                        'inline-block h-2 w-2 rounded-full',
                                        card.has_audio ? 'bg-green-500' : 'bg-muted-foreground/30'
                                      )}
                                      data-testid={`vocabulary-card-audio-dot-${card.id}`}
                                    />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {t(
                                      card.has_audio
                                        ? 'wordList.audioReady'
                                        : 'wordList.audioMissing'
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span
                                      className={cn(
                                        'inline-block h-2 w-2 rounded-full',
                                        card.has_examples
                                          ? 'bg-green-500'
                                          : 'bg-muted-foreground/30'
                                      )}
                                      data-testid={`vocabulary-card-examples-dot-${card.id}`}
                                    />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {t(
                                      card.has_examples
                                        ? 'wordList.examplesPresent'
                                        : 'wordList.examplesMissing'
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span
                                      className={cn(
                                        'inline-block h-2 w-2 rounded-full',
                                        card.has_grammar ? 'bg-green-500' : 'bg-muted-foreground/30'
                                      )}
                                      data-testid={`vocabulary-card-grammar-dot-${card.id}`}
                                    />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {t(
                                      card.has_grammar
                                        ? 'wordList.grammarPresent'
                                        : 'wordList.grammarMissing'
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            )}
                          </div>
                          {/* Pronunciation — below Greek word */}
                          {card.pronunciation && (
                            <p className="truncate text-xs text-muted-foreground">
                              {card.pronunciation}
                            </p>
                          )}
                          <p className="truncate text-sm text-muted-foreground">
                            {card.back_text_en}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              isV2Vocabulary ? handleWordEntryClick(card) : handleV1CardClick(card);
                            }}
                            data-testid={`vocabulary-card-edit-${card.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">{t('actions.edit')}</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(card)}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            data-testid={`delete-card-${card.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">{t('actions.delete')}</span>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </TooltipProvider>
              )}

              {/* Culture Questions List */}
              {!isLoading && !error && !isVocabulary && questions.length > 0 && (
                <div className="space-y-2" data-testid="culture-questions-list">
                  {questions.map((question) => (
                    <div
                      key={question.id}
                      className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                      data-testid={`question-item-${question.id}`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="break-words font-medium">
                          {question.question_text[locale] || question.question_text.en}
                        </p>
                        {question.is_pending_review && (
                          <span className="text-xs text-amber-600">
                            {t('sources.articles.alreadyGenerated')}
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingCard(question)}
                          data-testid={`edit-question-${question.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">{t('actions.edit')}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(question)}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          data-testid={`delete-question-${question.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">{t('actions.delete')}</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {!isLoading && !error && total > pageSize && (
                <div className="mt-4 flex items-center justify-between border-t pt-4">
                  <p className="text-sm text-muted-foreground">
                    {t('pagination.showing', {
                      from: (page - 1) * pageSize + 1,
                      to: Math.min(page * pageSize, total),
                      total,
                    })}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p - 1)}
                      disabled={page === 1}
                      data-testid="deck-detail-prev"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      {t('pagination.previous')}
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {t('pagination.pageOf', { page, totalPages })}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= totalPages}
                      data-testid="deck-detail-next"
                    >
                      {t('pagination.next')}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Close Button */}
          <div className="flex justify-end border-t pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="deck-detail-close"
            >
              {t('deckDetail.close')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Card/Question Delete Dialog */}
      <CardDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={handleDeleteDialogClose}
        itemPreview={getItemPreview()}
        itemType={isVocabulary ? 'card' : 'question'}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />

      {/* Bulk Delete Confirmation Dialog */}
      {isV2Vocabulary && (
        <Dialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
          <DialogContent data-testid="bulk-delete-dialog">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                {t('wordList.bulkDeleteTitle', { count: selectedIds.size })}
              </DialogTitle>
              <DialogDescription>
                {t('wordList.bulkDeleteDescription', { count: selectedIds.size })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setBulkDeleteDialogOpen(false)}
                disabled={isBulkDeleting}
                data-testid="bulk-delete-cancel"
              >
                {t('wordList.bulkDeleteCancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                data-testid="bulk-delete-confirm"
              >
                {isBulkDeleting
                  ? t('wordList.bulkDeleteDeleting')
                  : t('wordList.bulkDeleteConfirm', { count: selectedIds.size })}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Culture Question Edit Modal */}
      <CardEditModal
        open={!!editingCard}
        onOpenChange={(open) => {
          if (!open) setEditingCard(null);
        }}
        onSuccess={() => {
          setEditingCard(null);
          fetchItems();
        }}
        question={editingCard}
      />

      {/* Culture Card Create Modal */}
      {!isVocabulary && deck && (
        <CardCreateModal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
          deckId={deck.id}
          onSuccess={() => {
            fetchItems();
            onItemDeleted?.(); // Refresh parent deck counts
          }}
        />
      )}

      {/* Vocabulary Card Create Modal */}
      {isVocabulary && deck && (
        <VocabularyCardCreateModal
          open={vocabularyCreateModalOpen}
          onOpenChange={setVocabularyCreateModalOpen}
          deckId={deck.id}
          deckLevel={deck.level ?? undefined}
          onSuccess={() => {
            fetchItems();
            onItemDeleted?.(); // Refresh parent deck counts
          }}
        />
      )}
    </>
  );
};
