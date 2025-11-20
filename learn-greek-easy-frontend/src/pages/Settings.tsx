import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { AccountSection, AppPreferencesSection, DangerZoneSection } from '@/components/settings';
import { Button } from '@/components/ui/button';

const Settings: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Button
            data-testid="back-to-dashboard"
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dashboard')}
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>
        <p className="mt-2 text-muted-foreground ml-12">Manage your account and preferences.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <AccountSection />
          <AppPreferencesSection />
        </div>
        <div className="space-y-6">
          <DangerZoneSection />
        </div>
      </div>
    </div>
  );
};

export default Settings;
