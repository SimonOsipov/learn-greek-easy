import React from 'react';

import { Crown, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { User } from '@/types/auth';

interface ProfileHeaderProps {
  user: User;
  onAvatarClick?: () => void;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({ user, onAvatarClick }) => {
  const { t, i18n } = useTranslation('profile');

  // Generate initials from user name
  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Role badge configuration
  const getRoleBadge = () => {
    switch (user.role) {
      case 'admin':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            {t('header.roles.admin')}
          </Badge>
        );
      case 'premium':
        return (
          <Badge className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700">
            <Crown className="h-3 w-3" />
            {t('header.roles.premium')}
          </Badge>
        );
      case 'free':
      default:
        return <Badge variant="secondary">{t('header.roles.free')}</Badge>;
    }
  };

  // Format member since date
  const memberSince = new Date(user.stats.joinedDate).toLocaleDateString(i18n.language, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="p-6">
      <div className="flex flex-col items-center text-center">
        {/* Avatar */}
        {onAvatarClick ? (
          <button
            onClick={onAvatarClick}
            className="group relative mb-4 transition-transform hover:scale-105"
            type="button"
          >
            <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-2xl font-bold text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <span className="text-xs font-medium text-white">{t('header.change')}</span>
            </div>
          </button>
        ) : (
          <div className="relative mb-4">
            <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-2xl font-bold text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
        )}

        {/* User Info */}
        <div className="mb-3">
          <h2 className="mb-1 text-xl font-bold text-foreground">{user.name}</h2>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>

        {/* Role Badge */}
        <div className="mb-4">{getRoleBadge()}</div>

        {/* Metadata */}
        <div className="w-full border-t border-border pt-4">
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">{t('header.memberSince')}</span>
              <span className="font-medium text-foreground">{memberSince}</span>
            </div>
            <div className="flex flex-col border-l border-border pl-4">
              <span className="text-xs text-muted-foreground">{t('header.lastActive')}</span>
              <span className="font-medium text-foreground">
                {user.stats.lastActivity
                  ? new Date(user.stats.lastActivity).toLocaleDateString(i18n.language, {
                      month: 'short',
                      day: 'numeric',
                    })
                  : t('header.activeNow')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
