import React from 'react';

import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { AccountSection, DangerZoneSection, LanguageSection } from '@/components/settings';
import { Button } from '@/components/ui/button';

const Settings: React.FC = () => {
  const { t } = useTranslation('settings');
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-3">
          <Button
            data-testid="back-to-dashboard"
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            aria-label={t('page.backToDashboard')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">{t('page.title')}</h1>
        </div>
        <p className="ml-12 mt-2 text-muted-foreground">{t('page.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <LanguageSection />
          <AccountSection />
        </div>
        <div className="space-y-6">
          <DangerZoneSection />
        </div>
      </div>
    </div>
  );
};

export default Settings;
