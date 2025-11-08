# Settings UI Patterns

Settings and preferences UI patterns.

[← Back to Main Style Guide](../Style-Guide.md)

---

## Settings UI Patterns

UI patterns for account settings and preferences management.

### Account Info Display Pattern

**Purpose**: Display read-only account information with edit buttons for user-initiated changes.

**Pattern**: AccountSection component

**Structure**:
```tsx
<div className="space-y-3">
  {/* Section header with icon */}
  <div className="flex items-center gap-2">
    <Icon className="h-4 w-4 text-muted-foreground" />
    <h3 className="font-medium">Section Title</h3>
  </div>

  {/* Read-only info card */}
  <div className="flex items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg">
    <div className="flex-1 min-w-0">
      <p className="text-sm text-muted-foreground">Field label</p>
      <p className="font-medium truncate">{value}</p>
    </div>
    <Button variant="outline" size="sm" onClick={handleEdit}>
      Edit Action
    </Button>
  </div>
</div>
```

**Visual Characteristics**:
- **Section Header**: Icon + title with medium font weight
- **Info Card**: Muted background (bg-muted/50), rounded-lg, p-4 padding
- **Label**: Small text, muted color (text-muted-foreground)
- **Value**: Medium font weight, truncate for overflow protection
- **Edit Button**: Outline variant, small size, aligned to right

**Use Cases**:
- Email address display with "Change Email" button
- Account ID display (read-only, no button)
- Profile information with edit access
- Any read-only field that can be edited via dialog

**Accessibility**:
- Clear label-value relationship
- Truncate prevents layout breaking on long values
- Button has clear action text
- Icon marked as decorative (aria-hidden)

---

### Subscription Badge Pattern

**Purpose**: Display subscription tier with appropriate visual styling to differentiate Free vs Premium users.

**Pattern**: AccountSection subscription display

**Free Tier Badge**:
```tsx
<Badge variant="secondary">Free Plan</Badge>
```
- **Background**: Gray (secondary variant)
- **Text**: Default foreground color
- **Border**: Default badge border
- **Visual Weight**: Neutral, non-premium appearance

**Premium Tier Badge**:
```tsx
<Badge className="bg-gradient-to-r from-purple-500 to-purple-700 text-white border-0">
  Premium
</Badge>
```
- **Background**: Purple gradient (500 → 700)
- **Text**: White
- **Border**: None (border-0)
- **Visual Weight**: Premium, eye-catching gradient

**Usage Context**:
```tsx
<div className="flex items-center justify-between">
  <div>
    <p className="text-sm text-muted-foreground">Current plan</p>
    <div className="flex items-center gap-2 mt-1">
      {user.role === 'premium' ? (
        <Badge className="bg-gradient-to-r from-purple-500 to-purple-700 text-white border-0">
          Premium
        </Badge>
      ) : (
        <Badge variant="secondary">Free Plan</Badge>
      )}
    </div>
  </div>

  {user.role === 'free' && (
    <Button
      variant="default"
      size="sm"
      className="bg-gradient-to-r from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800"
    >
      Upgrade to Premium
    </Button>
  )}
</div>
```

**Upgrade Button** (Free users only):
- **Style**: Matches premium gradient for brand consistency
- **Gradient**: from-purple-500 to-purple-700
- **Hover**: Darker gradient (600 → 800)
- **Text**: "Upgrade to Premium"
- **Visibility**: Only shown for free tier users

**Guidelines**:
- Free badge: Use standard secondary variant for neutral appearance
- Premium badge: Use purple gradient to signify premium value
- Consistent gradient colors across badge and upgrade button
- Only show upgrade button for non-premium users
- Consider adding Crown icon for premium badge visual enhancement

---

### Form Dialog Pattern

**Purpose**: Edit sensitive account information via modal dialogs with validation and confirmation.

**Pattern**: Email change and password change dialogs in AccountSection

**Dialog Structure**:
```tsx
<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
  <DialogContent>
    {/* Header with title and description */}
    <DialogHeader>
      <DialogTitle>Change [Field Name]</DialogTitle>
      <DialogDescription>
        Brief instruction about what user needs to do
      </DialogDescription>
    </DialogHeader>

    {/* Form with validation */}
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Form fields using FormField/PasswordField */}
      <FormField {...fieldProps} />

      {/* Footer with Cancel + Submit */}
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={handleCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <SubmitButton loading={isSubmitting} loadingText="Updating...">
          Update [Field]
        </SubmitButton>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
```

**Email Change Dialog Example**:
```tsx
<Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Change Email Address</DialogTitle>
      <DialogDescription>
        Enter your new email address and confirm with your current password
      </DialogDescription>
    </DialogHeader>

    <form onSubmit={handleEmailSubmit(onEmailChange)} className="space-y-4">
      <FormField
        label="New Email"
        name="newEmail"
        type="email"
        placeholder="new@email.com"
        required
        autoComplete="email"
      />

      <PasswordField
        label="Current Password"
        name="currentPassword"
        placeholder="Enter your current password"
        required
        autoComplete="current-password"
      />

      <DialogFooter>
        <Button variant="outline" onClick={handleCancel}>Cancel</Button>
        <SubmitButton loading={isSubmitting}>Update Email</SubmitButton>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
```

**Password Change Dialog Example**:
```tsx
<Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Change Password</DialogTitle>
      <DialogDescription>
        Enter your current password and choose a new password
      </DialogDescription>
    </DialogHeader>

    <form onSubmit={handlePasswordSubmit(onPasswordChange)} className="space-y-4">
      <PasswordField
        label="Current Password"
        name="currentPassword"
        autoComplete="current-password"
      />

      <PasswordField
        label="New Password"
        name="newPassword"
        showStrength  // Shows password strength indicator
        autoComplete="new-password"
      />

      <PasswordField
        label="Confirm New Password"
        name="confirmPassword"
        autoComplete="new-password"
      />

      <DialogFooter>
        <Button variant="outline">Cancel</Button>
        <SubmitButton loading={isSubmitting}>Update Password</SubmitButton>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
```

**Key Principles**:
1. **Dialog Size**: `sm:max-w-md` (512px max width) for most setting dialogs
2. **Header Clarity**: Clear title + description explaining required action
3. **Form Spacing**: `space-y-4` between form fields
4. **Security Confirmation**: Require current password for email/password changes
5. **Loading States**: Disable buttons and show loading text during submission
6. **Error Handling**: Inline field errors + toast notifications for API errors
7. **Reset on Close**: Clear form when dialog closes or on successful submit
8. **Cancel Action**: Always provide cancel button with outline variant

**Dialog State Management**:
```typescript
const [emailDialogOpen, setEmailDialogOpen] = useState(false);

// Open dialog
setEmailDialogOpen(true);

// Close dialog and reset form
const handleCancel = () => {
  setEmailDialogOpen(false);
  resetForm();
};

// Close on success
const onSubmit = async (data) => {
  await updateProfile(data);
  setEmailDialogOpen(false);
  resetForm();
  toast({ title: 'Success' });
};
```

**Form Validation**:
- Use Zod schemas for validation
- React Hook Form for state management
- Inline error messages below fields
- Prevent submission if validation fails
- Show toast notifications for server errors

**When to Use**:
- Email address changes (requires password confirmation)
- Password changes (requires current password + confirmation)
- Critical account settings requiring confirmation
- Any setting that needs validation before saving

**Accessibility**:
- Dialog traps focus
- First field receives focus on open
- Escape key closes dialog
- Enter key submits form
- All fields properly labeled
- Error messages linked with aria-describedby

---

## Danger Zone Section Pattern

**Purpose**: Provide a visually distinct area for irreversible destructive actions with strong visual warnings.

**When to Use**:
- Account deletion or deactivation
- Resetting all user data/progress
- Actions that cannot be undone
- Operations that require extra user attention
- Security-sensitive destructive operations

**When Not to Use**:
- Reversible actions
- Simple preference resets
- Actions with undo capability
- Frequent operations
- Non-destructive changes

**Visual Characteristics**:
- Red color scheme throughout (borders, backgrounds, text, icons)
- AlertTriangle or warning icon
- Strong "Danger Zone" labeling
- Clear consequences described for each action
- Separated from normal settings sections
- Multiple layers of visual hierarchy

**Implementation**:
```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCcw, Trash2 } from 'lucide-react';

export function DangerZoneSection() {
  return (
    <Card className="border-red-200 dark:border-red-900">
      {/* Header */}
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <CardTitle className="text-red-600">Danger Zone</CardTitle>
        </div>
        <CardDescription>
          Irreversible actions that affect your account and data
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Action Card 1: Reset */}
        <div className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-red-600" />
              <h3 className="font-medium text-red-900 dark:text-red-100">
                Reset All Progress
              </h3>
            </div>
            <p className="mt-1 text-sm text-red-700 dark:text-red-300">
              Clear all learning progress, review history, and statistics.
              Your account and settings will be preserved.
            </p>
          </div>
          <Button
            variant="outline"
            className="ml-4 border-red-300 text-red-700 hover:bg-red-100 hover:text-red-800 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900"
          >
            Reset Progress
          </Button>
        </div>

        {/* Action Card 2: Delete */}
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-red-600" />
              <h3 className="font-medium text-red-900 dark:text-red-100">
                Delete Account
              </h3>
            </div>
            <p className="mt-1 text-sm text-red-700 dark:text-red-300">
              Permanently delete your account and all associated data.
              This action cannot be undone.
            </p>
          </div>
          <Button
            variant="destructive"
            className="ml-4"
          >
            Delete Account
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Color Scheme**:

**Light Mode**:
- Card border: `border-red-200`
- Card background: `bg-white` (default)
- Header icon: `text-red-600`
- Header title: `text-red-600`
- Action card border: `border-red-100` (lighter) / `border-red-200` (stronger)
- Action card background: `bg-red-50`
- Action icon: `text-red-600`
- Action title: `text-red-900`
- Action description: `text-red-700`
- Outline button border: `border-red-300`
- Outline button text: `text-red-700`
- Outline button hover: `hover:bg-red-100 hover:text-red-800`

**Dark Mode**:
- Card border: `dark:border-red-900`
- Action card border: `dark:border-red-900`
- Action card background: `dark:bg-red-950`
- Action title: `dark:text-red-100`
- Action description: `dark:text-red-300`
- Outline button border: `dark:border-red-700`
- Outline button text: `dark:text-red-400`
- Outline button hover: `dark:hover:bg-red-900`

**Layout Structure**:

1. **Card Container**:
   - Red-themed border
   - Standard Card component

2. **Header Section**:
   - AlertTriangle icon + "Danger Zone" title (both red)
   - Description explaining section purpose
   - Use CardHeader, CardTitle, CardDescription

3. **Action Cards** (within CardContent):
   - Each action in separate card with red background
   - Flex layout: content on left, button on right
   - Icon + title + description for each action
   - Appropriate button variant (outline vs destructive)
   - Spacing between cards: `space-y-4`

**Button Variants**:

**Outline Variant** (less severe actions like reset):
```tsx
<Button
  variant="outline"
  className="border-red-300 text-red-700 hover:bg-red-100 hover:text-red-800 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900"
>
  Reset Progress
</Button>
```

**Destructive Variant** (most severe actions like delete):
```tsx
<Button variant="destructive">
  Delete Account
</Button>
```

**Action Card Pattern**:
```tsx
<div className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
  {/* Left: Content */}
  <div className="flex-1">
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-red-600" />
      <h3 className="font-medium text-red-900 dark:text-red-100">
        Action Title
      </h3>
    </div>
    <p className="mt-1 text-sm text-red-700 dark:text-red-300">
      Action description explaining what will happen.
    </p>
  </div>

  {/* Right: Button */}
  <Button variant="outline | destructive" className="ml-4">
    Action Button
  </Button>
</div>
```

**Multiple Actions Layout**:
- Use `space-y-4` on CardContent
- Each action gets its own card
- Consistent styling across all action cards
- Progressive severity: lighter actions (reset) before heavier (delete)

**Responsive Behavior**:
- Desktop: Description and button side-by-side
- Mobile: May need to stack if space is tight
- Use `flex-1` on description to allow wrapping
- Button with `ml-4` maintains spacing

**Best Practices**:
- Always place Danger Zone at bottom of settings page
- Use red theme consistently (don't mix colors)
- Clear, concise descriptions of consequences
- More severe actions use stronger colors/buttons
- Require multi-step confirmations for all actions
- Show what will be preserved vs deleted
- Include warning text: "cannot be undone"

**Accessibility**:
- AlertTriangle icon for visual warning
- Clear section labeling ("Danger Zone")
- Descriptive button text
- Color contrast meets WCAG AA standards
- Icons have semantic meaning reinforced by text
- Keyboard navigation supported

**Integration with Dialogs**:
```tsx
export function DangerZoneSection() {
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  return (
    <>
      <Card className="border-red-200 dark:border-red-900">
        {/* Danger Zone Content */}
        <Button onClick={() => setShowResetDialog(true)}>
          Reset Progress
        </Button>
        <Button onClick={() => setShowDeleteDialog(true)}>
          Delete Account
        </Button>
      </Card>

      <ResetProgressDialog
        open={showResetDialog}
        onOpenChange={setShowResetDialog}
      />
      <DeleteAccountDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
      />
    </>
  );
}
```

**Icon Recommendations**:
- Section header: `AlertTriangle` (primary warning)
- Reset/Clear actions: `RotateCcw` or `RefreshCw`
- Delete actions: `Trash2` or `X`
- Export before delete: `Download`
- All icons: h-4 w-4 or h-5 w-5 sizing

**Examples in Production**:
- GitHub Settings → Danger Zone (delete repository)
- Heroku Dashboard → Delete app
- AWS Console → Terminate instances
- Stripe Dashboard → Delete account

**Security Considerations**:
- Actions require multi-step confirmations
- Visual warnings before any destructive action
- Clear messaging about permanence
- No accidental clicks due to spacing and confirmations
- Buttons placed away from safe actions

---

