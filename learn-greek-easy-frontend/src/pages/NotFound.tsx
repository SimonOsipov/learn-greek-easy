import { Home, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';

export const NotFound: React.FC = () => {
  const { t } = useTranslation('common');

  return (
    <div
      data-testid="not-found-page"
      className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-background to-purple-50 px-4 dark:from-blue-950/20 dark:to-purple-950/20"
    >
      <div className="max-w-md text-center">
        <div className="mb-4 text-6xl">🏛️</div>
        <h1 className="mb-2 text-4xl font-bold text-foreground">{t('notFoundPage.code')}</h1>
        <h2 className="mb-4 text-2xl font-semibold text-foreground">
          Ωχ! {t('notFoundPage.title')}
        </h2>
        <p className="mb-8 text-muted-foreground">{t('notFoundPage.description')}</p>
        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <Link to="/dashboard">
            <Button className="w-full sm:w-auto">
              <Home className="mr-2 h-4 w-4" />
              {t('notFoundPage.goToDashboard')}
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={() => window.history.back()}
            className="w-full sm:w-auto"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('notFoundPage.goBack')}
          </Button>
        </div>
      </div>
    </div>
  );
};
