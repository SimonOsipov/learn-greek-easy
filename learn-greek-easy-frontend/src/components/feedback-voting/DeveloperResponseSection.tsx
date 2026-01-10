// src/components/feedback-voting/DeveloperResponseSection.tsx

import React from 'react';

import { formatDistanceToNow } from 'date-fns';
import { el } from 'date-fns/locale/el';
import { ru } from 'date-fns/locale/ru';
import { MessageSquareText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface DeveloperResponseSectionProps {
  response: string;
  respondedAt: string;
}

export const DeveloperResponseSection: React.FC<DeveloperResponseSectionProps> = ({
  response,
  respondedAt,
}) => {
  const { t, i18n } = useTranslation('feedback');

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

  const relativeTime = formatDistanceToNow(new Date(respondedAt), {
    addSuffix: true,
    locale: getDateLocale(),
  });

  return (
    <div
      className="mx-6 mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30"
      data-testid="developer-response-section"
    >
      <div className="mb-2 flex items-center gap-2">
        <MessageSquareText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-300">
          {t('developerResponse.title')}
        </h4>
        <span className="text-xs text-blue-600/70 dark:text-blue-400/70">{relativeTime}</span>
      </div>
      <p
        className="whitespace-pre-wrap text-sm text-blue-800 dark:text-blue-200"
        data-testid="developer-response-text"
      >
        {response}
      </p>
    </div>
  );
};
