# Dialog Components

Reusable dialog components for consistent user interactions across the Learn Greek Easy application.

## Components

### ConfirmDialog

A reusable confirmation dialog for actions requiring user confirmation (e.g., logout, delete, cancel).

**Location**: `/src/components/dialogs/ConfirmDialog.tsx`

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | - | Controls dialog open state (controlled mode) |
| `onOpenChange` | `(open: boolean) => void` | - | Callback when dialog open state changes |
| `trigger` | `React.ReactNode` | - | Optional trigger element (for uncontrolled mode) |
| `title` | `string` | **required** | Dialog title |
| `description` | `string` | **required** | Dialog description/message |
| `confirmText` | `string` | `"Confirm"` | Text for confirm button |
| `cancelText` | `string` | `"Cancel"` | Text for cancel button |
| `onConfirm` | `() => void \| Promise<void>` | **required** | Callback when user confirms |
| `onCancel` | `() => void` | - | Optional callback when user cancels |
| `variant` | `"default" \| "destructive"` | `"default"` | Visual variant (destructive shows red styling) |
| `loading` | `boolean` | - | External loading state (optional, component manages internal loading) |
| `icon` | `React.ReactNode` | - | Optional custom icon (overrides default variant icon) |

#### Features

- **Automatic loading state** during async operations
- **Variant support**: default (blue) and destructive (red)
- **Custom icons**: Override default icons with custom ones
- **Keyboard navigation**: Escape to close, Tab to navigate
- **Focus management**: Automatic focus trapping and restoration
- **Controlled/Uncontrolled**: Use with or without trigger element

#### Usage Examples

**Controlled Mode (Logout Confirmation)**
```tsx
import { ConfirmDialog } from '@/components/dialogs';

function LogoutButton() {
  const [showDialog, setShowDialog] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <>
      <Button onClick={() => setShowDialog(true)}>Logout</Button>

      <ConfirmDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        title="Confirm Logout"
        description="Are you sure you want to log out of your account?"
        confirmText="Logout"
        onConfirm={handleLogout}
      />
    </>
  );
}
```

**Destructive Variant (Delete Confirmation)**
```tsx
import { ConfirmDialog } from '@/components/dialogs';

function DeleteDeckButton({ deckName, cardCount }) {
  const [showDialog, setShowDialog] = useState(false);

  const handleDelete = async () => {
    await deleteDeck(deckId);
  };

  return (
    <>
      <Button variant="destructive" onClick={() => setShowDialog(true)}>
        Delete Deck
      </Button>

      <ConfirmDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        title="Delete Deck"
        description={`Are you sure you want to delete "${deckName}"? This will permanently delete all ${cardCount} flashcards and cannot be undone.`}
        confirmText="Delete Deck"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}
```

**Uncontrolled Mode with Trigger**
```tsx
import { ConfirmDialog } from '@/components/dialogs';

function CancelButton() {
  const handleCancel = () => {
    console.log('Cancelled');
  };

  return (
    <ConfirmDialog
      trigger={<Button variant="outline">Cancel Review</Button>}
      title="Cancel Review Session"
      description="Your progress will be saved. Continue?"
      confirmText="Cancel Session"
      onConfirm={handleCancel}
    />
  );
}
```

---

### AlertDialog

A reusable alert dialog for informational messages, warnings, and errors.

**Location**: `/src/components/dialogs/AlertDialog.tsx`

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | **required** | Controls dialog open state |
| `onOpenChange` | `(open: boolean) => void` | - | Callback when dialog open state changes |
| `title` | `string` | **required** | Dialog title |
| `description` | `string` | **required** | Dialog description/message |
| `variant` | `"info" \| "warning" \| "error" \| "success"` | `"info"` | Visual variant for icon and styling |
| `dismissible` | `boolean` | `true` | Whether dialog can be dismissed by clicking overlay or Escape |
| `actions` | `AlertDialogAction[]` | `[{label: "OK", ...}]` | Optional array of action buttons |
| `icon` | `React.ReactNode` | - | Optional custom icon (overrides default variant icon) |

#### AlertDialogAction Interface

```typescript
interface AlertDialogAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'outline';
}
```

#### Features

- **Multiple variants**: info (blue), warning (yellow), error (red), success (green)
- **Color-coded icons**: Automatic icon selection based on variant
- **Flexible actions**: Single or multiple action buttons
- **Non-dismissible mode**: Prevent closing via overlay or Escape
- **Keyboard navigation**: Escape to close (if dismissible)
- **Focus management**: Automatic focus trapping
- **Accessibility**: Full ARIA support

#### Usage Examples

**Success Message**
```tsx
import { AlertDialog } from '@/components/dialogs';

function SaveButton() {
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSave = async () => {
    await saveChanges();
    setShowSuccess(true);
  };

  return (
    <>
      <Button onClick={handleSave}>Save</Button>

      <AlertDialog
        open={showSuccess}
        onOpenChange={setShowSuccess}
        title="Success"
        description="Your changes have been saved successfully."
        variant="success"
      />
    </>
  );
}
```

**Error Message**
```tsx
import { AlertDialog } from '@/components/dialogs';

function DataComponent() {
  const [error, setError] = useState<string | null>(null);

  return (
    <AlertDialog
      open={!!error}
      onOpenChange={() => setError(null)}
      title="Error"
      description={error || 'An unexpected error occurred.'}
      variant="error"
    />
  );
}
```

**Warning with Multiple Actions**
```tsx
import { AlertDialog } from '@/components/dialogs';

function ConnectionComponent() {
  const [showWarning, setShowWarning] = useState(false);

  const handleRetry = () => {
    retryConnection();
    setShowWarning(false);
  };

  const handleCancel = () => {
    cancelOperation();
    setShowWarning(false);
  };

  return (
    <AlertDialog
      open={showWarning}
      onOpenChange={setShowWarning}
      title="Connection Lost"
      description="Your internet connection was lost. Retry or cancel?"
      variant="warning"
      actions={[
        { label: 'Retry', onClick: handleRetry, variant: 'default' },
        { label: 'Cancel', onClick: handleCancel, variant: 'outline' }
      ]}
    />
  );
}
```

**Non-dismissible Alert (Session Expiry)**
```tsx
import { AlertDialog } from '@/components/dialogs';

function SessionMonitor() {
  const [showExpiry, setShowExpiry] = useState(false);

  const handleExtend = () => {
    extendSession();
    setShowExpiry(false);
  };

  return (
    <AlertDialog
      open={showExpiry}
      onOpenChange={setShowExpiry}
      title="Session Expiring Soon"
      description="Your session will expire in 2 minutes."
      variant="warning"
      dismissible={false}
      actions={[
        { label: 'Extend Session', onClick: handleExtend }
      ]}
    />
  );
}
```

---

## Variant Colors & Icons

### ConfirmDialog Variants

| Variant | Color | Icon | Use Case |
|---------|-------|------|----------|
| `default` | Blue | None | Standard confirmations |
| `destructive` | Red | AlertTriangle | Delete, remove, destructive actions |

### AlertDialog Variants

| Variant | Color | Icon | Use Case |
|---------|-------|------|----------|
| `info` | Blue | Info | Informational messages |
| `warning` | Yellow | AlertTriangle | Warnings, cautions |
| `error` | Red | AlertCircle | Errors, failures |
| `success` | Green | CheckCircle | Success, confirmations |

---

## Accessibility

Both components follow WAI-ARIA best practices:

- **Focus Management**: Focus is trapped within the dialog and restored on close
- **Keyboard Navigation**:
  - `Escape` closes dismissible dialogs
  - `Tab` cycles through focusable elements
  - `Enter` activates focused button
- **Screen Readers**: Proper ARIA labels and roles
- **Color Contrast**: All variants meet WCAG AA standards

---

## Migration Guide

### From LogoutDialog to ConfirmDialog

**Before**:
```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Logout Confirmation</DialogTitle>
      <DialogDescription>Are you sure?</DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" onClick={handleCancel}>Cancel</Button>
      <Button onClick={handleLogout}>Logout</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**After**:
```tsx
<ConfirmDialog
  open={open}
  onOpenChange={setOpen}
  title="Logout Confirmation"
  description="Are you sure you want to logout?"
  confirmText="Logout"
  onConfirm={handleLogout}
/>
```

**Benefits**: ~40 lines reduced to 7 lines, automatic loading state, consistent styling.

---

## Testing

See `examples.tsx` for comprehensive usage examples including:
- Controlled and uncontrolled modes
- All variants
- Loading states
- Multiple actions
- Non-dismissible dialogs
- Custom cancel handlers

---

## Related Components

- **Base Dialog**: `/src/components/ui/dialog.tsx` (shadcn/ui)
- **LogoutDialog**: `/src/components/auth/LogoutDialog.tsx` (could be refactored)
- **SessionWarningDialog**: `/src/components/auth/SessionWarningDialog.tsx` (custom timer logic)

---

## File Structure

```
src/components/dialogs/
├── ConfirmDialog.tsx       # Confirmation dialog component
├── AlertDialog.tsx         # Alert dialog component
├── index.ts                # Barrel export
├── examples.tsx            # Usage examples (reference only)
└── README.md              # This file
```
