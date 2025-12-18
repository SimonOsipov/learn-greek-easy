import React from 'react';

import { Home, Layers, BarChart3, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import { cn } from '@/lib/utils';

interface MobileNavProps {
  className?: string;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

const navItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home, href: '/' },
  { id: 'decks', label: 'Decks', icon: Layers, href: '/decks' },
  { id: 'stats', label: 'Stats', icon: BarChart3, href: '/statistics' },
  { id: 'profile', label: 'Profile', icon: User, href: '/profile' },
];

export const MobileNav: React.FC<MobileNavProps> = ({ className }) => {
  const location = useLocation();

  const isActive = (href: string) => {
    return location.pathname === href;
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
          const active = isActive(item.href);

          return (
            <Link
              key={item.id}
              to={item.href}
              className={cn(
                'flex min-w-[64px] flex-col items-center px-3 py-2 transition-colors',
                active ? 'text-primary' : 'text-text-muted hover:text-text-secondary'
              )}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="mb-1 h-5 w-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
