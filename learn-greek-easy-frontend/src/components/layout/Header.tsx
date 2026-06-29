import React, { useCallback, useState } from 'react';

import { Menu, ChevronDown, Crown, User, CircleHelp, Sun, Moon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { LogoutDialog } from '@/components/auth/LogoutDialog';
import { LanguageSwitcher } from '@/components/i18n';
import { NotificationsDropdown } from '@/components/notifications';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLayoutContext } from '@/contexts/LayoutContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { tDynamic } from '@/i18n/tDynamic';
import { track } from '@/lib/analytics';
import { APP_NAME } from '@/lib/constants';
import { startTour, buildTourSteps, waitForElement } from '@/lib/tour';
import { cn } from '@/lib/utils';

import { PageContainer } from './PageContainer';

interface NavChild {
  path: string;
  labelKey: string;
  /** When true, treat any pathname starting with `path` (followed by `/` or end) as active. */
  matchPrefix?: boolean;
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
  const navigate = useNavigate();
  const { toggleSidebar, isDesktop } = useLayoutContext();
  const { user, updateProfile } = useAuth();
  const { currentTheme, toggleTheme } = useTheme();

  const [tourRunning, setTourRunning] = useState(false);

  const handleStartTour = useCallback(async () => {
    if (tourRunning) return;
    setTourRunning(true);
    try {
      if (location.pathname !== '/dashboard') {
        navigate('/dashboard');
        await waitForElement('[data-testid="metrics-section"]', 3000);
      }
      await startTour(buildTourSteps(navigate, t), {
        trigger: 'manual',
        t,
        onAnalyticsEvent: (event, props) => {
          track(event, props);
        },
        onPersistCompletion: () => {
          updateProfile({ tourCompletedAt: new Date().toISOString() }).catch(() => {
            // best-effort server persistence; localStorage already set
          });
        },
      });
    } catch {
      // keep UI stable if tour bootstrap fails
    } finally {
      setTourRunning(false);
    }
  }, [tourRunning, location.pathname, navigate, t, updateProfile]);

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
        { path: '/situations', labelKey: 'nav.decksDropdown.situations' },
        { path: '/culture', labelKey: 'nav.decksDropdown.culture', matchPrefix: true },
      ],
    },
    {
      path: '/practice',
      labelKey: 'nav.practice',
      children: [
        { path: '/practice/culture-exam', labelKey: 'nav.practiceDropdown.cultureExam' },
        { path: '/practice/exercises', labelKey: 'nav.practiceDropdown.exercises' },
        { path: '/news', labelKey: 'nav.practiceDropdown.newsFeed' },
      ],
    },
    {
      path: '/statistics',
      labelKey: 'nav.statistics',
      children: [
        { path: '/statistics', labelKey: 'nav.generalProgress' },
        { path: '/achievements', labelKey: 'nav.achievements' },
      ],
    },
    {
      path: '/feedback',
      labelKey: 'nav.feedback',
      children: [
        { path: '/feedback', labelKey: 'nav.feedbackDropdown.feedback' },
        { path: '/changelog', labelKey: 'nav.feedbackDropdown.changelog' },
      ],
    },
  ];

  const isActiveRoute = (path: string) => {
    return location.pathname === path;
  };

  const matchesPrefix = (pathname: string, prefix: string) =>
    pathname === prefix || pathname.startsWith(prefix + '/');

  const isActiveChild = (child: NavChild) =>
    child.matchPrefix
      ? matchesPrefix(location.pathname, child.path)
      : location.pathname === child.path;

  const isActiveParent = (item: NavItem) => {
    if (!item.children) return false;
    return item.children.some(isActiveChild);
  };

  return (
    <header className={cn('va-top', className)}>
      <PageContainer>
        <div className="db-top">
          {/* Brand + Mobile Menu Toggle */}
          <div className="flex items-center gap-3">
            {!isDesktop && (
              <button
                className="icon-btn lg:hidden"
                onClick={toggleSidebar}
                aria-label={t('nav.toggleMenu')}
              >
                <Menu className="h-5 w-5" />
              </button>
            )}

            <Link to="/dashboard" className="va-brand">
              <span className="brand-mark">Ελ</span>
              <span className="brand-text">{APP_NAME}</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          {isDesktop && (
            <nav className="va-nav" data-testid="main-nav">
              {navItems.map((item) =>
                item.children ? (
                  <DropdownMenu key={item.path}>
                    <DropdownMenuTrigger
                      className={cn(
                        'flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:text-primary focus:outline-none',
                        isActiveParent(item) ? 'active text-primary' : 'text-muted-foreground'
                      )}
                      data-testid={`${item.path.replace('/', '')}-dropdown-trigger`}
                    >
                      {tDynamic(t, item.labelKey)}
                      <ChevronDown className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {item.children.map((child) => (
                        <DropdownMenuItem
                          key={child.path}
                          asChild
                          data-testid={`nav-item-${child.path.replace(/^\//, '').replace(/\//g, '-')}`}
                        >
                          <Link
                            to={child.path}
                            className={cn('w-full', isActiveChild(child) ? 'text-primary' : '')}
                          >
                            {tDynamic(t, child.labelKey)}
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
                      'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:text-primary',
                      isActiveRoute(item.path) ? 'active text-primary' : 'text-muted-foreground'
                    )}
                  >
                    {tDynamic(t, item.labelKey)}
                  </Link>
                )
              )}
            </nav>
          )}

          {/* Right side: Tour, Theme, Language, Notifications, User Menu */}
          <div className="va-top-right">
            {/* Tour Button */}
            <button
              className="btn btn-ghost btn-sm hidden items-center gap-1.5 lg:inline-flex"
              onClick={handleStartTour}
              disabled={tourRunning}
              aria-label={t('tour.button')}
              data-testid="tour-button"
            >
              <CircleHelp className="h-4 w-4" />
              <span className="text-sm">{t('tour.button')}</span>
            </button>

            {/* Theme Switcher — plain .icon-btn to avoid Button cascade trap */}
            <button
              className="icon-btn"
              onClick={() => toggleTheme('header')}
              aria-label={
                currentTheme === 'light'
                  ? t('theme.switchToDark', 'Switch to dark mode')
                  : t('theme.switchToLight', 'Switch to light mode')
              }
              data-testid="theme-switcher"
            >
              {currentTheme === 'light' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>

            {/* Language Switcher */}
            <LanguageSwitcher variant="icon" iconButton />

            {/* Notifications */}
            <NotificationsDropdown />

            {/* User Menu — plain button trigger to avoid Button cascade trap */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="avatar avatar-blue"
                  aria-label={t('nav.userMenu')}
                  data-testid="user-menu-trigger"
                >
                  <Avatar className="h-full w-full">
                    <AvatarImage src={user?.avatar || ''} alt={user?.name || 'User'} />
                    <AvatarFallback className="bg-transparent text-xs font-bold tracking-wide text-inherit">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
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
                <DropdownMenuItem asChild>
                  <Link
                    to="/upgrade"
                    data-testid="premium-menu-item"
                    className="flex items-center gap-2"
                  >
                    <Crown className="h-4 w-4 text-amber-500" />
                    {user?.role === 'premium' || user?.role === 'admin'
                      ? t('nav.mySubscription')
                      : t('nav.upgradeToPremium')}
                  </Link>
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
