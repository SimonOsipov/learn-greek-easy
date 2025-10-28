import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';

import { AppLayout } from '@/components/layout';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LayoutProvider } from '@/contexts/LayoutContext';
import { Dashboard } from '@/pages/Dashboard';
import { Login } from '@/pages/auth/Login';
import { Register } from '@/pages/auth/Register';
import { ForgotPassword } from '@/pages/auth/ForgotPassword';
import { useAuthStore } from '@/stores/authStore';

// Temporary placeholder pages - replace with actual pages

const DecksPage = () => (
  <div>
    <h1 className="mb-4 text-2xl font-semibold">All Decks</h1>
    <p>Decks list will go here.</p>
  </div>
);

const StatisticsPage = () => (
  <div>
    <h1 className="mb-4 text-2xl font-semibold">Statistics</h1>
    <p>Statistics will go here.</p>
  </div>
);

const SettingsPage = () => (
  <div>
    <h1 className="mb-4 text-2xl font-semibold">Settings</h1>
    <p>Settings will go here.</p>
  </div>
);

const ProfilePage = () => (
  <div>
    <h1 className="mb-4 text-2xl font-semibold">Profile</h1>
    <p>Profile will go here.</p>
  </div>
);

function App() {
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    // Check authentication status on app load
    checkAuth();
  }, [checkAuth]);

  return (
    <BrowserRouter>
      <TooltipProvider>
        <LayoutProvider>
          <Routes>
            {/* Authentication Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            {/* Main Application Routes */}
            <Route path="/" element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="dashboard" element={<Navigate to="/" replace />} />
              <Route path="decks" element={<DecksPage />} />
              <Route path="statistics" element={<StatisticsPage />} />
              <Route path="stats" element={<Navigate to="/statistics" replace />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="review" element={<Dashboard />} /> {/* Temporary */}
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster />
        </LayoutProvider>
      </TooltipProvider>
    </BrowserRouter>
  );
}

export default App;
