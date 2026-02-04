// src/components/admin/AdminCardErrorCard.tsx

import React from 'react';

import { formatDistanceToNow } from 'date-fns';
import { el } from 'date-fns/locale/el';
import { ru } from 'date-fns/locale/ru';
import { BookOpen, Globe, MessageSquare, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { AdminCardErrorResponse } from '@/types/cardError';
import { CARD_ERROR_STATUS_CONFIG } from '@/types/cardError';

interface AdminCardErrorCardProps {
  errorReport: AdminCardErrorResponse;
  onRespond: (error: AdminCardErrorResponse) => void;
}

/**
 * Admin card error report card component
 *
 * Displays a card error report with admin-specific controls:
 * - Status badge
 * - Card type badge with icon
 * - Reporter info
 * - Description
 * - Admin notes (if present)
 * - Respond button
 */
export const AdminCardErrorCard: React.FC<AdminCardErrorCardProps> = ({
  errorReport,
  onRespond,
}) => {
  const { t, i18n } = useTranslation('admin');

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

  const statusConfig = CARD_ERROR_STATUS_CONFIG[errorReport.status];
  const hasResponse = !!errorReport.admin_notes;

  const CardTypeIcon = errorReport.card_type === 'VOCABULARY' ? BookOpen : Globe;

  return (
    <Card data-testid="admin-card-error-card">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 space-y-2">
            {/* Status and Card Type badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}
                data-testid="card-error-status-badge"
              >
                {t(`cardErrors.statuses.${errorReport.status.toLowerCase()}`)}
              </span>
              <span
                className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                data-testid="card-error-type-badge"
              >
                <CardTypeIcon className="h-3 w-3" />
                {t(`cardErrors.cardTypes.${errorReport.card_type.toLowerCase()}`)}
              </span>
            </div>

            {/* Reporter and timestamp */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {errorReport.reporter.full_name || t('cardErrors.anonymousUser')}
              </span>
              <span>
                {formatDistanceToNow(new Date(errorReport.created_at), {
                  addSuffix: true,
                  locale: getDateLocale(),
                })}
              </span>
            </div>
          </div>

          {/* Respond button */}
          <div className="flex items-center gap-2">
            <Button
              variant={hasResponse ? 'outline' : 'default'}
              size="sm"
              onClick={() => onRespond(errorReport)}
              data-testid="card-error-respond-button"
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              {hasResponse ? t('cardErrors.editResponse') : t('cardErrors.respond')}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Error description */}
        <p
          className="whitespace-pre-wrap text-sm text-muted-foreground"
          data-testid="card-error-description"
        >
          {errorReport.description}
        </p>

        {/* Admin notes if present */}
        {hasResponse && (
          <div className="mt-4 rounded-lg border-l-4 border-primary bg-muted/50 p-3">
            <p className="mb-1 text-xs font-medium text-primary">
              {t('cardErrors.adminNotesLabel')}
            </p>
            <p className="whitespace-pre-wrap text-sm" data-testid="card-error-admin-notes">
              {errorReport.admin_notes}
            </p>
            {errorReport.resolved_at && (
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(errorReport.resolved_at), {
                  addSuffix: true,
                  locale: getDateLocale(),
                })}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
