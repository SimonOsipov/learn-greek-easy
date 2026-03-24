import { useEffect, useState } from 'react';

import { Helmet } from '@dr.pogodin/react-helmet';
import { AlertCircle, CheckCircle, Loader2, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { waitlistAPI } from '@/services/waitlistAPI';

type ConfirmState = 'pending' | 'loading' | 'confirmed' | 'error';

export const WaitlistConfirmPage: React.FC = () => {
  const { t } = useTranslation('waitlist');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [state, setState] = useState<ConfirmState>(token ? 'loading' : 'pending');

  useEffect(() => {
    if (!token) return;

    waitlistAPI
      .confirm(token)
      .then(() => setState('confirmed'))
      .catch(() => setState('error'));
  }, [token]);

  const icon = {
    pending: <Mail className="mx-auto mb-4 h-12 w-12 text-blue-500" />,
    loading: <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-muted-foreground" />,
    confirmed: <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />,
    error: <AlertCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />,
  }[state];

  const title = {
    pending: t('pending.title'),
    loading: t('pending.title'),
    confirmed: t('confirmed.title'),
    error: t('error.title'),
  }[state];

  const body = {
    pending: t('pending.body'),
    loading: t('pending.body'),
    confirmed: t('confirmed.body'),
    error: t('error.body'),
  }[state];

  return (
    <>
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
        <title>Waitlist - Greeklish</title>
      </Helmet>
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-background to-purple-50 px-4 dark:from-blue-950/20 dark:to-purple-950/20">
        <div className="max-w-md text-center">
          {icon}
          <h1 className="mb-2 text-2xl font-bold text-foreground">{title}</h1>
          <p className="mb-4 text-muted-foreground">{body}</p>
          {state === 'pending' && (
            <p className="mb-8 text-sm text-muted-foreground">{t('pending.spamHint')}</p>
          )}
          {state !== 'loading' && (
            <Link to="/">
              <Button variant="outline">{t('backToHome')}</Button>
            </Link>
          )}
        </div>
      </div>
    </>
  );
};
