import React, { useState } from 'react';

import { formatDistanceToNow } from 'date-fns';
import { el } from 'date-fns/locale/el';
import { ru } from 'date-fns/locale/ru';
import {
  ArrowUp,
  CheckCircle,
  Flame,
  Hand,
  HeartCrack,
  Info,
  Megaphone,
  MessageSquareText,
  RefreshCw,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { cn } from '@/lib/utils';
import type { Notification, NotificationType } from '@/types/notification';

/**
 * Icon and color configuration for each notification type
 */
const notificationConfig: Record<NotificationType, { icon: LucideIcon; colorClass: string }> = {
  achievement_unlocked: { icon: Trophy, colorClass: 'text-warning' },
  admin_announcement: { icon: Megaphone, colorClass: 'text-blue-500' },
  daily_goal_complete: { icon: CheckCircle, colorClass: 'text-success' },
  level_up: { icon: ArrowUp, colorClass: 'text-primary' },
  streak_at_risk: { icon: Flame, colorClass: 'text-warning' },
  streak_lost: { icon: HeartCrack, colorClass: 'text-destructive' },
  welcome: { icon: Hand, colorClass: 'text-info' },
  feedback_response: { icon: MessageSquareText, colorClass: 'text-info' },
  feedback_status_change: { icon: RefreshCw, colorClass: 'text-primary' },
};

// Fallback for unknown types
const defaultConfig = { icon: Info, colorClass: 'text-muted-foreground' };

// Threshold for showing "Read more" toggle
const MESSAGE_TRUNCATION_THRESHOLD = 100;

/**
 * Check if a URL is external (starts with http:// or https://)
 */
const isExternalUrl = (url: string): boolean => {
  return url.startsWith('http://') || url.startsWith('https://');
};

interface NotificationItemProps {
  notification: Notification;
  onClose?: () => void;
  onMarkAsRead?: (id: string) => void;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onClose,
  onMarkAsRead,
}) => {
  const navigate = useNavigate();
  const { i18n, t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const config = notificationConfig[notification.type] || defaultConfig;
  const Icon = config.icon;

  const needsTruncation = notification.message.length > MESSAGE_TRUNCATION_THRESHOLD;

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

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

  const handleClick = () => {
    // Mark as read when clicked
    if (!notification.read && onMarkAsRead) {
      onMarkAsRead(notification.id);
    }

    if (notification.action_url) {
      // External URLs open in new tab, internal URLs use React Router
      if (isExternalUrl(notification.action_url)) {
        window.open(notification.action_url, '_blank', 'noopener,noreferrer');
      } else {
        navigate(notification.action_url);
      }
      onClose?.();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  };

  const relativeTime = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
    locale: getDateLocale(),
  });

  return (
    <div
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-md p-3 transition-colors hover:bg-accent',
        !notification.read && 'bg-accent/50'
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={notification.action_url ? 'button' : undefined}
      tabIndex={notification.action_url ? 0 : undefined}
      aria-label={notification.action_url ? `${notification.title} - Click to view` : undefined}
      data-testid={`notification-item-${notification.id}`}
    >
      {/* Icon */}
      <div className={cn('mt-0.5 flex-shrink-0', config.colorClass)}>
        <Icon className="h-5 w-5" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground" data-testid="notification-title">
          {notification.title}
        </p>
        <p
          className={cn(
            'mt-0.5 text-sm text-muted-foreground',
            !isExpanded && needsTruncation && 'line-clamp-2'
          )}
          data-testid="notification-message"
          aria-expanded={needsTruncation ? isExpanded : undefined}
        >
          {notification.message}
        </p>
        {needsTruncation && (
          <button
            type="button"
            onClick={handleToggleExpand}
            className="mt-1 text-xs font-medium text-primary hover:underline"
            data-testid="notification-toggle-expand"
          >
            {isExpanded ? t('notifications.showLess') : t('notifications.readMore')}
          </button>
        )}
        <p className="mt-1 text-xs text-muted-foreground" data-testid="notification-timestamp">
          {relativeTime}
        </p>
      </div>

      {/* Unread indicator */}
      {!notification.read && (
        <div className="mt-1.5 flex-shrink-0" data-testid="notification-unread-indicator">
          <div className="h-2 w-2 rounded-full bg-primary" />
        </div>
      )}
    </div>
  );
};
