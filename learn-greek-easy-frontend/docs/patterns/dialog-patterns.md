# Dialog Patterns

Modal dialog patterns for confirmations and forms.

[← Back to Main Style Guide](../Style-Guide.md)

---

## Modal Dialog Patterns

### Confirmation Dialog Pattern

Use for actions that require user confirmation (logout, delete, cancel).

**Destructive Confirmation** (from LogoutDialog.tsx):
```tsx
import { LogOut } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export const LogoutDialog: React.FC<LogoutDialogProps> = ({ trigger }) => {
  const [open, setOpen] = useState(false);
  const { logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    setOpen(false);
    navigate('/login');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" className="w-full justify-start">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Logout Confirmation</DialogTitle>
          <DialogDescription>
            Are you sure you want to logout? You'll need to sign in again to access your learning progress.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-start">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleLogout}>
            Yes, Logout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
```

---

### Dialog State Management Pattern

Manage dialog state with useState.

**Pattern**:
```tsx
import { useState } from 'react';

const [open, setOpen] = useState(false);

<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger asChild>
    <Button onClick={() => setOpen(true)}>Delete Deck</Button>
  </DialogTrigger>
  <DialogContent>
    {/* Dialog content */}
  </DialogContent>
</Dialog>
```

**Controlled Dialog**:
- Use `open` and `onOpenChange` props
- State managed by parent component
- Allows programmatic control

---

### Non-Dismissible Dialog Pattern

Prevent accidental dismissal for critical actions.

**Pattern**:
```tsx
<Dialog open={open} onOpenChange={() => {}}>
  <DialogContent onInteractOutside={(e) => e.preventDefault()}>
    {/* Critical content - user must take action */}
  </DialogContent>
</Dialog>
```

**When to Use**:
- Critical confirmations
- Multi-step processes
- Destructive action confirmations

---

### Dialog Sizes

Standard dialog sizes for different content types:

| Size | Max Width | Use Case |
|------|-----------|----------|
| Small | sm:max-w-sm (384px) | Simple confirmations, alerts |
| Medium | sm:max-w-md (512px) | Forms with 2-4 fields, logout |
| Large | sm:max-w-lg (640px) | Forms with many fields, settings |

**Example**:
```tsx
<DialogContent className="sm:max-w-md">
  {/* Medium dialog content */}
</DialogContent>
```

---

### When to Use

- **Confirmation Dialog**: Logout, delete, cancel operations
- **Non-Dismissible Dialog**: Critical errors, destructive action confirmations
- **Small Dialog**: Quick confirmations
- **Medium Dialog**: Most confirmations and simple forms

### Accessibility Considerations

- Dialog traps focus (cannot tab outside)
- Escape key closes dismissible dialogs
- Click overlay closes dismissible dialogs
- First interactive element receives focus on open
- Focus returns to trigger element on close
- DialogTitle provides accessible name (aria-labelledby)
- DialogDescription provides context (aria-describedby)

### Related Components

- Dialog: `@/components/ui/dialog`
- LogoutDialog: `/src/components/auth/LogoutDialog.tsx`

---

## Multi-Step Confirmation Pattern

**Purpose**: Guide users through multiple confirmation steps for destructive actions, preventing accidental data loss.

**When to Use**:
- Destructive actions that cannot be undone (delete account, reset progress)
- Security-sensitive operations requiring verification
- Actions with complex consequences that need explanation
- When a single confirmation might lead to user regret

**When Not to Use**:
- Simple confirmations that don't need explanation
- Non-destructive actions
- Frequent operations where multi-step would be annoying
- When a single warning is sufficient

### 2-Step Variant

**Use Case**: Destructive actions requiring explicit confirmation (e.g., Reset Progress)

**Flow**:
1. **Step 1**: Warning with consequences list → Continue/Cancel
2. **Step 2**: Type-to-confirm validation → Back/Confirm

**Implementation**:
```tsx
import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export function TwoStepDialog({ open, onOpenChange }: DialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmText, setConfirmText] = useState('');

  const isConfirmValid = confirmText === 'RESET';

  const handleConfirm = async () => {
    // Perform destructive action
    await deleteData();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {step === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle>Warning Title</DialogTitle>
              <DialogDescription>
                <ul>
                  <li>Item that will be deleted</li>
                  <li>Another item that will be deleted</li>
                </ul>
                <p className="text-red-600">This action cannot be undone.</p>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button variant="destructive" onClick={() => setStep(2)}>
                Continue
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Final Confirmation</DialogTitle>
              <DialogDescription>
                <p>Type <strong>RESET</strong> to confirm:</p>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="font-mono"
                />
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirm}
                disabled={!isConfirmValid}
              >
                Confirm Action
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

**Key Features**:
- Step state: `useState<1 | 2>(1)`
- Back navigation with ArrowLeft icon
- Validation before enabling confirm button
- Clear step titles and instructions

### 3-Step Variant

**Use Case**: Critical destructive actions requiring password verification (e.g., Delete Account)

**Flow**:
1. **Step 1**: Warning with consequences list → Continue/Cancel
2. **Step 2**: Password verification → Back/Verify
3. **Step 3**: Final acknowledgment checkbox → Back/Confirm

**Implementation**:
```tsx
import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export function ThreeStepDialog({ open, onOpenChange }: DialogProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const handleVerifyPassword = () => {
    if (password.length >= 6) {
      setStep(3);
    }
  };

  const handleConfirm = async () => {
    if (!acknowledged) return;
    await deleteAccount();
    logout();
    navigate('/');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {step === 1 ? (
          // Step 1: Warning
          <>
            <DialogHeader>
              <DialogTitle className="text-red-600">
                Delete Account?
              </DialogTitle>
              <DialogDescription>
                <p>This will permanently delete:</p>
                <ul>
                  <li>All your data</li>
                  <li>All progress</li>
                </ul>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button variant="destructive" onClick={() => setStep(2)}>
                Continue
              </Button>
            </DialogFooter>
          </>
        ) : step === 2 ? (
          // Step 2: Password
          <>
            <DialogHeader>
              <DialogTitle>Verify Your Password</DialogTitle>
              <DialogDescription>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleVerifyPassword} disabled={!password}>
                Verify Password
              </Button>
            </DialogFooter>
          </>
        ) : (
          // Step 3: Acknowledgment
          <>
            <DialogHeader>
              <DialogTitle>Final Confirmation</DialogTitle>
              <DialogDescription>
                <div className="flex items-start space-x-2">
                  <Checkbox
                    checked={acknowledged}
                    onCheckedChange={(checked) => setAcknowledged(checked === true)}
                  />
                  <label>
                    I understand this action cannot be undone
                  </label>
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep(2)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirm}
                disabled={!acknowledged}
              >
                Delete My Account
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

**Key Features**:
- Step state: `useState<1 | 2 | 3>(1)`
- Password verification with show/hide toggle
- Checkbox acknowledgment
- Back navigation at each step
- Multiple validation gates

**Best Practices**:
- Use descriptive step titles
- Show clear consequences at each step
- Provide back navigation (don't trap users)
- Disable actions until validation passes
- Use appropriate colors (red for danger)
- Show loading states during async operations
- Provide success/error feedback

**Accessibility**:
- Clear step progression
- Error messages for invalid input
- Keyboard navigation between steps
- Focus management
- Screen reader announcements for step changes

---

## Type-to-Confirm Pattern

**Purpose**: Require users to type a specific word or phrase to confirm destructive actions, preventing accidental confirmations.

**When to Use**:
- Extremely destructive actions (delete account, reset all data)
- Actions that affect multiple items or entire systems
- Production environment operations
- As second layer of confirmation in multi-step flows

**When Not to Use**:
- Simple delete operations (single item)
- Actions that can be undone
- Frequent operations
- When password verification is more appropriate

**Common Confirmation Texts**:
- "DELETE" - For account deletion
- "RESET" - For resetting progress
- Account name/email - For account-specific operations
- "CONFIRM" - Generic confirmation

**Implementation**:
```tsx
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function TypeToConfirmDialog() {
  const [confirmText, setConfirmText] = useState('');
  const requiredText = 'RESET';
  const isValid = confirmText === requiredText;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-foreground">
          To confirm, type <span className="font-mono font-bold">{requiredText}</span> below:
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm">Confirmation Text</Label>
        <Input
          id="confirm"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={`Type ${requiredText}`}
          className="font-mono"
        />
        {confirmText && !isValid && (
          <p className="text-sm text-red-600">
            Must type "{requiredText}" exactly (case-sensitive)
          </p>
        )}
      </div>

      <Button
        variant="destructive"
        onClick={handleConfirm}
        disabled={!isValid}
      >
        Confirm Action
      </Button>
    </div>
  );
}
```

**Key Features**:
- Exact string match (case-sensitive by default)
- Real-time validation feedback
- Error message for incorrect input
- Disabled button until valid
- Monospace font for confirmation text
- Clear instruction with required text displayed

**Validation Logic**:
```typescript
// Basic case-sensitive
const isValid = confirmText === 'RESET';

// Case-insensitive variant
const isValid = confirmText.toLowerCase() === 'reset';

// Trimmed input
const isValid = confirmText.trim() === 'RESET';
```

**Styling Best Practices**:
- Use `font-mono` for confirmation text display and input
- Use `font-bold` when showing required text
- Show required text prominently
- Use red color for error feedback
- Keep error messages concise

**Accessibility**:
- Clear instructions before input
- Label for input field
- Error message with role="alert"
- Button disabled until valid (but not hidden)
- Keyboard-only operation supported

**Security Considerations**:
- Case-sensitive matching recommended (harder to accidentally type)
- Don't auto-fill or auto-complete
- Clear input on dialog close
- Show validation state clearly

**Examples**:
```tsx
// Example 1: Reset Progress
<p>Type <strong className="font-mono">RESET</strong> to confirm</p>
<Input placeholder="Type RESET" className="font-mono" />

// Example 2: Delete Account
<p>Type <strong className="font-mono">DELETE</strong> to permanently delete your account</p>
<Input placeholder="Type DELETE" className="font-mono" />

// Example 3: Account-Specific
<p>Type your email <strong className="font-mono">{user.email}</strong> to confirm</p>
<Input placeholder="Type your email" />
```

---

## Password Verification Dialog Pattern

**Purpose**: Require password re-authentication before allowing security-sensitive operations.

**When to Use**:
- Account deletion or deactivation
- Changing primary email or password
- Accessing sensitive information
- Performing financial transactions
- Changing security settings

**When Not to Use**:
- Non-sensitive preference changes
- Actions already within authenticated session timeout
- When other verification (2FA) is used
- Frequent operations

**Implementation**:
```tsx
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';

export function PasswordVerificationStep() {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    setError(null);

    if (password.length < 6) {
      setError('Please enter your password');
      return;
    }

    try {
      // TODO: Replace with actual API call
      const isValid = await verifyPassword(password);
      if (isValid) {
        onPasswordVerified();
      } else {
        setError('Incorrect password');
      }
    } catch (err) {
      setError('Verification failed. Please try again.');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-foreground">
          Enter your current password to continue:
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="verify-password">Current Password</Label>
        <div className="relative">
          <Input
            id="verify-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            placeholder="Enter your password"
            className={error ? 'border-red-500' : ''}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
      </div>

      <Button
        onClick={handleVerify}
        disabled={!password}
      >
        Verify Password
      </Button>
    </div>
  );
}
```

**Key Features**:
- Password input with show/hide toggle
- Eye/EyeOff icon for visibility control
- Error message display
- Clear on input change (error)
- Disabled button when empty
- Security-focused styling

**Show/Hide Toggle Pattern**:
```tsx
const [showPassword, setShowPassword] = useState(false);

<div className="relative">
  <Input type={showPassword ? 'text' : 'password'} />
  <button
    onClick={() => setShowPassword(!showPassword)}
    className="absolute right-3 top-1/2 -translate-y-1/2"
  >
    {showPassword ? <EyeOff /> : <Eye />}
  </button>
</div>
```

**Error Handling**:
```typescript
// Client-side validation
if (password.length < 6) {
  setError('Please enter your password');
  return;
}

// API verification
try {
  const isValid = await verifyPassword(password);
  if (!isValid) {
    setError('Incorrect password');
  }
} catch (error) {
  setError('Verification failed. Please try again.');
}
```

**Integration with Multi-Step Flow**:
```tsx
// In 3-step dialog (step 2)
{step === 2 && (
  <>
    <DialogHeader>
      <DialogTitle>Verify Your Password</DialogTitle>
    </DialogHeader>
    <DialogContent>
      <PasswordVerificationStep
        onVerified={() => setStep(3)}
        onBack={() => setStep(1)}
      />
    </DialogContent>
  </>
)}
```

**Security Best Practices**:
- Never log or store the password in state longer than needed
- Clear password field on dialog close
- Use HTTPS for password transmission
- Implement rate limiting on verification attempts
- Show generic error messages (don't reveal if account exists)
- Consider adding delay after failed attempts

**Accessibility**:
- Label for password input
- Show/hide button with clear label
- Error messages with role="alert"
- Keyboard navigation supported
- Focus management
- Screen reader friendly

**Styling**:
- Error state: red border on input
- Show/hide button: positioned absolute right
- Icon sizing: h-4 w-4 for consistency
- Muted foreground for toggle button
- Error text: text-sm text-red-600

---
