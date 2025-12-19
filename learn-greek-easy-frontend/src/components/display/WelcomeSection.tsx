import React from 'react';

import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

interface WelcomeSectionProps {
  userName: string;
  dueCount: number;
  streak: number;
  onStartReview?: () => void;
}

export const WelcomeSection: React.FC<WelcomeSectionProps> = ({
  userName,
  dueCount,
  streak,
  onStartReview,
}) => {
  const { t } = useTranslation('common');

  const getEncouragement = () => {
    if (streak > 7) return t('welcome.encouragement.incredible', { count: streak }) + ' 🔥';
    if (streak > 3) return t('welcome.encouragement.great', { count: streak });
    if (streak > 0) return t('welcome.encouragement.keepItUp', { count: streak });
    return t('welcome.encouragement.readyToStart');
  };

  return (
    <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="mb-2 text-xl font-semibold text-text-primary md:text-2xl">
          {t('welcome.greeting', { name: userName })} 👋
        </h2>
        <p className="text-text-muted">
          <Trans
            i18nKey="welcome.cardsToReview"
            ns="common"
            values={{ count: dueCount }}
            components={{ strong: <span className="font-semibold text-primary" /> }}
          />{' '}
          {getEncouragement()}
        </p>
      </div>
      <Button
        variant="success"
        size="lg"
        className="mt-4 transition-all hover:shadow-lg md:mt-0"
        onClick={onStartReview}
      >
        {t('welcome.startReview')}
      </Button>
    </div>
  );
};
