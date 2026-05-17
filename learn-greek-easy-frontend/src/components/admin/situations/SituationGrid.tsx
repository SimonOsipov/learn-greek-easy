// src/components/admin/situations/SituationGrid.tsx

import React, { useState } from 'react';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { Button } from '@/components/ui/button';
import { Kicker } from '@/components/ui/kicker';
import { selectFilteredSituations, useAdminSituationStore } from '@/stores/adminSituationStore';

import { SituationCard } from './SituationCard';
import { SituationDeleteDialog } from './SituationDeleteDialog';

export interface SituationGridProps {
  onRequestDelete?: (item: { id: string; scenario_el: string }) => void;
}

export const SituationGrid: React.FC<SituationGridProps> = ({ onRequestDelete }) => {
  const { t } = useTranslation('admin');

  // useShallow prevents infinite re-renders caused by selectFilteredSituations
  // returning a new array reference (.filter().sort()) on every call.
  const items = useAdminSituationStore(useShallow(selectFilteredSituations));

  const {
    page,
    pageSize,
    total,
    totalPages,
    setPage,
    setSearchQuery,
    setStatusFilter,
    setSortMode,
  } = useAdminSituationStore();

  // Local delete dialog state — SituationGrid owns the mount (same pattern as NewsTab)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; scenario_el: string } | null>(
    null
  );

  function handleClearFilters() {
    setSearchQuery('');
    setStatusFilter(null);
    setSortMode('newest');
  }

  function handleRequestDelete(item: { id: string; scenario_el: string }) {
    if (onRequestDelete) {
      onRequestDelete(item);
    } else {
      setDeleteTarget(item);
    }
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div>
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Kicker dot="amber">{t('situations.grid.noResults')}</Kicker>
          <p className="text-sm text-muted-foreground">{t('situations.grid.empty')}</p>
          <Button variant="outline" size="sm" onClick={handleClearFilters}>
            {t('situations.grid.clearFilters')}
          </Button>
        </div>
      ) : (
        <section className="sit-list">
          {items.map((item) => (
            <SituationCard key={item.id} item={item} onRequestDelete={handleRequestDelete} />
          ))}
        </section>
      )}

      {/* Pagination footer — hidden when only one page */}
      {totalPages > 1 && (
        <div
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          data-testid="sit-grid-pagination"
        >
          <p className="text-sm text-muted-foreground">
            Showing {from}–{to} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              aria-label="Previous page"
              data-testid="sit-grid-prev"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
              aria-label="Next page"
              data-testid="sit-grid-next"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete dialog — owned by SituationGrid when no onRequestDelete prop */}
      <SituationDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        situation={deleteTarget}
      />
    </div>
  );
};
