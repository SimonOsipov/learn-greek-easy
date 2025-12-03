/**
 * Dialog Component Usage Examples
 *
 * This file demonstrates common usage patterns for the ConfirmDialog
 * and AlertDialog components. These examples serve as a reference for
 * developers implementing dialogs across the application.
 *
 * NOTE: This is a reference file and should not be imported in production code.
 */

import { useState } from 'react';

import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { AlertDialog, ConfirmDialog } from './index';

/**
 * Example 1: Controlled ConfirmDialog for Logout
 */
export function LogoutExample() {
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  const handleLogout = async () => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.info('User logged out');
  };

  return (
    <>
      <Button onClick={() => setShowLogoutDialog(true)}>Logout</Button>

      <ConfirmDialog
        open={showLogoutDialog}
        onOpenChange={setShowLogoutDialog}
        title="Confirm Logout"
        description="Are you sure you want to log out of your account?"
        confirmText="Logout"
        onConfirm={handleLogout}
      />
    </>
  );
}

/**
 * Example 2: Destructive ConfirmDialog for Delete Action
 */
export function DeleteDeckExample() {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const deckName = 'Greek Vocabulary - Level 1';
  const cardCount = 50;

  const handleDelete = async () => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    console.info('Deck deleted');
  };

  return (
    <>
      <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
        <Trash2 className="mr-2 h-4 w-4" />
        Delete Deck
      </Button>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Deck"
        description={`Are you sure you want to delete "${deckName}"? This will permanently delete all ${cardCount} flashcards and cannot be undone.`}
        confirmText="Delete Deck"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}

/**
 * Example 3: Uncontrolled ConfirmDialog with Trigger
 */
export function CancelReviewExample() {
  const handleCancelReview = () => {
    console.info('Review session cancelled');
  };

  return (
    <ConfirmDialog
      trigger={<Button variant="outline">Cancel Review</Button>}
      title="Cancel Review Session"
      description="Are you sure you want to cancel? Your progress in this session will be saved."
      confirmText="Cancel Session"
      cancelText="Continue Reviewing"
      onConfirm={handleCancelReview}
    />
  );
}

/**
 * Example 4: ConfirmDialog with Custom Cancel Handler
 */
export function UnsavedChangesExample() {
  const [showDialog, setShowDialog] = useState(false);

  const handleDiscard = () => {
    console.info('Changes discarded');
  };

  const handleCancel = () => {
    console.info('User chose to keep editing');
  };

  return (
    <>
      <Button variant="ghost" onClick={() => setShowDialog(true)}>
        Leave Page
      </Button>

      <ConfirmDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        title="Unsaved Changes"
        description="You have unsaved changes. Are you sure you want to leave? All changes will be lost."
        confirmText="Discard Changes"
        cancelText="Keep Editing"
        variant="destructive"
        onConfirm={handleDiscard}
        onCancel={handleCancel}
      />
    </>
  );
}

/**
 * Example 5: Success AlertDialog
 */
export function SuccessAlertExample() {
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSave = () => {
    // Simulate saving
    setTimeout(() => setShowSuccess(true), 500);
  };

  return (
    <>
      <Button onClick={handleSave}>Save Changes</Button>

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

/**
 * Example 6: Error AlertDialog
 */
export function ErrorAlertExample() {
  const [error, setError] = useState<string | null>(null);

  const handleAction = () => {
    // Simulate error
    setError('Failed to connect to the server. Please check your internet connection.');
  };

  return (
    <>
      <Button onClick={handleAction}>Trigger Error</Button>

      <AlertDialog
        open={!!error}
        onOpenChange={() => setError(null)}
        title="Error"
        description={error || 'An unexpected error occurred.'}
        variant="error"
      />
    </>
  );
}

/**
 * Example 7: Warning AlertDialog with Multiple Actions
 */
export function WarningWithActionsExample() {
  const [showWarning, setShowWarning] = useState(false);

  const handleRetry = () => {
    console.info('Retrying action');
    setShowWarning(false);
  };

  const handleCancel = () => {
    console.info('Action cancelled');
    setShowWarning(false);
  };

  return (
    <>
      <Button onClick={() => setShowWarning(true)}>Trigger Warning</Button>

      <AlertDialog
        open={showWarning}
        onOpenChange={setShowWarning}
        title="Connection Lost"
        description="Your internet connection was lost. Would you like to retry or cancel the operation?"
        variant="warning"
        actions={[
          { label: 'Retry', onClick: handleRetry, variant: 'default' },
          { label: 'Cancel', onClick: handleCancel, variant: 'outline' },
        ]}
      />
    </>
  );
}

/**
 * Example 8: Non-dismissible AlertDialog (Session Expiry)
 */
export function SessionExpiryExample() {
  const [showExpiry, setShowExpiry] = useState(false);

  const handleExtend = () => {
    console.info('Session extended');
    setShowExpiry(false);
  };

  const handleLogout = () => {
    console.info('User logged out');
    setShowExpiry(false);
  };

  return (
    <>
      <Button onClick={() => setShowExpiry(true)}>Simulate Session Expiry</Button>

      <AlertDialog
        open={showExpiry}
        onOpenChange={setShowExpiry}
        title="Session Expiring Soon"
        description="Your session will expire in 2 minutes due to inactivity. Would you like to extend your session?"
        variant="warning"
        dismissible={false}
        actions={[
          { label: 'Extend Session', onClick: handleExtend, variant: 'default' },
          { label: 'Logout', onClick: handleLogout, variant: 'outline' },
        ]}
      />
    </>
  );
}

/**
 * Example 9: Info AlertDialog
 */
export function InfoAlertExample() {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setShowInfo(true)}>
        Show Info
      </Button>

      <AlertDialog
        open={showInfo}
        onOpenChange={setShowInfo}
        title="New Feature Available"
        description="We've added a new flashcard review mode! Try it out in the Review section."
        variant="info"
      />
    </>
  );
}

/**
 * Example 10: ConfirmDialog with External Loading State
 */
export function ExternalLoadingExample() {
  const [showDialog, setShowDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleConfirm = async () => {
    setIsProcessing(true);
    // Simulate long-running operation
    await new Promise((resolve) => setTimeout(resolve, 3000));
    setIsProcessing(false);
    setShowDialog(false);
  };

  return (
    <>
      <Button onClick={() => setShowDialog(true)}>Process Data</Button>

      <ConfirmDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        title="Process Large Dataset"
        description="This operation may take several minutes to complete. Do you want to proceed?"
        confirmText="Start Processing"
        onConfirm={handleConfirm}
        loading={isProcessing}
      />
    </>
  );
}
