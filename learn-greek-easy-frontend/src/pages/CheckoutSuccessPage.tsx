import React, { useEffect, useRef } from 'react';

import { CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { reportAPIError } from '@/lib/errorReporting';
import { billingAPI } from '@/services/billingAPI';
import { useAuthStore } from '@/stores/authStore';

export const CheckoutSuccessPage: React.FC = () => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const hasVerified = useRef(false);

  useEffect(() => {
    if (!sessionId) {
      navigate('/dashboard', { replace: true });
    }
  }, [sessionId, navigate]);

  useEffect(() => {
    if (!sessionId || hasVerified.current) return;
    hasVerified.current = true;

    billingAPI
      .verifyCheckout(sessionId)
      .then(() => {
        useAuthStore.getState().checkAuth();
      })
      .catch((error: unknown) => {
        reportAPIError(error, { operation: 'verifyCheckout', silent: true });
      });
  }, [sessionId]);

  if (!sessionId) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-background to-purple-50 px-4 dark:from-blue-950/20 dark:to-purple-950/20">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50">
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle>{t('checkout.success.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{t('checkout.success.description')}</p>
          <Link to="/dashboard">
            <Button className="w-full">{t('checkout.success.goToDashboard')}</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
};
