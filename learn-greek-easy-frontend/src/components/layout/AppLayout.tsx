import React, { useEffect } from 'react';

import { Home, Layers, BarChart3, User } from 'lucide-react';
import { Outlet, useLocation, Link } from 'react-router-dom';

import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useLayoutContext } from '@/contexts/LayoutContext';
import { cn } from '@/lib/utils';

import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { PageContainer } from './PageContainer';

export const AppLayout: React.FC = () => {
  const location = useLocation();
  const { isMobile, isDesktop, isSidebarOpen, closeSidebar } = useLayoutContext();

  // Close sidebar on route change
  useEffect(() => {
    closeSidebar();
  }, [location.pathname, closeSidebar]);

  const sidebarNavItems = [
    { path: '/', label: 'Dashboard', icon: Home },
    { path: '/decks', label: 'All Decks', icon: Layers },
    { path: '/statistics', label: 'Statistics', icon: BarChart3 },
    { path: '/profile', label: 'Profile', icon: User },
  ];

  const isActiveRoute = (path: string) => {
    return location.pathname === path;
  };

  return (
    <div className="min-h-screen bg-bg-page">
      {/* Header - Always visible */}
      <Header />

      {/* Mobile Sidebar (Sheet) */}
      {!isDesktop && (
        <Sheet open={isSidebarOpen} onOpenChange={closeSidebar}>
          <SheetContent side="left" className="w-[280px] p-0">
            <div className="flex h-full flex-col">
              {/* Sidebar Header */}
              <div className="border-b border-border-gray p-6">
                <h2 className="text-lg font-semibold">Menu</h2>
              </div>

              {/* Sidebar Navigation */}
              <nav className="flex-1 p-4">
                <div className="space-y-2">
                  {sidebarNavItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActiveRoute(item.path);

                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={cn(
                          'flex items-center space-x-3 rounded-md px-3 py-2 transition-colors',
                          active
                            ? 'bg-primary/10 text-primary'
                            : 'text-text-secondary hover:bg-secondary hover:text-text-primary'
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="font-medium">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </nav>
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Main Content Area */}
      <main
        className={cn(
          'flex-1',
          isMobile ? 'pb-20' : 'pb-8' // Extra padding for mobile bottom nav
        )}
      >
        <PageContainer className="py-6">
          <Outlet />
        </PageContainer>
      </main>

      {/* Mobile Bottom Navigation */}
      {!isDesktop && <MobileNav />}
    </div>
  );
};
