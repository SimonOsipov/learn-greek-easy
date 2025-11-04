import React from 'react';

import { Crown, Shield } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { User } from '@/types/auth';

interface ProfileHeaderProps {
  user: User;
  onAvatarClick?: () => void;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({ user, onAvatarClick }) => {
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
            Admin
          </Badge>
        );
      case 'premium':
        return (
          <Badge className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700">
            <Crown className="h-3 w-3" />
            Premium
          </Badge>
        );
      case 'free':
      default:
        return <Badge variant="secondary">Free</Badge>;
    }
  };

  // Format member since date
  const memberSince = new Date(user.stats.joinedDate).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="p-6">
      <div className="flex flex-col items-center text-center">
        {/* Avatar */}
        <button
          onClick={onAvatarClick}
          className="group relative mb-4 transition-transform hover:scale-105"
          type="button"
        >
          <Avatar className="h-24 w-24 border-4 border-white shadow-lg">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-2xl font-bold text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          {onAvatarClick && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <span className="text-xs font-medium text-white">Change</span>
            </div>
          )}
        </button>

        {/* User Info */}
        <div className="mb-3">
          <h2 className="mb-1 text-xl font-bold text-gray-900">{user.name}</h2>
          <p className="text-sm text-gray-600">{user.email}</p>
        </div>

        {/* Role Badge */}
        <div className="mb-4">{getRoleBadge()}</div>

        {/* Metadata */}
        <div className="w-full border-t border-gray-200 pt-4">
          <div className="flex items-center justify-center gap-4 text-sm text-gray-600">
            <div className="flex flex-col">
              <span className="text-xs text-gray-500">Member Since</span>
              <span className="font-medium text-gray-900">{memberSince}</span>
            </div>
            {user.stats.lastActivity && (
              <div className="flex flex-col border-l border-gray-200 pl-4">
                <span className="text-xs text-gray-500">Last Active</span>
                <span className="font-medium text-gray-900">
                  {new Date(user.stats.lastActivity).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
