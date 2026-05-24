import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

interface AdminExercisesPagerProps {
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
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
      <p className="text-sm text-muted-foreground">
        {t('exercises.pager.showing', { from: showingFrom, to: showingTo, total })}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          {t('pagination.previous')}
        </Button>
        <span className="text-sm text-muted-foreground">
          {t('pagination.pageOf', { page, totalPages })}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
        >
          {t('pagination.next')}
        </Button>
      </div>
    </div>
  );
}
