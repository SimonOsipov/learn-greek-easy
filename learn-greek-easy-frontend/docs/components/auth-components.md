# Authentication Components Reference

Authentication, route protection, and session management components.

[← Back to Main Components Reference](../Components-Reference.md)

---

## Authentication Components

### ProtectedRoute

**Purpose**: Route guard component that protects authenticated routes from unauthorized access. Automatically redirects unauthenticated users to the login page while preserving the intended destination for post-login redirect.

**File**: `/src/components/auth/ProtectedRoute.tsx`

**Interface**:
```typescript
interface ProtectedRouteProps {
  /** Optional role requirement for this route */
  requiredRole?: 'free' | 'premium' | 'admin';
  /** URL to redirect to if not authenticated (default: '/login') */
  redirectTo?: string;
  /** Child components to render if authenticated */
  children?: React.ReactNode;
}
```

**Usage**:
```tsx
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Dashboard } from '@/pages/Dashboard';

// Basic protection - requires authentication
<Route path="/dashboard" element={
  <ProtectedRoute>
    <Dashboard />
  </ProtectedRoute>
} />

// With custom redirect URL
<Route path="/profile" element={
  <ProtectedRoute redirectTo="/auth/login">
    <Profile />
  </ProtectedRoute>
} />

// With role requirement
<Route path="/admin" element={
  <ProtectedRoute requiredRole="admin">
    <AdminPanel />
  </ProtectedRoute>
} />

// Nested routes using Outlet pattern
<Route path="/app" element={<ProtectedRoute />}>
  <Route path="dashboard" element={<Dashboard />} />
  <Route path="decks" element={<Decks />} />
</Route>
```

**Props**:
| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| requiredRole | `'free' \| 'premium' \| 'admin'` | No | undefined | Minimum role required to access route. Admin can access all routes. |
| redirectTo | string | No | '/login' | URL to redirect to if authentication fails |
| children | ReactNode | No | undefined | Components to render when authenticated. Uses `<Outlet />` if not provided. |

**States**:
- **Loading State**: Shows centered spinner with "Checking authentication..." message while `isLoading` is true
- **Unauthenticated**: Redirects to `redirectTo` with state containing return URL
- **Insufficient Role**: Redirects to `/unauthorized` with state containing required role and origin
- **Authenticated**: Renders children or `<Outlet />` for nested routes

**Key Features**:
- Automatic return URL preservation using React Router location state
- Role-based access control with hierarchical permissions (admin > premium > free)
- Loading state with branded UI during authentication check
- Support for nested routes via React Router `<Outlet />`
- Integrates with Zustand auth store for authentication state

**Related Components**:
- [PublicRoute](#publicroute) - Inverse guard for public pages
- [RouteGuard](#routeguard) - Initial authentication check wrapper
- [SessionWarningDialog](#sessionwarningdialog) - Session timeout warning

**Integration Notes**:
- Uses `useAuthStore()` hook from `@/stores/authStore` for auth state
- Captures current location for post-login redirect via `location.pathname + location.search`
- Admin users bypass all role checks (full access)
- Loading spinner uses `Loader2` from lucide-react with primary color and animation

**Example - Complete Route Configuration**:
```tsx
// App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected routes - all authenticated users */}
        <Route path="/" element={<ProtectedRoute />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="decks" element={<Decks />} />
          <Route path="profile" element={<Profile />} />
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
      </Routes>
    </BrowserRouter>
  );
}
```

---

### PublicRoute

**Purpose**: Route guard component that prevents authenticated users from accessing public authentication pages (login, register, forgot password). Automatically redirects authenticated users to the dashboard or their intended destination.

**File**: `/src/components/auth/PublicRoute.tsx`

**Interface**:
```typescript
interface PublicRouteProps {
  /** URL to redirect to if already authenticated (default: '/dashboard') */
  redirectTo?: string;
  /** Child components to render if not authenticated */
  children?: React.ReactNode;
}
```

**Usage**:
```tsx
import { PublicRoute } from '@/components/auth/PublicRoute';
import { Login } from '@/pages/Login';

// Basic public route - redirects to dashboard if authenticated
<Route path="/login" element={
  <PublicRoute>
    <Login />
  </PublicRoute>
} />

// Custom redirect destination
<Route path="/register" element={
  <PublicRoute redirectTo="/onboarding">
    <Register />
  </PublicRoute>
} />

// Nested public routes
<Route path="/auth" element={<PublicRoute />}>
  <Route path="login" element={<Login />} />
  <Route path="register" element={<Register />} />
  <Route path="forgot-password" element={<ForgotPassword />} />
</Route>
```

**Props**:
| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| redirectTo | string | No | '/dashboard' | URL to redirect to if user is already authenticated |
| children | ReactNode | No | undefined | Components to render when not authenticated. Uses `<Outlet />` if not provided. |

**States**:
- **Not Authenticated**: Renders children or `<Outlet />` for nested routes
- **Authenticated**: Returns `null` while redirect is in progress (prevents flash of content)
- **Redirect in Progress**: Uses `useEffect` to handle navigation after render

**Key Features**:
- Prevents authenticated users from seeing login/register pages
- Preserves "return to" functionality via location state
- Uses `useEffect` for redirect to ensure proper state update timing
- Returns `null` during redirect to prevent content flash
- Integrates with React Router navigation and location state

**Related Components**:
- [ProtectedRoute](#protectedroute) - Guard for authenticated routes
- [AuthLayout](#authlayout) - Layout wrapper for auth pages
- [RouteGuard](#routeguard) - Initial authentication verification

**Integration Notes**:
- Uses `useAuthStore()` hook from `@/stores/authStore` for authentication state
- Checks `location.state?.from` for return URL, falls back to `redirectTo`, then '/dashboard'
- Uses `navigate()` with `replace: true` to avoid adding to browser history
- Redirect handled in `useEffect` to respect React render lifecycle

**Example - Complete Auth Flow**:
```tsx
// App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PublicRoute } from '@/components/auth/PublicRoute';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public auth pages - redirect if already logged in */}
        <Route path="/auth" element={<PublicRoute />}>
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
        </Route>

        {/* Protected app pages - redirect if not logged in */}
        <Route path="/" element={<ProtectedRoute />}>
          <Route index element={<Dashboard />} />
          <Route path="decks" element={<Decks />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

// User flow:
// 1. User visits /auth/login (not authenticated) → Login page renders
// 2. User logs in → PublicRoute detects authentication
// 3. PublicRoute redirects to location.state.from || '/dashboard'
// 4. If user tries to visit /auth/login while logged in → immediate redirect to dashboard
```

---

### RouteGuard

**Purpose**: Base authentication verification component that checks authentication status on initial app load. Displays a branded loading screen while verifying the user's session, ensuring authentication state is confirmed before rendering the application.

**File**: `/src/components/auth/RouteGuard.tsx`

**Interface**:
```typescript
interface RouteGuardProps {
  /** Application content to render after authentication check completes */
  children: React.ReactNode;
}
```

**Usage**:
```tsx
import { RouteGuard } from '@/components/auth/RouteGuard';
import { App } from './App';

// Wrap entire application to verify auth on load
function Root() {
  return (
    <RouteGuard>
      <App />
    </RouteGuard>
  );
}

// In main.tsx
import { RouteGuard } from '@/components/auth/RouteGuard';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouteGuard>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </RouteGuard>
  </React.StrictMode>
);
```

**Props**:
| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| children | ReactNode | Yes | - | Application components to render after auth check completes |

**States**:
- **Checking**: Shows branded loading screen with "Learn Greek Easy" branding and spinner
- **Complete**: Renders children after `checkAuth()` completes (regardless of auth result)

**Key Features**:
- Verifies authentication on application mount
- Displays branded loading screen during verification
- Calls `checkAuth()` from auth store to restore session from localStorage/cookies
- Handles async authentication check with proper error handling
- Ensures loading state is set to false even if auth check fails

**Related Components**:
- [ProtectedRoute](#protectedroute) - Per-route authentication checks
- [PublicRoute](#publicroute) - Public route handling
- [SessionWarningDialog](#sessionwarningdialog) - Session timeout warnings

**Integration Notes**:
- Uses `useAuthStore()` hook to access `checkAuth()` function
- `checkAuth()` typically restores user session from localStorage or validates JWT tokens
- Loading screen uses gradient background: `from-blue-50 via-white to-purple-50`
- Spinner uses `Loader2` from lucide-react with primary color
- Always renders children after check completes, even if authentication fails (route guards handle access control)

**Example - Complete Application Setup**:
```tsx
// main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { RouteGuard } from '@/components/auth/RouteGuard';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouteGuard>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </RouteGuard>
  </React.StrictMode>
);

// Authentication flow:
// 1. App loads → RouteGuard displays loading screen
// 2. RouteGuard calls authStore.checkAuth()
// 3. checkAuth() checks localStorage for token/session
// 4. If valid session exists → updates auth store with user data
// 5. If no session or invalid → auth store remains unauthenticated
// 6. RouteGuard completes → renders App
// 7. App router uses ProtectedRoute/PublicRoute for per-route access control
```

**Auth Store Integration**:
```typescript
// Example authStore.checkAuth() implementation
const useAuthStore = create<AuthStore>((set) => ({
  // ... other state
  checkAuth: async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      set({ isAuthenticated: false, isLoading: false });
      return;
    }

    try {
      const response = await api.get('/auth/verify', {
        headers: { Authorization: `Bearer ${token}` }
      });
      set({
        isAuthenticated: true,
        user: response.data.user,
        isLoading: false
      });
    } catch (error) {
      localStorage.removeItem('authToken');
      set({ isAuthenticated: false, isLoading: false });
    }
  },
}));
```

---

### AuthLayout

**Purpose**: Layout wrapper component for authentication pages (login, register, forgot password). Provides consistent styling, centering, and branded background gradient across all auth pages.

**File**: `/src/components/auth/AuthLayout.tsx`

**Interface**:
```typescript
interface AuthLayoutProps {
  /** Auth page content (form, title, buttons, etc.) */
  children: React.ReactNode;
}
```

**Usage**:
```tsx
import { AuthLayout } from '@/components/auth/AuthLayout';

// Login page
function Login() {
  return (
    <AuthLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Welcome Back</h1>
        <LoginForm />
      </div>
    </AuthLayout>
  );
}

// Register page
function Register() {
  return (
    <AuthLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Create Account</h1>
        <RegisterForm />
      </div>
    </AuthLayout>
  );
}

// Forgot password page
function ForgotPassword() {
  return (
    <AuthLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Reset Password</h1>
        <ForgotPasswordForm />
      </div>
    </AuthLayout>
  );
}
```

**Props**:
| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| children | ReactNode | Yes | - | Auth page content to display within the centered card |

**Key Features**:
- Full-screen layout with vertical and horizontal centering
- Branded gradient background: `from-blue-50 via-white to-purple-50`
- Responsive max-width constraint (max-w-md = 448px)
- Consistent padding for mobile and desktop (px-4 py-8)
- Simple, single-responsibility layout component

**Related Components**:
- [PublicRoute](#publicroute) - Wraps auth pages to prevent authenticated access
- [RouteGuard](#routeguard) - Initial auth verification with similar loading UI

**Styling Details**:
- Background: `bg-gradient-to-br from-blue-50 via-white to-purple-50`
- Container: `min-h-screen` for full viewport height
- Content positioning: `flex items-center justify-center` for centering
- Content width: `w-full max-w-md` (100% width up to 448px)
- Padding: `px-4 py-8` (responsive horizontal + vertical spacing)

**Example - Complete Auth Page**:
```tsx
// Login.tsx
import React from 'react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function Login() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  return (
    <AuthLayout>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">
            Welcome Back
          </CardTitle>
          <p className="text-center text-muted-foreground">
            Continue your Greek learning journey
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button className="w-full" size="lg">
            Sign In
          </Button>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
```

**Integration with PublicRoute**:
```tsx
// App.tsx route configuration
<Route path="/auth" element={<PublicRoute />}>
  <Route path="login" element={
    <AuthLayout>
      <LoginCard />
    </AuthLayout>
  } />
  <Route path="register" element={
    <AuthLayout>
      <RegisterCard />
    </AuthLayout>
  } />
</Route>
```

---

### LogoutDialog

**Purpose**: Confirmation dialog for logout action. Prevents accidental logouts by requiring user confirmation before clearing authentication state and redirecting to login page. Provides friendly feedback with bilingual farewell message.

**File**: `/src/components/auth/LogoutDialog.tsx`

**Interface**:
```typescript
interface LogoutDialogProps {
  /** Optional custom trigger element (default: ghost button with logout icon) */
  trigger?: React.ReactNode;
}
```

**Usage**:
```tsx
import { LogoutDialog } from '@/components/auth/LogoutDialog';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

// Default trigger (ghost button with icon and text)
<LogoutDialog />

// Custom trigger element
<LogoutDialog
  trigger={
    <Button variant="destructive" size="sm">
      <LogOut className="mr-2 h-4 w-4" />
      Sign Out
    </Button>
  }
/>

// In UserMenu dropdown
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Avatar>...</Avatar>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>Profile</DropdownMenuItem>
    <DropdownMenuItem>Settings</DropdownMenuItem>
    <DropdownMenuSeparator />
    <LogoutDialog />
  </DropdownMenuContent>
</DropdownMenu>
```

**Props**:
| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| trigger | ReactNode | No | Ghost button with logout icon | Custom element to trigger the dialog. Wrapped with `asChild` for proper event handling. |

**Default Trigger**:
```tsx
<Button variant="ghost" className="w-full justify-start">
  <LogOut className="mr-2 h-4 w-4" />
  Logout
</Button>
```

**Key Features**:
- Confirmation dialog prevents accidental logouts
- Controlled dialog state with `open` and `onOpenChange`
- Calls `authStore.logout()` to clear authentication state
- Redirects to `/login` after logout
- Shows toast notification with bilingual farewell: "Αντίο! See you next time! 👋"
- Custom trigger support via render props pattern
- Uses Shadcn Dialog component for accessible modal

**Related Components**:
- [SessionWarningDialog](#sessionwarningdialog) - Automatic logout warning
- [UserMenu](#usermenu) - Typically contains LogoutDialog
- [ProtectedRoute](#protectedroute) - Handles redirect after logout

**Integration Notes**:
- Uses `useAuthStore()` hook to access `logout()` function
- Uses `useNavigate()` from react-router-dom for redirect
- Uses `useToast()` hook from Shadcn for success notification
- Dialog content uses Shadcn Dialog primitives (DialogContent, DialogHeader, etc.)
- Destructive variant used for "Yes, Logout" button for visual emphasis

**Example - Complete UserMenu Integration**:
```tsx
// UserMenu.tsx
import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogoutDialog } from '@/components/auth/LogoutDialog';
import { useAuthStore } from '@/stores/authStore';
import { Link } from 'react-router-dom';

export function UserMenu() {
  const { user } = useAuthStore();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative h-10 w-10 rounded-full">
          <Avatar>
            <AvatarImage src={user?.avatar} alt={user?.name} />
            <AvatarFallback className="bg-gradient-to-br from-[#667eea] to-[#764ba2]">
              {user?.name?.slice(0, 2).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">{user?.name}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profile">Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/settings">Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <LogoutDialog />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Dialog Content Structure**:
- **Title**: "Logout Confirmation"
- **Description**: "Are you sure you want to logout? You'll need to sign in again to access your learning progress."
- **Actions**:
  - Cancel (outline variant)
  - Yes, Logout (destructive variant)

**Toast Notification**:
```tsx
toast({
  title: 'Logged out successfully',
  description: 'Αντίο! See you next time! 👋',
});
```

---

### SessionWarningDialog

**Purpose**: Warning dialog displayed before automatic session expiration. Alerts users that their session is about to expire due to inactivity and provides option to extend the session. Features countdown timer and urgency-based styling.

**File**: `/src/components/auth/SessionWarningDialog.tsx`

**Interface**:
```typescript
interface SessionWarningDialogProps {
  /** Controls dialog visibility */
  open: boolean;
  /** Callback to extend the user session */
  onExtendSession: () => void;
  /** Remaining seconds until session expires */
  remainingSeconds: number;
}
```

**Usage**:
```tsx
import { SessionWarningDialog } from '@/components/auth/SessionWarningDialog';
import { useAuthStore } from '@/stores/authStore';
import { useState, useEffect } from 'react';

function App() {
  const { sessionExpiresAt, extendSession } = useAuthStore();
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    const checkInterval = setInterval(() => {
      const remaining = Math.floor((sessionExpiresAt - Date.now()) / 1000);
      setRemainingSeconds(remaining);

      // Show warning if less than 5 minutes remaining
      if (remaining < 300 && remaining > 0) {
        setShowWarning(true);
      } else if (remaining <= 0) {
        setShowWarning(false);
      }
    }, 1000); // Update every second

    return () => clearInterval(checkInterval);
  }, [sessionExpiresAt]);

  const handleExtend = () => {
    extendSession();
    setShowWarning(false);
  };

  return (
    <>
      <Routes>...</Routes>
      <SessionWarningDialog
        open={showWarning}
        onExtendSession={handleExtend}
        remainingSeconds={remainingSeconds}
      />
    </>
  );
}
```

**Props**:
| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| open | boolean | Yes | - | Controls whether the dialog is visible |
| onExtendSession | () => void | Yes | - | Callback to extend the session (typically calls auth store method) |
| remainingSeconds | number | Yes | - | Seconds remaining until automatic logout |

**States**:
- **Normal Warning** (> 60 seconds): Orange alert icon, standard styling
- **Urgent Warning** (<= 60 seconds): Red alert icon, destructive alert variant, red timer text

**Key Features**:
- Formatted countdown timer (MM:SS format with leading zeros)
- Dynamic urgency styling based on remaining time
- Non-dismissible dialog (prevents accidental closure via outside click)
- Branded "Stay Logged In" button with gradient
- Clear warning about unsaved data loss
- Uses Shadcn Alert component for visual emphasis
- Memoized time formatting for performance

**Related Components**:
- [ProtectedRoute](#protectedroute) - Handles redirect after session expires
- [LogoutDialog](#logoutdialog) - Manual logout confirmation

**Integration Notes**:
- Dialog uses `onInteractOutside={(e) => e.preventDefault()}` to prevent dismissal
- Timer formatted as `M:SS` (e.g., "4:37", "0:58")
- Urgency threshold at 60 seconds changes styling
- Alert variant changes from `default` to `destructive` when urgent
- Uses `useMemo` to optimize time formatting calculation

**Styling Details**:

**Alert Icon Colors**:
- Normal: `text-orange-500`
- Urgent: `text-red-500`

**Timer Text Colors**:
- Normal: Default text color
- Urgent: `text-red-600`

**Button Styling**:
- Full width: `w-full`
- Large size: `size="lg"`
- Gradient: `bg-gradient-to-br from-[#667eea] to-[#764ba2]`

**Example - Complete Session Management**:
```tsx
// App.tsx or AppLayout.tsx
import React, { useState, useEffect } from 'react';
import { SessionWarningDialog } from '@/components/auth/SessionWarningDialog';
import { useAuthStore } from '@/stores/authStore';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { sessionExpiresAt, extendSession, logout } = useAuthStore();
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    // Update countdown every second
    const updateInterval = setInterval(() => {
      if (!sessionExpiresAt) return;

      const remaining = Math.floor((sessionExpiresAt - Date.now()) / 1000);
      setRemainingSeconds(remaining);

      // Show warning at 5 minutes (300 seconds)
      if (remaining <= 300 && remaining > 0) {
        setShowWarning(true);
      }

      // Auto-logout when timer reaches zero
      if (remaining <= 0) {
        setShowWarning(false);
        logout();
        // Redirect handled by ProtectedRoute
      }
    }, 1000);

    return () => clearInterval(updateInterval);
  }, [sessionExpiresAt, logout]);

  const handleExtendSession = async () => {
    await extendSession(); // API call to extend session
    setShowWarning(false);
  };

  return (
    <>
      {children}
      <SessionWarningDialog
        open={showWarning}
        onExtendSession={handleExtendSession}
        remainingSeconds={remainingSeconds}
      />
    </>
  );
}
```

**Auth Store Integration**:
```typescript
// Example authStore session management
interface AuthStore {
  sessionExpiresAt: number | null; // Unix timestamp
  extendSession: () => Promise<void>;
  // ... other state
}

const useAuthStore = create<AuthStore>((set) => ({
  sessionExpiresAt: null,

  extendSession: async () => {
    try {
      const response = await api.post('/auth/extend-session');
      const newExpiry = Date.now() + (response.data.expiresInSeconds * 1000);
      set({ sessionExpiresAt: newExpiry });
    } catch (error) {
      console.error('Failed to extend session:', error);
    }
  },

  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    const expiresAt = Date.now() + (response.data.expiresInSeconds * 1000);
    set({
      isAuthenticated: true,
      user: response.data.user,
      sessionExpiresAt: expiresAt
    });
  },
}));
```

**Time Formatting Logic**:
```typescript
const formattedTime = useMemo(() => {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}, [remainingSeconds]);

// Examples:
// 300 seconds → "5:00"
// 65 seconds → "1:05"
// 5 seconds → "0:05"
```

---

