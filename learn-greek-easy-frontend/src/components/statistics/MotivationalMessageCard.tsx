import React, { useEffect, useRef } from 'react';

import { Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useCultureReadiness } from '@/hooks/useCultureReadiness';
import { useTrackEvent } from '@/hooks/useTrackEvent';

export function MotivationalMessageCard() {
  const { t } = useTranslation('statistics');
  const { data, isLoading, isError } = useCultureReadiness();
  const { track } = useTrackEvent();
  const hasFiredRef = useRef<string | null>(null);

  const motivation = data?.motivation ?? null;

  useEffect(() => {
    if (motivation?.message_key && hasFiredRef.current !== motivation.message_key) {
      hasFiredRef.current = motivation.message_key;
      track('culture_motivation_viewed', {
        message_key: motivation.message_key,
        delta_direction: motivation.delta_direction,
        delta_percentage: motivation.delta_percentage,
      });
    }
  }, [motivation?.message_key, track]);

  if (isLoading || isError || !motivation) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-lg border bg-amber-50/80 p-4 dark:bg-amber-950/20"
    >
      <div className="flex items-start gap-3">
        <Zap className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
        <p className="text-sm text-foreground">
          {t(motivation.message_key, motivation.params as Record<string, string | number>)}
        </p>
      </div>
    </div>
  );
}
