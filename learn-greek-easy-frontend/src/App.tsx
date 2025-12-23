import { useEffect } from 'react';

import { GoogleOAuthProvider } from '@react-oauth/google';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { PublicRoute } from '@/components/auth/PublicRoute';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { ErrorBoundary } from '@/components/errors';
import { AppLayout } from '@/components/layout';
import { NotificationToastContainer } from '@/components/notifications';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AchievementNotificationManager } from '@/components/xp';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { LayoutProvider } from '@/contexts/LayoutContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import AchievementsPage from '@/pages/AchievementsPage';
import ActivityFeedTest from '@/pages/ActivityFeedTest';
import { ForgotPassword } from '@/pages/auth/ForgotPassword';
import { Login } from '@/pages/auth/Login';
import { Register } from '@/pages/auth/Register';
import { Dashboard } from '@/pages/Dashboard';
import { DeckDetailPage } from '@/pages/DeckDetailPage';
import { DecksPage } from '@/pages/DecksPage';
import { FeedbackPage } from '@/pages/FeedbackPage';
import { FlashcardReviewPage } from '@/pages/FlashcardReviewPage';
import { NotFound } from '@/pages/NotFound';
import { Profile } from '@/pages/Profile';
import { SessionSummaryPage } from '@/pages/SessionSummaryPage';
import Statistics from '@/pages/Statistics';
import { Unauthorized } from '@/pages/Unauthorized';
import { PostHogProvider } from '@/providers';
import { useAppStore, selectIsReady } from '@/stores/appStore';

// Admin placeholder page
const AdminPanel = () => (
  <div>
    <h1 className="mb-4 text-2xl font-semibold">Admin Panel</h1>
    <p>Admin features will go here.</p>
  </div>
);

function AppContent() {
  const isAppReady = useAppStore(selectIsReady);
  const setReactHydrated = useAppStore((state) => state.setReactHydrated);

  useEffect(() => {
    setReactHydrated();
  }, [setReactHydrated]);

  return (
    <div data-app-ready={isAppReady}>
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
              <Route path="decks/:id" element={<DeckDetailPage />} />
              <Route path="statistics" element={<Statistics />} />
              <Route path="stats" element={<Navigate to="/statistics" replace />} />
              <Route path="profile" element={<Profile />} />
              <Route path="achievements" element={<AchievementsPage />} />
              <Route path="feedback" element={<FeedbackPage />} />
              <Route path="activity-feed-test" element={<ActivityFeedTest />} />
            </Route>
            {/* Review page outside AppLayout for full-screen experience */}
            <Route path="decks/:deckId/review" element={<FlashcardReviewPage />} />
            {/* Session summary page outside AppLayout for full-screen experience */}
            <Route path="decks/:deckId/summary" element={<SessionSummaryPage />} />
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
      <AchievementNotificationManager />
      <NotificationToastContainer />
    </div>
  );
}

function App() {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  return (
    <ErrorBoundary>
      <GoogleOAuthProvider clientId={googleClientId}>
        <BrowserRouter>
          <PostHogProvider>
            <TooltipProvider>
              <LanguageProvider>
                <LayoutProvider>
                  <NotificationProvider>
                    <AppContent />
                  </NotificationProvider>
                </LayoutProvider>
              </LanguageProvider>
            </TooltipProvider>
          </PostHogProvider>
        </BrowserRouter>
      </GoogleOAuthProvider>
    </ErrorBoundary>
  );
}

export default App;
