import React from 'react';

import { Menu } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';

import { LogoutDialog } from '@/components/auth/LogoutDialog';
import { LanguageSwitcher } from '@/components/i18n';
import { NotificationsDropdown } from '@/components/notifications';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLayoutContext } from '@/contexts/LayoutContext';
import { cn } from '@/lib/utils';

import { PageContainer } from './PageContainer';

interface HeaderProps {
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({ className }) => {
  const { t } = useTranslation('common');
  const location = useLocation();
  const { toggleSidebar, isDesktop } = useLayoutContext();

  const navItems = [
    { path: '/', labelKey: 'nav.dashboard' },
    { path: '/decks', labelKey: 'nav.decks' },
    { path: '/statistics', labelKey: 'nav.statistics' },
    { path: '/achievements', labelKey: 'nav.achievements' },
    { path: '/feedback', labelKey: 'nav.feedback' },
  ];

  const isActiveRoute = (path: string) => {
    return location.pathname === path;
  };

  return (
    <header
      className={cn('sticky top-0 z-50 w-full border-b border-border-gray bg-white', className)}
    >
      <PageContainer>
        <div className="flex h-16 items-center justify-between">
          {/* Logo and Mobile Menu Toggle */}
          <div className="flex items-center space-x-4">
            {!isDesktop && (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="lg:hidden"
                aria-label={t('nav.toggleMenu')}
              >
                <Menu className="h-5 w-5" />
              </Button>
            )}

            <Link to="/" className="flex items-center space-x-2">
              <h1 className="text-xl font-semibold text-text-primary">Learn Greek Easy</h1>
            </Link>
          </div>

          {/* Desktop Navigation */}
          {isDesktop && (
            <nav className="hidden items-center space-x-6 lg:flex">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'text-sm font-medium transition-colors hover:text-primary',
                    isActiveRoute(item.path) ? 'text-primary' : 'text-text-secondary'
                  )}
                >
                  {t(item.labelKey)}
                </Link>
              ))}
            </nav>
          )}

          {/* Right side: Language, Notifications and User Menu */}
          <div className="flex items-center space-x-3">
            {/* Language Switcher */}
            <LanguageSwitcher variant="icon" />

            {/* Notifications */}
            <NotificationsDropdown />

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-9 w-9 rounded-full"
                  aria-label={t('nav.userMenu')}
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src="" alt="User" />
                    <AvatarFallback className="bg-gradient-to-br from-gradient-from to-gradient-to text-white">
                      JD
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">John Doe</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      john.doe@example.com
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile">{t('nav.profile')}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings">{t('nav.settings')}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem>{t('nav.help')}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
                  <LogoutDialog />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </PageContainer>
    </header>
  );
};
