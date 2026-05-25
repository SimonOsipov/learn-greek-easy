import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

interface AdminExercisesPagerProps {
  page: number;
  setPage: (page: number) => void;
  totalPages: number;
  showingFrom: number;
  showingTo: number;
  total: number;
}

export function AdminExercisesPager({
  page,
  setPage,
  totalPages,
  showingFrom,
  showingTo,
  total,
}: AdminExercisesPagerProps) {
  const { t } = useTranslation('admin');

  return (
    <div className="flex items-center justify-between" data-testid="admin-exercises-pagination">
      {/* Hidden on mobile (< 640px), visible at sm+ */}
      <p className="hidden text-sm text-muted-foreground sm:block">
        {t('exercises.pager.showing', { from: showingFrom, to: showingTo, total })}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page === 1}
          aria-disabled={page === 1}
          tabIndex={page === 1 ? -1 : 0}
        >
          {t('exercises.pager.previous')}
        </Button>
        <span className="text-sm text-muted-foreground">
          {t('exercises.pager.pageOf', { page, totalPages })}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          aria-disabled={page >= totalPages}
          tabIndex={page >= totalPages ? -1 : 0}
        >
          {t('exercises.pager.next')}
        </Button>
      </div>
    </div>
  );
}
