import React, { useState } from 'react';

import { AlertCircle, Bell, Check, RefreshCw, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications } from '@/contexts/NotificationContext';

import { NotificationItem } from './NotificationItem';

export const NotificationsDropdown: React.FC = () => {
  const { t } = useTranslation('common');
  const [isOpen, setIsOpen] = useState(false);

  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    hasMore,
    loadMore,
    markAsRead,
    markAllAsRead,
    clearAll,
    fetchNotifications,
  } = useNotifications();

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  const handleClearAll = async () => {
    await clearAll();
  };

  const handleLoadMore = async () => {
    await loadMore();
  };

  const handleRetry = async () => {
    await fetchNotifications(true);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={t('notifications.title', 'Notifications')}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-warning text-[10px] font-medium text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="end" forceMount>
        {/* Header */}
        <DropdownMenuLabel className="flex items-center justify-between font-normal">
          <span className="text-sm font-semibold">{t('notifications.title', 'Notifications')}</span>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {unreadCount} {t('notifications.new', 'new')}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={handleMarkAllAsRead}
                  aria-label={t('notifications.markAllRead', 'Mark all as read')}
                >
                  <Check className="h-3 w-3" />
                </Button>
              </>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                onClick={handleClearAll}
                aria-label={t('notifications.clearAll', 'Clear all')}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Error State */}
        {error ? (
          <div className="flex h-[200px] flex-col items-center justify-center gap-3 p-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-center text-sm text-muted-foreground">
              {t('notifications.error', 'Failed to load notifications')}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              aria-label={t('notifications.retry', 'Retry')}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {t('actions.retry', 'Retry')}
            </Button>
          </div>
        ) : isLoading && notifications.length === 0 ? (
          /* Loading State */
          <div className="flex h-[200px] items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : notifications.length > 0 ? (
          /* Notifications List */
          <ScrollArea className="h-[300px]">
            <div className="flex flex-col gap-1 p-1">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onClose={handleClose}
                  onMarkAsRead={markAsRead}
                />
              ))}
              {hasMore && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 w-full text-xs"
                  onClick={handleLoadMore}
                  disabled={isLoading}
                  aria-label={t('notifications.loadMore', 'Load more')}
                >
                  {isLoading
                    ? t('loading', 'Loading...')
                    : t('notifications.loadMore', 'Load more')}
                </Button>
              )}
            </div>
          </ScrollArea>
        ) : (
          /* Empty State */
          <div className="flex h-[200px] items-center justify-center">
            <div className="text-center">
              <Bell className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">
                {t('notifications.empty', 'No notifications yet')}
              </p>
            </div>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
