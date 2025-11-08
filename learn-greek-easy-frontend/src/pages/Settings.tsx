import React from 'react';
import { AccountSection, AppPreferencesSection, DangerZoneSection } from '@/components/settings';

const Settings: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="mt-2 text-muted-foreground">Manage your account and preferences.</p>
      </div>

      <div className="space-y-6">
        <AccountSection />
        <AppPreferencesSection />
        <DangerZoneSection />
      </div>
    </div>
  );
};

export default Settings;
