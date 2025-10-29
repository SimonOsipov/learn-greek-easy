import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { AppLayout } from '@/components/layout';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LayoutProvider } from '@/contexts/LayoutContext';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { PublicRoute } from '@/components/auth/PublicRoute';
import { Dashboard } from '@/pages/Dashboard';
import { Login } from '@/pages/auth/Login';
import { Register } from '@/pages/auth/Register';
import { ForgotPassword } from '@/pages/auth/ForgotPassword';
import { NotFound } from '@/pages/NotFound';
import { Unauthorized } from '@/pages/Unauthorized';

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

// Admin placeholder page
const AdminPanel = () => (
  <div>
    <h1 className="mb-4 text-2xl font-semibold">Admin Panel</h1>
    <p>Admin features will go here.</p>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <TooltipProvider>
        <LayoutProvider>
          <RouteGuard>
            <Routes>
              {/* Public Routes - redirect to dashboard if authenticated */}
              <Route element={<PublicRoute />}>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
              </Route>

              {/* Protected Routes - require authentication */}
              <Route element={<ProtectedRoute />}>
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
              </Route>

              {/* Admin Routes - require admin role */}
              <Route element={<ProtectedRoute requiredRole="admin" />}>
                <Route path="/admin" element={<AppLayout />}>
                  <Route index element={<AdminPanel />} />
                </Route>
              </Route>

              {/* Error Pages */}
              <Route path="/unauthorized" element={<Unauthorized />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </RouteGuard>
          <Toaster />
        </LayoutProvider>
      </TooltipProvider>
    </BrowserRouter>
  );
}

export default App;
