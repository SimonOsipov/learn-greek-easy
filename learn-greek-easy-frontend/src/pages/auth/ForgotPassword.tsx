import React from 'react';

import { ArrowLeft, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const ForgotPassword: React.FC = () => {
  const { t } = useTranslation('auth');

  return (
    <AuthLayout>
      <Card className="shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-purple-100">
              <Lock className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">{t('forgotPassword.title')}</CardTitle>
          <CardDescription>{t('forgotPassword.description')}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2 text-center">
            <p className="text-muted-foreground">
              Password reset functionality will be available soon.
            </p>
            <p className="text-sm text-muted-foreground">
              In the meantime, please contact support if you need help accessing your account.
            </p>
          </div>

          <div className="pt-4">
            <Button asChild variant="outline" className="w-full">
              <Link to="/login">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('forgotPassword.backToLogin')}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </AuthLayout>
  );
};
