import { useState } from 'react';

import { AlertTriangle, Trash2, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { DeleteAccountDialog } from './DeleteAccountDialog';
import { ResetProgressDialog } from './ResetProgressDialog';

export function DangerZoneSection() {
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  return (
    <>
      <Card className="border-red-200 dark:border-red-900">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <CardTitle className="text-red-600">Danger Zone</CardTitle>
          </div>
          <CardDescription>Irreversible actions that affect your account and data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Reset Progress */}
          <div className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-red-600" />
                <h3 className="font-medium text-red-900 dark:text-red-100">Reset All Progress</h3>
              </div>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                Clear all learning progress, review history, and statistics. Your account and
                settings will be preserved.
              </p>
            </div>
            <Button
              variant="outline"
              className="ml-4 border-red-300 text-red-700 hover:bg-red-100 hover:text-red-800 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900"
              onClick={() => setShowResetDialog(true)}
            >
              Reset Progress
            </Button>
          </div>

          {/* Delete Account */}
          <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-red-600" />
                <h3 className="font-medium text-red-900 dark:text-red-100">Delete Account</h3>
              </div>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                Permanently delete your account and all associated data. This action cannot be
                undone.
              </p>
            </div>
            <Button
              variant="destructive"
              className="ml-4"
              onClick={() => setShowDeleteDialog(true)}
            >
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>

      <ResetProgressDialog open={showResetDialog} onOpenChange={setShowResetDialog} />
      <DeleteAccountDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} />
    </>
  );
}
