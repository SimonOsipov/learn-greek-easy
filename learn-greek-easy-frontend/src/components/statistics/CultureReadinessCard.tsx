import React, { useEffect, useRef } from 'react';

import { useTranslation } from 'react-i18next';

import { CategoryBreakdown } from '@/components/statistics/CategoryBreakdown';
import { WeakAreaCTA } from '@/components/statistics/WeakAreaCTA';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useCultureReadiness } from '@/hooks/useCultureReadiness';
import { useTrackEvent } from '@/hooks/useTrackEvent';
import { cn } from '@/lib/utils';

const verdictColorMap: Record<string, { text: string; stroke: string }> = {
  not_ready: { text: 'text-red-500', stroke: 'stroke-red-500' },
  getting_there: { text: 'text-orange-500', stroke: 'stroke-orange-500' },
  ready: { text: 'text-green-500', stroke: 'stroke-green-500' },
  thoroughly_prepared: { text: 'text-emerald-500', stroke: 'stroke-emerald-500' },
};

interface CultureReadinessCardProps {
  className?: string;
}

export function CultureReadinessCard({ className }: CultureReadinessCardProps) {
  const { t } = useTranslation('statistics');
  const { data, isLoading, isError, error } = useCultureReadiness();
  const { track } = useTrackEvent();
  const hasFired = useRef(false);

  useEffect(() => {
    if (data && !hasFired.current) {
      hasFired.current = true;
      track('culture_readiness_viewed', {
        readiness_percentage: data.readiness_percentage,
        verdict: data.verdict,
        questions_learned: data.questions_learned,
        questions_total: data.questions_total,
        accuracy_percentage: data.accuracy_percentage ?? null,
      });
    }
  }, [data, track]);

  if (isLoading) {
    return (
      <Card className={cn(className)}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <Skeleton className="h-32 w-32 rounded-full sm:h-40 sm:w-40" />
            <div className="flex flex-col gap-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-36" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className={cn(className)}>
        <CardHeader>
          <CardTitle>{t('cultureReadiness.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[200px] items-center justify-center text-red-600">
            {t('error.loadingData', { error: (error as Error)?.message ?? '' })}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (circumference * data.readiness_percentage) / 100;
  const colors = verdictColorMap[data.verdict] ?? verdictColorMap['not_ready'];

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle>{t('cultureReadiness.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          {/* SVG circular progress */}
          <div className="flex flex-col items-center gap-2">
            <svg viewBox="0 0 100 100" className="h-32 w-32 sm:h-40 sm:w-40" aria-hidden="true">
              {/* Background track */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                className="stroke-muted"
                strokeWidth={8}
              />
              {/* Progress arc */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                className={colors.stroke}
                strokeWidth={8}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                transform="rotate(-90 50 50)"
                style={{ transition: 'stroke-dashoffset 0.5s ease' }}
              />
              {/* Center text */}
              <text
                x="50"
                y="50"
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="18"
                className="fill-foreground font-semibold"
              >
                {Math.round(data.readiness_percentage)}%
              </text>
            </svg>
            <span className={cn('text-sm font-medium', colors.text)}>
              {t(`cultureReadiness.verdicts.${data.verdict}`)}
            </span>
          </div>

          {/* Metrics */}
          <div className="flex flex-col gap-3">
            <div className="text-sm">
              <span className="text-muted-foreground">
                {t('cultureReadiness.questionsLearned')}:{' '}
              </span>
              <span className="font-medium">
                {data.questions_learned} / {data.questions_total}
              </span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">
                {t('cultureReadiness.overallAccuracy')}:{' '}
              </span>
              <span className="font-medium">
                {data.accuracy_percentage !== null
                  ? `${data.accuracy_percentage}%`
                  : t('cultureReadiness.noAccuracyData')}
              </span>
            </div>
          </div>
        </div>
        <Separator className="my-4" />
        <CategoryBreakdown categories={data.categories} isLoading={false} />
        <div className="mt-4">
          <WeakAreaCTA categories={data.categories} isLoading={false} />
        </div>
      </CardContent>
    </Card>
  );
}
