import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, Settings, BarChart3, Shield, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Import section components
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { PersonalInfoSection } from '@/components/profile/PersonalInfoSection';
import { StatsSection } from '@/components/profile/StatsSection';
import { PreferencesSection } from '@/components/profile/PreferencesSection';
import { SecuritySection } from '@/components/profile/SecuritySection';

type ProfileSection = 'personal' | 'stats' | 'preferences' | 'security';

interface NavigationItem {
  id: ProfileSection;
  label: string;
  icon: typeof User;
}

export const Profile: React.FC = () => {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<ProfileSection>('personal');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (!user) {
    return null;
  }

  // Navigation items configuration
  const navigationItems: NavigationItem[] = [
    { id: 'personal', label: 'Personal Info', icon: User },
    { id: 'stats', label: 'Statistics', icon: BarChart3 },
    { id: 'preferences', label: 'Preferences', icon: Settings },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  const renderSection = () => {
    switch (activeSection) {
      case 'personal':
        return <PersonalInfoSection user={user} />;
      case 'stats':
        return <StatsSection stats={user.stats} />;
      case 'preferences':
        return <PreferencesSection user={user} />;
      case 'security':
        return <SecuritySection />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Mobile Header */}
        <div className="mb-6 flex items-center justify-between md:hidden">
          <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {/* Main Layout */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Sidebar */}
          <aside
            className={cn(
              'md:col-span-1',
              isSidebarOpen ? 'block' : 'hidden md:block'
            )}
          >
            <Card className="overflow-hidden">
              {/* Profile Header */}
              <ProfileHeader user={user} />

              {/* Navigation */}
              <nav className="border-t border-gray-200 p-4">
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
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-gray-700 hover:bg-gray-100'
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              {/* Quick Stats */}
              <div className="border-t border-gray-200 bg-gray-50 p-4">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Quick Stats
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-lg">🔥</span>
                    <span className="font-medium text-gray-900">
                      {user.stats.streak} day{user.stats.streak !== 1 ? 's' : ''} streak
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-lg">📚</span>
                    <span className="font-medium text-gray-900">
                      {user.stats.wordsLearned} words learned
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-lg">⭐</span>
                    <span className="font-medium text-gray-900">
                      {user.stats.totalXP.toLocaleString()} XP
                    </span>
                  </div>
                </div>
              </div>
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
