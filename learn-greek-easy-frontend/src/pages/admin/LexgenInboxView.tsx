// src/pages/admin/LexgenInboxView.tsx

import { useEffect, useRef, useState } from 'react';

import { formatDistanceToNow } from 'date-fns';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { LexgenProposalDetail } from '@/components/admin/LexgenProposalDetail';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollableTable } from '@/components/ui/scrollable-table';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useLexgenProposal, useLexgenProposals } from '@/hooks/useLexgenProposals';
import { track } from '@/lib/analytics';
import { getDateLocale } from '@/lib/dateUtils';
import type { LexgenProposalListItem } from '@/services/adminAPI';

const PAGE_SIZE = 20;

interface LexgenInboxViewProps {
  /**
   * Called when a queue row is activated (click / Enter / Space).
   * 12-03 wires this to open the proposal detail; until then it is a no-op stub.
   */
  onSelectProposal?: (proposalId: string) => void;
}

/**
 * Verification Inbox queue (read-only) — LEXGEN-12-02.
 *
 * Renders body only — `<PageHead>` is rendered once by `AdminPage` via
 * `pageHeadPropsFor('lexgenInbox', t)`, and `<SectionTabs>` by the admin shell.
 *
 * Dense table of `needs_review` proposals (lemma / POS / flagged-field count /
 * age), ordered server-side (most-flagged first, then FIFO). No numeric scores
 * are shown (anti-anchoring). Action controls (approve/edit/reject) are
 * out of scope here — they arrive in LEXGEN-13.
 */
export default function LexgenInboxView({ onSelectProposal }: LexgenInboxViewProps) {
  const { t, i18n } = useTranslation('admin');
  const [page, setPage] = useState(1);
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);

  const { data, isLoading, isError } = useLexgenProposals({ page, page_size: PAGE_SIZE });

  const {
    data: detail,
    isLoading: isDetailLoading,
    isError: isDetailError,
  } = useLexgenProposal(selectedProposalId);

  // Fire the open event once on mount (ref guard for StrictMode double-invoke).
  const openedRef = useRef(false);
  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    track('lexgen_inbox_opened');
  }, []);

  const total = data?.total ?? 0;
  const items = data?.items ?? [];
  const totalPages = total > 0 ? Math.ceil(total / PAGE_SIZE) : 0;
  const dateLocale = getDateLocale(i18n.language);

  const handlePreviousPage = () => {
    if (page > 1) setPage((p) => p - 1);
  };
  const handleNextPage = () => {
    if (page < totalPages) setPage((p) => p + 1);
  };

  const handleRowActivate = (item: LexgenProposalListItem) => {
    setSelectedProposalId(item.id);
    onSelectProposal?.(item.id);
    // Fire once per open, using the LIST row's data (anti-anchoring: no score).
    track('lexgen_proposal_viewed', {
      proposal_id: item.id,
      lemma: item.lemma,
      flagged_field_count: item.flagged_field_count,
    });
  };

  const handleDetailOpenChange = (open: boolean) => {
    if (!open) setSelectedProposalId(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-3" data-testid="lexgen-inbox-loading">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="py-12 text-center text-sm text-muted-foreground">
        {t('lexgenInbox.error')}
      </div>
    );
  }

  if (total === 0) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="py-12 text-center"
        data-testid="lexgen-inbox-empty"
      >
        <Inbox aria-hidden="true" className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">{t('lexgenInbox.empty')}</p>
      </div>
    );
  }

  return (
    <div>
      <ScrollableTable>
        <table className="w-full table-auto text-sm" data-testid="lexgen-inbox-table">
          <thead>
            <tr className="border-b text-xs font-medium text-muted-foreground">
              <th className="py-2 text-left font-medium">{t('lexgenInbox.column.lemma')}</th>
              <th className="py-2 text-left font-medium">{t('lexgenInbox.column.pos')}</th>
              <th className="py-2 text-left font-medium">
                {t('lexgenInbox.column.flaggedFields')}
              </th>
              <th className="py-2 text-left font-medium">{t('lexgenInbox.column.age')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                role="button"
                tabIndex={0}
                data-testid={`lexgen-inbox-row-${item.id}`}
                className="cursor-pointer border-b last:border-0 hover:bg-muted/50 focus:bg-muted/50 focus:outline-none"
                onClick={() => handleRowActivate(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleRowActivate(item);
                  }
                }}
              >
                <td className="py-2 align-middle font-medium">{item.lemma}</td>
                <td className="py-2 align-middle text-muted-foreground">{item.pos}</td>
                <td className="py-2 align-middle">
                  <Badge tone={item.flagged_field_count > 0 ? 'amber' : 'gray'}>
                    {item.flagged_field_count}
                  </Badge>
                </td>
                <td className="py-2 align-middle text-muted-foreground">
                  {formatDistanceToNow(new Date(item.created_at), {
                    addSuffix: true,
                    locale: dateLocale,
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollableTable>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t('pagination.showing', {
              from: (page - 1) * PAGE_SIZE + 1,
              to: Math.min(page * PAGE_SIZE, total),
              total,
            })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousPage}
              disabled={page === 1}
              data-testid="pagination-prev"
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
              onClick={handleNextPage}
              disabled={page >= totalPages}
              data-testid="pagination-next"
            >
              {t('pagination.next')}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Sheet open={selectedProposalId !== null} onOpenChange={handleDetailOpenChange}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="sr-only">
            <SheetTitle>{t('lexgenInbox.title')}</SheetTitle>
            <SheetDescription>{t('lexgenInbox.detail.readOnlyNote')}</SheetDescription>
          </SheetHeader>
          {isDetailLoading && (
            <div className="space-y-3" data-testid="lexgen-detail-loading">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          )}
          {isDetailError && (
            <div role="alert" className="py-12 text-center text-sm text-muted-foreground">
              {t('lexgenInbox.error')}
            </div>
          )}
          {detail && !isDetailLoading && !isDetailError && (
            <LexgenProposalDetail proposal={detail} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
