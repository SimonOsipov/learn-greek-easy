# Form & Route Protection Patterns

Form handling, validation, and protected route patterns.

[← Back to Main Style Guide](../Style-Guide.md)

---

## Protected Route Patterns

### Route Guard Implementation

All authenticated routes use `ProtectedRoute` component to enforce authentication.

**Basic Pattern**:
```tsx
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';

// In App.tsx route configuration
<Route path="/dashboard" element={
  <ProtectedRoute>
    <AppLayout>
      <Dashboard />
    </AppLayout>
  </ProtectedRoute>
} />
```

**With Role Requirements**:
```tsx
<Route path="/admin" element={
  <ProtectedRoute requiredRole="admin">
    <AdminDashboard />
  </ProtectedRoute>
} />
```

---

### Loading State Pattern

Show loading indicator while checking authentication status.

**Implementation** (from ProtectedRoute.tsx):
```tsx
import { Loader2 } from 'lucide-react';

if (isLoading) {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <div className="space-y-4 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Checking authentication...</p>
      </div>
    </div>
  );
}
```

---

### Return URL Pattern

Preserve intended destination when redirecting to login.

**Pattern** (from ProtectedRoute.tsx):
```tsx
import { Navigate, useLocation } from 'react-router-dom';

const location = useLocation();

if (!isAuthenticated) {
  // Save current location to return after login
  return (
    <Navigate
      to="/login"
      state={{ from: location.pathname + location.search }}
      replace
    />
  );
}
```

**In Login Page**:
```tsx
const location = useLocation();
const navigate = useNavigate();

const onSubmit = async (data: LoginFormData) => {
  await login(data.email, data.password);

  // Redirect to intended destination or default to dashboard
  const from = location.state?.from || '/dashboard';
  navigate(from, { replace: true });
};
```

---

### Session Management Pattern

Monitor session expiration and show warning dialog.

**Session Warning Dialog** (from SessionWarningDialog.tsx):
```tsx
import { Clock, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export const SessionWarningDialog: React.FC<SessionWarningDialogProps> = ({
  open,
  onExtendSession,
  remainingSeconds,
}) => {
  // Format remaining time as MM:SS
  const formattedTime = useMemo(() => {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [remainingSeconds]);

  const isUrgent = remainingSeconds < 60; // Last minute

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className={`h-5 w-5 ${isUrgent ? 'text-red-500' : 'text-orange-500'}`} />
            <DialogTitle>Session Expiring Soon</DialogTitle>
          </div>
        </DialogHeader>

        <Alert variant={isUrgent ? 'destructive' : 'default'} className="my-4">
          <Clock className="h-4 w-4" />
          <AlertDescription>
            <span className="font-semibold">Time remaining:</span>
            <span className={`ml-2 font-mono text-lg ${isUrgent ? 'text-red-600' : ''}`}>
              {formattedTime}
            </span>
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button onClick={onExtendSession} size="lg">
            Stay Logged In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
```

**Session Warning Timing**:
- Show warning: 5 minutes before expiration
- Update countdown: Every second
- Color coding: Orange (5-1 min), Red (< 1 min)
- Auto-logout: On expiration

---

### When to Use

- **ProtectedRoute**: All authenticated pages (Dashboard, Decks, Profile, Settings)
- **Loading State**: Every protected route during auth check
- **Return URL**: Any route that might be accessed directly via URL
- **Session Warning**: All protected routes (via AppLayout)

### Accessibility Considerations

- Loading state announced to screen readers
- Session warning has proper focus management
- Clear messaging about session expiration
- Keyboard navigation support (Tab, Enter, Escape)

### Related Components

- ProtectedRoute: `/src/components/auth/ProtectedRoute.tsx`
- SessionWarningDialog: `/src/components/auth/SessionWarningDialog.tsx`
- Auth Store: `@/stores/authStore`

---
