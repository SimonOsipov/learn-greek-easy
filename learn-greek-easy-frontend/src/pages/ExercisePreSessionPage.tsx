import { useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Dumbbell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { exerciseAPI } from '@/services/exerciseAPI';
import type { ExerciseModality } from '@/services/exerciseAPI';

export const ExercisePreSessionPage = () => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [modality, setModality] = useState<'all' | ExerciseModality>('all');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['exerciseQueueCount', modality],
    queryFn: () =>
      exerciseAPI.getQueue({
        limit: 1,
        ...(modality !== 'all' ? { modality } : {}),
      }),
  });

  const queueCount = data ? data.total_due + data.total_new : 0;

  const handleStartSession = () => {
    const query = modality !== 'all' ? `?modality=${modality}` : '';
    navigate(`/practice/exercises/session${query}`);
  };

  const modalityOptions: Array<{
    value: 'all' | ExerciseModality;
    labelKey: string;
    testId: string;
  }> = [
    { value: 'all', labelKey: 'exercises.preSession.modality.all', testId: 'modality-all' },
    {
      value: 'listening',
      labelKey: 'exercises.preSession.modality.listening',
      testId: 'modality-listening',
    },
    {
      value: 'reading',
      labelKey: 'exercises.preSession.modality.reading',
      testId: 'modality-reading',
    },
  ];

  return (
    <div data-testid="exercise-pre-session-page" className="space-y-6 pb-20 lg:pb-8">
      <div>
        <h1 className="text-2xl font-bold">{t('exercises.preSession.title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('exercises.preSession.subtitle')}</p>
      </div>

      {/* Modality selector */}
      <div className="flex gap-2">
        {modalityOptions.map(({ value, labelKey, testId }) => (
          <Button
            key={value}
            data-testid={testId}
            variant={modality === value ? 'default' : 'outline'}
            onClick={() => setModality(value)}
          >
            {t(labelKey)}
          </Button>
        ))}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-muted" />
          <div className="h-10 w-40 rounded-md bg-muted" />
        </div>
      )}

      {/* Error state */}
      {!isLoading && isError && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <div>
              <p className="font-semibold text-destructive">
                {t('exercises.preSession.error.title')}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('exercises.preSession.error.description')}
              </p>
            </div>
            <Button variant="outline" onClick={() => void refetch()}>
              {t('exercises.preSession.error.retry')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Ready / Empty state */}
      {!isLoading && !isError && data && (
        <>
          {queueCount === 0 ? (
            <EmptyState
              icon={Dumbbell}
              title={t('exercises.preSession.empty.title')}
              description={t('exercises.preSession.empty.description')}
            />
          ) : (
            <div className="space-y-4">
              <p className="text-lg font-medium">
                <span data-testid="queue-count">
                  {t('exercises.preSession.queueCount', { count: queueCount })}
                </span>
              </p>
              <Button
                data-testid="start-session-btn"
                size="lg"
                onClick={handleStartSession}
                disabled={queueCount === 0 || isLoading}
              >
                {t('exercises.preSession.startSession')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
