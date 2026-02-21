import React, { useCallback, useEffect, useState } from 'react';

import { format, formatDistanceToNow } from 'date-fns';
import { el } from 'date-fns/locale/el';
import { ru } from 'date-fns/locale/ru';
import { AlertTriangle, Crown, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PREMIUM_ONLY_FEATURES } from '@/constants/premiumFeatures';
import { useTrackEvent } from '@/hooks/useTrackEvent';
import { reportAPIError } from '@/lib/errorReporting';
import { billingAPI } from '@/services/billingAPI';
import type { BillingStatusResponse } from '@/services/billingAPI';

type SubscriptionState = 'free' | 'trialing' | 'active' | 'cancelled' | 'past_due';

function getSubscriptionState(s: BillingStatusResponse): SubscriptionState {
  if (s.subscription_status === 'canceled' || s.cancel_at_period_end) return 'cancelled';
  if (s.subscription_status === 'past_due') return 'past_due';
  if (s.subscription_status === 'active' && s.is_premium) return 'active';
  if (s.subscription_status === 'trialing') return 'trialing';
  return 'free';
}

export const SubscriptionSection: React.FC = () => {
  const { t, i18n } = useTranslation('profile');
  const navigate = useNavigate();
  const { track } = useTrackEvent();

  const [billingStatus, setBillingStatus] = useState<BillingStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(() => {
    setError(null);
    setIsLoading(true);
    let cancelled = false;

    async function doFetch() {
      try {
        const status = await billingAPI.getBillingStatus();
        if (cancelled) return;
        setBillingStatus(status);
        track('subscription_tab_viewed', {
          subscription_status: status.subscription_status,
          subscription_tier: status.subscription_tier,
          is_premium: status.is_premium,
          cancel_at_period_end: status.cancel_at_period_end,
          billing_cycle: status.billing_cycle,
          has_price_data: status.current_price_amount !== null,
        });
      } catch (err) {
        if (cancelled) return;
        setError('error');
        reportAPIError(err, { operation: 'getBillingStatus', silent: true });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    doFetch();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return fetchStatus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getDateLocale = () => {
    switch (i18n.language) {
      case 'el':
        return el;
      case 'ru':
        return ru;
      default:
        return undefined;
    }
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const locale = getDateLocale();
    const absolute = format(date, 'MMMM d, yyyy', { locale });
    const relative = formatDistanceToNow(date, { addSuffix: true, locale });
    return `${absolute} (${relative})`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !billingStatus) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">{t('subscription.error')}</p>
        <Button variant="outline" size="sm" onClick={fetchStatus}>
          {t('subscription.retry')}
        </Button>
      </div>
    );
  }

  const state = getSubscriptionState(billingStatus);

  const planBadge = (() => {
    switch (state) {
      case 'free':
        return (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {t('subscription.plans.free')}
          </span>
        );
      case 'trialing':
        return (
          <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            {t('subscription.plans.trial')}
          </span>
        );
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            <Crown className="h-3.5 w-3.5" />
            {t('subscription.plans.premium')}
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            <Crown className="h-3.5 w-3.5" />
            {t('subscription.plans.cancelled')}
          </span>
        );
      case 'past_due':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            <Crown className="h-3.5 w-3.5" />
            {t('subscription.plans.premium')}
          </span>
        );
    }
  })();

  const handleActionClick = (action: string) => {
    track('subscription_action_clicked', {
      action,
      subscription_status: billingStatus.subscription_status,
      is_enabled: true,
    });
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-foreground">{t('subscription.currentPlan')}</h2>
      <Separator className="my-4" />

      {/* Past Due Warning Banner */}
      {state === 'past_due' && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p>{t('subscription.pastDueWarning')}</p>
        </div>
      )}

      {/* Current Plan Card */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('subscription.currentPlan')}</CardTitle>
        </CardHeader>
        <CardContent>{planBadge}</CardContent>
      </Card>

      {/* Billing Details Card — shown for active, cancelled, past_due, trialing */}
      {(state === 'active' ||
        state === 'cancelled' ||
        state === 'past_due' ||
        state === 'trialing') && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('subscription.billingDetails')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Trial end date */}
            {state === 'trialing' && (
              <>
                {billingStatus.trial_days_remaining === 0 ? (
                  <p className="text-sm text-destructive">{t('subscription.trialExpired')}</p>
                ) : (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('subscription.trialEnds')}</span>
                    <span className="text-foreground">
                      {formatDate(billingStatus.trial_end_date)}
                    </span>
                  </div>
                )}
              </>
            )}

            {/* Billing cycle */}
            {(state === 'active' || state === 'past_due' || state === 'cancelled') &&
              billingStatus.billing_cycle && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('subscription.billingCycle')}</span>
                  <span className="text-foreground">
                    {t(`subscription.cycles.${billingStatus.billing_cycle}`)}
                  </span>
                </div>
              )}

            {/* Price — only when current_price_amount is not null */}
            {(state === 'active' || state === 'past_due') &&
              billingStatus.current_price_amount !== null &&
              billingStatus.current_price_formatted &&
              billingStatus.billing_cycle && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('subscription.price')}</span>
                  <span className="text-foreground">
                    {t('subscription.priceFormat', {
                      currency: billingStatus.current_price_currency?.toUpperCase() ?? '',
                      amount: billingStatus.current_price_formatted,
                      period: t(`subscription.cycles.${billingStatus.billing_cycle}`),
                    })}
                  </span>
                </div>
              )}

            {/* Next renewal / Access ends */}
            {(state === 'active' || state === 'past_due') && billingStatus.current_period_end && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('subscription.nextRenewal')}</span>
                <span className="text-foreground">
                  {formatDate(billingStatus.current_period_end)}
                </span>
              </div>
            )}

            {state === 'cancelled' && billingStatus.current_period_end && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('subscription.accessEnds')}</span>
                <span className="text-foreground">
                  {formatDate(billingStatus.current_period_end)}
                </span>
              </div>
            )}

            {/* Features you'll lose (cancelled state) */}
            {state === 'cancelled' && (
              <div className="mt-3">
                <p className="mb-2 text-sm font-medium text-foreground">
                  {t('subscription.featuresYouLose')}
                </p>
                <ul className="space-y-1">
                  {PREMIUM_ONLY_FEATURES.map((feature) => (
                    <li
                      key={feature.labelKey}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                      {t(feature.labelKey, { ns: 'upgrade' })}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="mt-4">
        {state === 'free' && (
          <Button
            onClick={() => {
              handleActionClick('subscribe_now');
              navigate('/upgrade');
            }}
          >
            {t('subscription.subscribeNow')}
          </Button>
        )}

        {state === 'trialing' && (
          <Button
            onClick={() => {
              handleActionClick('subscribe_now');
              navigate('/upgrade');
            }}
          >
            {t('subscription.subscribeNow')}
          </Button>
        )}

        {(state === 'active' || state === 'past_due') && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="inline-block">
                <Button disabled>{t('subscription.manageSubscription')}</Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('subscription.comingSoon')}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {state === 'cancelled' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="inline-block">
                <Button disabled>{t('subscription.reactivate')}</Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('subscription.comingSoon')}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
};
