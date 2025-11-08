# Dialog Components - Quick Start Guide

Get started with reusable dialog components in 2 minutes.

---

## Installation

Components are already installed in your project at:
```
/src/components/dialogs/
```

---

## Import

```tsx
// Import both components
import { ConfirmDialog, AlertDialog } from '@/components/dialogs';

// Or import individually
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { AlertDialog } from '@/components/dialogs/AlertDialog';

// Import types (optional, for TypeScript)
import type { ConfirmDialogProps, AlertDialogProps } from '@/components/dialogs';
```

---

## 5 Most Common Use Cases

### 1. Logout Confirmation (5 lines)

```tsx
import { ConfirmDialog } from '@/components/dialogs';

<ConfirmDialog
  open={showLogout}
  onOpenChange={setShowLogout}
  title="Confirm Logout"
  description="Are you sure you want to log out?"
  onConfirm={handleLogout}
/>
```

### 2. Delete Confirmation (6 lines)

```tsx
import { ConfirmDialog } from '@/components/dialogs';

<ConfirmDialog
  open={showDelete}
  onOpenChange={setShowDelete}
  title="Delete Deck"
  description={`Delete "${deckName}"? This cannot be undone.`}
  confirmText="Delete"
  variant="destructive"
  onConfirm={handleDelete}
/>
```

### 3. Success Message (5 lines)

```tsx
import { AlertDialog } from '@/components/dialogs';

<AlertDialog
  open={showSuccess}
  onOpenChange={setShowSuccess}
  title="Success"
  description="Your changes have been saved."
  variant="success"
/>
```

### 4. Error Message (5 lines)

```tsx
import { AlertDialog } from '@/components/dialogs';

<AlertDialog
  open={!!error}
  onOpenChange={() => setError(null)}
  title="Error"
  description={error}
  variant="error"
/>
```

### 5. Confirmation with Button Trigger (4 lines)

```tsx
import { ConfirmDialog } from '@/components/dialogs';

<ConfirmDialog
  trigger={<Button>Cancel Review</Button>}
  title="Cancel Review"
  description="Your progress will be saved."
  onConfirm={handleCancel}
/>
```

---

## Props Cheat Sheet

### ConfirmDialog

```tsx
<ConfirmDialog
  // State (controlled mode)
  open={boolean}                          // Optional
  onOpenChange={(open) => void}          // Optional

  // Or trigger (uncontrolled mode)
  trigger={<Button>Click</Button>}       // Optional

  // Content (required)
  title="Dialog Title"                   // Required
  description="Dialog message"           // Required

  // Actions
  onConfirm={() => void}                 // Required (can be async)
  onCancel={() => void}                  // Optional

  // Customization
  confirmText="Confirm"                  // Optional (default: "Confirm")
  cancelText="Cancel"                    // Optional (default: "Cancel")
  variant="default"                      // Optional: "default" | "destructive"
  loading={boolean}                      // Optional (automatic if not provided)
  icon={<Icon />}                        // Optional (overrides default)
/>
```

### AlertDialog

```tsx
<AlertDialog
  // State (always controlled)
  open={boolean}                         // Required
  onOpenChange={(open) => void}         // Optional

  // Content (required)
  title="Alert Title"                   // Required
  description="Alert message"           // Required

  // Customization
  variant="info"                        // Optional: "info" | "warning" | "error" | "success"
  dismissible={true}                    // Optional (default: true)
  actions={[                            // Optional (default: single OK button)
    {
      label: "Action",
      onClick: () => void,
      variant: "default"                // Optional: "default" | "destructive" | "outline"
    }
  ]}
  icon={<Icon />}                       // Optional (overrides default)
/>
```

---

## Variants

### ConfirmDialog Variants
- `default` - Blue, standard confirmation
- `destructive` - Red, for delete/remove actions (shows warning icon)

### AlertDialog Variants
- `info` - Blue with info icon
- `warning` - Yellow with warning icon
- `error` - Red with error icon
- `success` - Green with success icon

---

## Common Patterns

### Pattern 1: Controlled Dialog with State

```tsx
const [showDialog, setShowDialog] = useState(false);

// Open dialog
<Button onClick={() => setShowDialog(true)}>Delete</Button>

// Dialog
<ConfirmDialog
  open={showDialog}
  onOpenChange={setShowDialog}
  title="Delete Item"
  description="Are you sure?"
  onConfirm={handleDelete}
  variant="destructive"
/>
```

### Pattern 2: Uncontrolled Dialog with Trigger

```tsx
// No state needed! Component manages it internally
<ConfirmDialog
  trigger={<Button>Delete</Button>}
  title="Delete Item"
  description="Are you sure?"
  onConfirm={handleDelete}
  variant="destructive"
/>
```

### Pattern 3: Async Operation with Loading

```tsx
// Loading state is automatic!
<ConfirmDialog
  open={showDialog}
  onOpenChange={setShowDialog}
  title="Save Changes"
  description="Save your changes?"
  onConfirm={async () => {
    await saveChanges(); // Automatically shows loading spinner
  }}
/>
```

### Pattern 4: Multiple Actions

```tsx
<AlertDialog
  open={showAlert}
  onOpenChange={setShowAlert}
  title="Connection Lost"
  description="Lost connection. Retry or cancel?"
  variant="warning"
  actions={[
    { label: "Retry", onClick: handleRetry },
    { label: "Cancel", onClick: handleCancel, variant: "outline" }
  ]}
/>
```

### Pattern 5: Non-dismissible (Forced Action)

```tsx
<AlertDialog
  open={showExpiry}
  onOpenChange={setShowExpiry}
  title="Session Expiring"
  description="Your session is expiring soon."
  variant="warning"
  dismissible={false}  // Cannot close by clicking outside or pressing Escape
  actions={[
    { label: "Extend Session", onClick: handleExtend }
  ]}
/>
```

---

## Tips & Best Practices

### 1. Use Controlled Mode for Complex Logic
```tsx
// Good: When you need to perform actions before opening
const handleClick = () => {
  if (someCondition) {
    setShowDialog(true);
  }
};
```

### 2. Use Uncontrolled Mode for Simple Cases
```tsx
// Good: Simple confirmation without extra logic
<ConfirmDialog trigger={<Button>Delete</Button>} ... />
```

### 3. Async Operations Work Automatically
```tsx
// Good: Loading state is automatic
onConfirm={async () => {
  await api.delete(id);  // Spinner shows automatically
}}
```

### 4. Handle Errors in onConfirm
```tsx
// Good: Handle errors within the callback
onConfirm={async () => {
  try {
    await api.delete(id);
    toast.success('Deleted');
  } catch (error) {
    toast.error('Failed to delete');
    throw error; // Re-throw to keep dialog open
  }
}}
```

### 5. Use Destructive Variant for Dangerous Actions
```tsx
// Good: Makes it clear this is a dangerous action
<ConfirmDialog
  variant="destructive"
  title="Delete Account"
  description="This cannot be undone."
  ...
/>
```

---

## Migration from Old Dialogs

### Step 1: Replace Dialog Imports
```tsx
// Before
import { Dialog, DialogContent, DialogHeader, ... } from '@/components/ui/dialog';

// After
import { ConfirmDialog } from '@/components/dialogs';
```

### Step 2: Remove State Management (for uncontrolled)
```tsx
// Before
const [open, setOpen] = useState(false);

// After
// No state needed if using trigger prop!
```

### Step 3: Replace Dialog with ConfirmDialog
```tsx
// Before
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Confirm</DialogTitle>
      <DialogDescription>Are you sure?</DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
      <Button onClick={handleConfirm}>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

// After
<ConfirmDialog
  open={open}
  onOpenChange={setOpen}
  title="Confirm"
  description="Are you sure?"
  onConfirm={handleConfirm}
/>
```

Result: ~40 lines reduced to 7 lines!

---

## Troubleshooting

### Dialog Doesn't Open
```tsx
// Problem: Forgot to set open prop
<ConfirmDialog title="..." onConfirm={...} />  // ❌ Won't open

// Solution: Add open prop OR trigger prop
<ConfirmDialog open={show} onOpenChange={setShow} title="..." onConfirm={...} />  // ✅
// OR
<ConfirmDialog trigger={<Button>Open</Button>} title="..." onConfirm={...} />  // ✅
```

### Dialog Doesn't Close After Confirm
```tsx
// Problem: Error thrown in onConfirm prevents auto-close
onConfirm={async () => {
  await failingOperation();  // Throws error
}}

// Solution: Catch and handle errors
onConfirm={async () => {
  try {
    await failingOperation();
  } catch (error) {
    showErrorToast();
    // Don't throw - let dialog close
  }
}}
```

### Loading State Not Working
```tsx
// Problem: onConfirm is not async
onConfirm={() => {
  fetch('/api/delete');  // Not awaited
}}

// Solution: Make it async or return promise
onConfirm={async () => {
  await fetch('/api/delete');
}}
```

### Can't Close Non-dismissible Dialog
```tsx
// This is expected behavior!
<AlertDialog dismissible={false} ... />

// Solution: Provide action button that closes dialog
actions={[
  {
    label: "OK",
    onClick: () => setOpen(false)  // Explicitly close
  }
]}
```

---

## Need More Examples?

See `/src/components/dialogs/examples.tsx` for 10 complete working examples.

See `/src/components/dialogs/README.md` for full documentation.

---

## Questions?

1. Check examples.tsx for usage patterns
2. Check README.md for full API documentation
3. Check existing components for real-world usage

Happy coding!
