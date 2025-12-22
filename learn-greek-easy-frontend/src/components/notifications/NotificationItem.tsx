import React from 'react';

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
  daily_goal_complete: { icon: CheckCircle, colorClass: 'text-success' },
  level_up: { icon: ArrowUp, colorClass: 'text-primary' },
  streak_at_risk: { icon: Flame, colorClass: 'text-warning' },
  streak_lost: { icon: HeartCrack, colorClass: 'text-destructive' },
  welcome: { icon: Hand, colorClass: 'text-info' },
};

// Fallback for unknown types
const defaultConfig = { icon: Info, colorClass: 'text-muted-foreground' };

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
  const { i18n } = useTranslation();
  const config = notificationConfig[notification.type] || defaultConfig;
  const Icon = config.icon;

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
      navigate(notification.action_url);
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
    >
      {/* Icon */}
      <div className={cn('mt-0.5 flex-shrink-0', config.colorClass)}>
        <Icon className="h-5 w-5" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{notification.title}</p>
        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{notification.message}</p>
        <p className="mt-1 text-xs text-muted-foreground">{relativeTime}</p>
      </div>

      {/* Unread indicator */}
      {!notification.read && (
        <div className="mt-1.5 flex-shrink-0">
          <div className="h-2 w-2 rounded-full bg-primary" />
        </div>
      )}
    </div>
  );
};
