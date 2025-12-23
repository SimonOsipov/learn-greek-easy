import React from 'react';

import { Home, Layers, BarChart3, User, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';

import { cn } from '@/lib/utils';

interface MobileNavProps {
  className?: string;
}

interface NavItem {
  id: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  /** Additional paths that should also highlight this nav item */
  additionalActivePaths?: string[];
}

const navItems: NavItem[] = [
  { id: 'home', labelKey: 'nav.home', icon: Home, href: '/' },
  { id: 'decks', labelKey: 'nav.decks', icon: Layers, href: '/decks' },
  {
    id: 'stats',
    labelKey: 'nav.stats',
    icon: BarChart3,
    href: '/statistics',
    additionalActivePaths: ['/achievements'],
  },
  { id: 'feedback', labelKey: 'nav.feedback', icon: MessageSquare, href: '/feedback' },
  { id: 'profile', labelKey: 'nav.profile', icon: User, href: '/profile' },
];

export const MobileNav: React.FC<MobileNavProps> = ({ className }) => {
  const { t } = useTranslation('common');
  const location = useLocation();

  const isActive = (item: NavItem) => {
    if (location.pathname === item.href) return true;
    if (item.additionalActivePaths) {
      return item.additionalActivePaths.includes(location.pathname);
    }
    return false;
  };

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 border-t border-border-gray bg-white shadow-nav lg:hidden',
        className
      )}
    >
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          const label = t(item.labelKey);

          return (
            <Link
              key={item.id}
              to={item.href}
              className={cn(
                'flex min-w-[64px] flex-col items-center px-3 py-2 transition-colors',
                active ? 'text-primary' : 'text-text-muted hover:text-text-secondary'
              )}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="mb-1 h-5 w-5" />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
