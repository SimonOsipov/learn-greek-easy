/**
 * Modal for editing changelog entries via JSON.
 *
 * Converts entry to editable JSON format, allows editing,
 * validates on save, and updates via adminChangelogStore.
 */

import { useState, useEffect } from 'react';

import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { getApiErrorMessage } from '@/lib/apiErrorUtils';
import { useAdminChangelogStore, selectAdminChangelogIsSaving } from '@/stores/adminChangelogStore';
import type { ChangelogEntryAdmin, ChangelogUpdateRequest } from '@/types/changelog';
import { CHANGELOG_TAG_OPTIONS } from '@/types/changelog';

import { sanitizeJsonInput } from './changelogJsonValidation';

/**
 * Converts a changelog entry to editable JSON string.
 * Only includes the fields that can be edited (excludes id, timestamps).
 */
function entryToEditableJson(entry: ChangelogEntryAdmin): string {
  return JSON.stringify(
    {
      tag: entry.tag,
      title_en: entry.title_en,
      title_ru: entry.title_ru,
      content_en: entry.content_en,
      content_ru: entry.content_ru,
    },
    null,
    2
  );
}

/**
 * Validates parsed JSON and returns ChangelogUpdateRequest or error message.
 */
function validateEditJson(
  parsed: unknown,
  t: (key: string, options?: Record<string, unknown>) => string
): { data: ChangelogUpdateRequest } | { error: string } {
  if (typeof parsed !== 'object' || parsed === null) {
    return { error: t('admin:changelog.validation.invalidJson') };
  }

  const obj = parsed as Record<string, unknown>;
  const requiredFields = ['tag', 'title_en', 'title_ru', 'content_en', 'content_ru'];
  const missingFields = requiredFields.filter(
    (field) => typeof obj[field] !== 'string' || obj[field] === ''
  );

  if (missingFields.length > 0) {
    return {
      error: t('admin:changelog.validation.missingFields', {
        fields: missingFields.join(', '),
      }),
    };
  }

  if (!CHANGELOG_TAG_OPTIONS.includes(obj.tag as ChangelogEntryAdmin['tag'])) {
    return { error: t('admin:changelog.validation.invalidTag') };
  }

  return {
    data: {
      tag: obj.tag as ChangelogEntryAdmin['tag'],
      title_en: obj.title_en as string,
      title_ru: obj.title_ru as string,
      content_en: obj.content_en as string,
      content_ru: obj.content_ru as string,
    },
  };
}

interface ChangelogEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: ChangelogEntryAdmin;
}

export function ChangelogEditModal({ open, onOpenChange, entry }: ChangelogEditModalProps) {
  const { t } = useTranslation(['admin', 'changelog']);
  const [jsonValue, setJsonValue] = useState('');

  // Store state
  const isSaving = useAdminChangelogStore(selectAdminChangelogIsSaving);
  const { updateEntry } = useAdminChangelogStore();

  // Initialize JSON when modal opens or entry changes
  useEffect(() => {
    if (open && entry) {
      setJsonValue(entryToEditableJson(entry));
    }
  }, [open, entry]);

  const handleSave = async () => {
    // Sanitize and parse JSON
    const sanitizedJson = sanitizeJsonInput(jsonValue);
    let parsed: unknown;
    try {
      parsed = JSON.parse(sanitizedJson);
    } catch {
      toast({
        title: t('admin:changelog.validation.invalidJson'),
        variant: 'destructive',
      });
      return;
    }

    // Validate
    const result = validateEditJson(parsed, t);
    if ('error' in result) {
      toast({
        title: result.error,
        variant: 'destructive',
      });
      return;
    }

    // Save
    try {
      await updateEntry(entry.id, result.data);
      toast({
        title: t('admin:changelog.edit.success'),
      });
      onOpenChange(false);
    } catch (error) {
      const apiErrorMessage = getApiErrorMessage(error);
      toast({
        title: t('admin:changelog.edit.error'),
        description: apiErrorMessage || undefined,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('admin:changelog.edit.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('admin:changelog.edit.hint')}</p>

          <Textarea
            value={jsonValue}
            onChange={(e) => setJsonValue(e.target.value)}
            rows={15}
            className="font-mono text-sm"
            data-testid="changelog-json-textarea"
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            data-testid="changelog-edit-cancel"
          >
            {t('admin:changelog.edit.cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            data-testid="changelog-edit-save"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('admin:changelog.edit.saving')}
              </>
            ) : (
              t('admin:changelog.edit.save')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
