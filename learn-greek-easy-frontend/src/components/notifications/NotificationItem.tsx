import React from 'react';

import { formatDistanceToNow } from 'date-fns';
import { BookOpen, Flame, Info, Star, Trophy, type LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { cn } from '@/lib/utils';
import type { Notification, NotificationType } from '@/types';

/**
 * Icon and color configuration for each notification type
 */
const notificationConfig: Record<NotificationType, { icon: LucideIcon; colorClass: string }> = {
  streak_milestone: { icon: Flame, colorClass: 'text-warning' },
  cards_due: { icon: BookOpen, colorClass: 'text-info' },
  deck_completed: { icon: Trophy, colorClass: 'text-success' },
  achievement: { icon: Star, colorClass: 'text-gradient-from' },
  system: { icon: Info, colorClass: 'text-muted-foreground' },
};

interface NotificationItemProps {
  notification: Notification;
  onClose?: () => void;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onClose }) => {
  const navigate = useNavigate();
  const { icon: Icon, colorClass } = notificationConfig[notification.type];

  const handleClick = () => {
    if (notification.href) {
      navigate(notification.href);
      onClose?.();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  };

  const relativeTime = formatDistanceToNow(notification.timestamp, { addSuffix: true });

  return (
    <div
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-md p-3 transition-colors hover:bg-accent',
        !notification.read && 'bg-accent/50',
        notification.href && 'cursor-pointer'
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={notification.href ? 'button' : undefined}
      tabIndex={notification.href ? 0 : undefined}
      aria-label={notification.href ? `${notification.title} - Click to view` : undefined}
    >
      {/* Icon */}
      <div className={cn('mt-0.5 flex-shrink-0', colorClass)}>
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
