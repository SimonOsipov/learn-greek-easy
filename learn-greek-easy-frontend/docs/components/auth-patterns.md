# Authentication Patterns Reference

Authentication UI patterns and implementation guidelines.

[← Back to Main Components Reference](../Components-Reference.md)

---

## Authentication Patterns

### Route Protection Pattern

All authenticated routes in the application follow this standard pattern using `ProtectedRoute`:

```tsx
// App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { PublicRoute } from '@/components/auth/PublicRoute';
import { RouteGuard } from '@/components/auth/RouteGuard';

function App() {
  return (
    <RouteGuard>
      <BrowserRouter>
        <Routes>
          {/* Public routes - redirect if authenticated */}
          <Route path="/auth" element={<PublicRoute />}>
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
          </Route>

          {/* Protected routes - require authentication */}
          <Route path="/" element={<ProtectedRoute />}>
            <Route index element={<Dashboard />} />
            <Route path="decks" element={<Decks />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Premium-only routes */}
          <Route path="/analytics" element={
            <ProtectedRoute requiredRole="premium">
              <Analytics />
            </ProtectedRoute>
          } />

          {/* Admin-only routes */}
          <Route path="/admin" element={
            <ProtectedRoute requiredRole="admin">
              <AdminPanel />
            </ProtectedRoute>
          } />

          {/* Error pages */}
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </RouteGuard>
  );
}
```

### Public Route Pattern

Authentication pages (login, register) use `PublicRoute` to prevent authenticated users from accessing them:

```tsx
// Prevents logged-in users from seeing login page
<Route path="/login" element={
  <PublicRoute redirectTo="/dashboard">
    <AuthLayout>
      <Login />
    </AuthLayout>
  </PublicRoute>
} />
```

### Logout Flow Pattern

Standard logout flow using `LogoutDialog` in user menu:

```tsx
// UserMenu component
import { LogoutDialog } from '@/components/auth/LogoutDialog';

<DropdownMenu>
  <DropdownMenuTrigger>
    <Avatar>...</Avatar>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>Profile</DropdownMenuItem>
    <DropdownMenuItem>Settings</DropdownMenuItem>
    <DropdownMenuSeparator />
    {/* LogoutDialog handles confirmation and redirect */}
    <LogoutDialog />
  </DropdownMenuContent>
</DropdownMenu>

// Flow:
// 1. User clicks logout → Dialog opens
// 2. User confirms → authStore.logout() called
// 3. Auth state cleared → ProtectedRoute detects change
// 4. ProtectedRoute redirects to /login
// 5. Toast notification shows farewell message
```

### Complete Authentication Architecture

```tsx
// main.tsx - Application entry point
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouteGuard } from '@/components/auth/RouteGuard';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Step 1: Verify auth on app load */}
    <RouteGuard>
      <App />
    </RouteGuard>
  </React.StrictMode>
);

// App.tsx - Route configuration
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { PublicRoute } from '@/components/auth/PublicRoute';

function App() {
  return (
    <BrowserRouter>
      {/* Step 2: Configure route protection */}
      <Routes>
        {/* Public routes */}
        <Route path="/auth" element={<PublicRoute />}>
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
        </Route>

        {/* Protected routes */}
        <Route path="/" element={<ProtectedRoute />}>
          <Route index element={<Dashboard />} />
          <Route path="decks" element={<Decks />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

### Common Pitfalls

**1. Don't nest ProtectedRoute components**
```tsx
// ❌ Wrong - unnecessary nesting
<ProtectedRoute>
  <ProtectedRoute>
    <Dashboard />
  </ProtectedRoute>
</ProtectedRoute>

// ✅ Correct - single wrapper
<ProtectedRoute>
  <Dashboard />
</ProtectedRoute>
```

**2. Don't use PublicRoute on protected pages**
```tsx
// ❌ Wrong - PublicRoute on protected page
<Route path="/dashboard" element={
  <PublicRoute><Dashboard /></PublicRoute>
} />

// ✅ Correct - ProtectedRoute on protected page
<Route path="/dashboard" element={
  <ProtectedRoute><Dashboard /></ProtectedRoute>
} />
```

**3. Always specify redirectTo for clarity**
```tsx
// ⚠️ Caution - uses default redirect
<ProtectedRoute>
  <Dashboard />
</ProtectedRoute>

// ✅ Better - explicit redirect
<ProtectedRoute redirectTo="/login">
  <Dashboard />
</ProtectedRoute>
```

**4. Don't forget RouteGuard at app root**
```tsx
// ❌ Wrong - no initial auth check
ReactDOM.createRoot(root).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

// ✅ Correct - verify auth on load
ReactDOM.createRoot(root).render(
  <RouteGuard>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </RouteGuard>
);
```

---
