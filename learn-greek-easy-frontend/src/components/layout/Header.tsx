import React from 'react';

import { Menu, ChevronDown, Crown, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';

import { LogoutDialog } from '@/components/auth/LogoutDialog';
import { LanguageSwitcher } from '@/components/i18n';
import { NotificationsDropdown } from '@/components/notifications';
import { ThemeSwitcher } from '@/components/theme';
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
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

import { PageContainer } from './PageContainer';

interface NavChild {
  path: string;
  labelKey: string;
}

interface NavItem {
  path: string;
  labelKey: string;
  children?: NavChild[];
}

interface HeaderProps {
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({ className }) => {
  const { t } = useTranslation('common');
  const location = useLocation();
  const { toggleSidebar, isDesktop } = useLayoutContext();
  const { user } = useAuth();

  // Generate initials from user name (e.g., "John Doe" -> "JD")
  const initials =
    user?.name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U';

  const navItems: NavItem[] = [
    { path: '/dashboard', labelKey: 'nav.dashboard' },
    {
      path: '/decks',
      labelKey: 'nav.decks',
      children: [
        { path: '/decks', labelKey: 'nav.decksDropdown.allDecks' },
        { path: '/my-decks', labelKey: 'nav.decksDropdown.myDecks' },
      ],
    },
    {
      path: '/practice',
      labelKey: 'nav.practice',
      children: [{ path: '/practice/culture-exam', labelKey: 'nav.practiceDropdown.cultureExam' }],
    },
    {
      path: '/statistics',
      labelKey: 'nav.statistics',
      children: [
        { path: '/statistics', labelKey: 'nav.generalProgress' },
        { path: '/achievements', labelKey: 'nav.achievements' },
      ],
    },
    { path: '/feedback', labelKey: 'nav.feedback' },
  ];

  const isActiveRoute = (path: string) => {
    return location.pathname === path;
  };

  const isActiveParent = (item: NavItem) => {
    if (!item.children) return false;
    return item.children.some((child) => location.pathname === child.path);
  };

  return (
    <header
      className={cn('sticky top-0 z-50 w-full border-b border-border bg-background', className)}
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

            <Link to="/dashboard" className="flex items-center space-x-2">
              <h1 className="text-xl font-semibold text-foreground">Learn Greek Easy</h1>
            </Link>
          </div>

          {/* Desktop Navigation */}
          {isDesktop && (
            <nav className="hidden items-center space-x-6 lg:flex">
              {navItems.map((item) =>
                item.children ? (
                  <DropdownMenu key={item.path}>
                    <DropdownMenuTrigger
                      className={cn(
                        'flex items-center gap-1 text-sm font-medium transition-colors hover:text-primary focus:outline-none',
                        isActiveParent(item) ? 'text-primary' : 'text-muted-foreground'
                      )}
                      data-testid={`${item.path.replace('/', '')}-dropdown-trigger`}
                    >
                      {t(item.labelKey)}
                      <ChevronDown className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {item.children.map((child) => (
                        <DropdownMenuItem key={child.path} asChild>
                          <Link
                            to={child.path}
                            className={cn(
                              'w-full',
                              isActiveRoute(child.path) ? 'text-primary' : ''
                            )}
                          >
                            {t(child.labelKey)}
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      'text-sm font-medium transition-colors hover:text-primary',
                      isActiveRoute(item.path) ? 'text-primary' : 'text-muted-foreground'
                    )}
                  >
                    {t(item.labelKey)}
                  </Link>
                )
              )}
            </nav>
          )}

          {/* Right side: Theme, Language, Notifications and User Menu */}
          <div className="flex items-center space-x-3">
            {/* Theme Switcher */}
            <ThemeSwitcher />

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
                  data-testid="user-menu-trigger"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user?.avatar || ''} alt={user?.name || 'User'} />
                    <AvatarFallback className="bg-gradient-to-br from-gradient-from to-gradient-to text-white">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.name || 'User'}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email || ''}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {t('nav.profile')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  data-testid="premium-menu-item"
                  onClick={(e) => e.preventDefault()}
                  className="flex cursor-pointer items-center gap-2"
                >
                  <Crown className="h-4 w-4 text-amber-500" />
                  {t('nav.premium')}
                </DropdownMenuItem>
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
