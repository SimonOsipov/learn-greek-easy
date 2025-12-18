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

### When to Use

- **ProtectedRoute**: All authenticated pages (Dashboard, Decks, Profile, Settings)
- **Loading State**: Every protected route during auth check
- **Return URL**: Any route that might be accessed directly via URL

### Accessibility Considerations

- Loading state announced to screen readers
- Keyboard navigation support (Tab, Enter, Escape)

### Related Components

- ProtectedRoute: `/src/components/auth/ProtectedRoute.tsx`
- Auth Store: `@/stores/authStore`

---
