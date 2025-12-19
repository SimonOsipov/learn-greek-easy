import React, { useState } from 'react';

import { User, Settings, Shield, Menu, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Import section components
import { PersonalInfoSection } from '@/components/profile/PersonalInfoSection';
import { PreferencesSection } from '@/components/profile/PreferencesSection';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { SecuritySection } from '@/components/profile/SecuritySection';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

type ProfileSection = 'personal' | 'preferences' | 'security';

interface NavigationItem {
  id: ProfileSection;
  labelKey: string;
  icon: typeof User;
}

export const Profile: React.FC = () => {
  const { t } = useTranslation('profile');
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<ProfileSection>('personal');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (!user) {
    return null;
  }

  // Navigation items configuration
  const navigationItems: NavigationItem[] = [
    { id: 'personal', labelKey: 'page.tabs.personalInfo', icon: User },
    { id: 'preferences', labelKey: 'page.tabs.preferences', icon: Settings },
    { id: 'security', labelKey: 'page.tabs.security', icon: Shield },
  ];

  const renderSection = () => {
    switch (activeSection) {
      case 'personal':
        return <PersonalInfoSection user={user} />;
      case 'preferences':
        return <PreferencesSection user={user} />;
      case 'security':
        return <SecuritySection />;
      default:
        return null;
    }
  };

  return (
    <div data-testid="profile-page" className="min-h-screen bg-background">
      <div className="container mx-auto max-w-7xl px-4 py-6">
        {/* Page Header - Always visible */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">{t('page.title')}</h1>
          {/* Mobile menu toggle */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="md:hidden"
            aria-label={isSidebarOpen ? t('page.closeMenu') : t('page.openMenu')}
          >
            {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {/* Main Layout */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Sidebar */}
          <aside className={cn('md:col-span-1', isSidebarOpen ? 'block' : 'hidden md:block')}>
            <Card className="overflow-hidden">
              {/* Profile Header */}
              <ProfileHeader user={user} />

              {/* Navigation */}
              <nav className="border-t border-border p-4">
                <ul className="space-y-1">
                  {navigationItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.id}>
                        <button
                          onClick={() => {
                            setActiveSection(item.id);
                            setIsSidebarOpen(false);
                          }}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                            activeSection === item.id
                              ? 'bg-primary/10 text-primary'
                              : 'text-muted-foreground hover:bg-muted'
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {t(item.labelKey)}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </Card>
          </aside>

          {/* Main Content */}
          <main className="md:col-span-2">
            <Card className="overflow-hidden">{renderSection()}</Card>
          </main>
        </div>
      </div>
    </div>
  );
};

export default Profile;
