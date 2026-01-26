// src/components/admin/news/NewsItemEditModal.tsx

/**
 * News Item Edit Modal Component
 *
 * Modal dialog for editing an existing news item.
 * Features:
 * - Pre-filled JSON textarea with current item data
 * - Excludes source_image_url unless user wants to change the image
 * - Save/Cancel buttons with loading state
 * - JSON validation
 */

import React, { useEffect, useState } from 'react';

import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/useLanguage';
import type { NewsItemResponse, NewsItemUpdate } from '@/services/adminAPI';
import { useAdminNewsStore } from '@/stores/adminNewsStore';

/**
 * Get localized title based on current interface language
 */
function getLocalizedTitle(item: NewsItemResponse, lang: string): string {
  switch (lang) {
    case 'el':
      return item.title_el;
    case 'ru':
      return item.title_ru;
    default: // 'en'
      return item.title_en;
  }
}

interface NewsItemEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: NewsItemResponse | null;
}

/**
 * Convert a news item to editable JSON format
 * Excludes id, created_at, updated_at, and image_url (read-only fields)
 * Includes source_image_url as optional placeholder for changing the image
 */
function itemToEditableJson(item: NewsItemResponse, imageUrlPlaceholder: string): string {
  const editable = {
    title_el: item.title_el,
    title_en: item.title_en,
    title_ru: item.title_ru,
    description_el: item.description_el,
    description_en: item.description_en,
    description_ru: item.description_ru,
    publication_date: item.publication_date,
    original_article_url: item.original_article_url,
    // Include source_image_url as empty to show it's optional
    // User can add a URL here to replace the image
    source_image_url: imageUrlPlaceholder,
  };
  return JSON.stringify(editable, null, 2);
}

/**
 * Validation error types for translation
 */
type ValidationErrorType =
  | 'invalidJson'
  | 'invalidArticleUrl'
  | 'invalidImageUrl'
  | 'invalidDate'
  | 'noFieldsToUpdate';

/**
 * Validate and parse the edited JSON
 */
function parseEditJson(json: string): {
  valid: boolean;
  data?: NewsItemUpdate;
  errorType?: ValidationErrorType;
} {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { valid: false, errorType: 'invalidJson' };
  }

  const update: NewsItemUpdate = {};

  // Only include non-empty string fields
  const stringFields = [
    'title_el',
    'title_en',
    'title_ru',
    'description_el',
    'description_en',
    'description_ru',
    'publication_date',
    'original_article_url',
  ] as const;

  for (const field of stringFields) {
    const value = parsed[field];
    if (typeof value === 'string' && value.trim()) {
      (update as Record<string, string>)[field] = value.trim();
    }
  }

  // Handle source_image_url specially - only include if it's a valid URL
  const sourceImageUrl = parsed.source_image_url;
  if (
    typeof sourceImageUrl === 'string' &&
    sourceImageUrl.trim() &&
    !sourceImageUrl.includes('(optional')
  ) {
    try {
      new URL(sourceImageUrl);
      update.source_image_url = sourceImageUrl.trim();
    } catch {
      return { valid: false, errorType: 'invalidImageUrl' };
    }
  }

  // Validate original_article_url if provided
  if (update.original_article_url) {
    try {
      new URL(update.original_article_url);
    } catch {
      return { valid: false, errorType: 'invalidArticleUrl' };
    }
  }

  // Validate date format if provided
  if (update.publication_date) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(update.publication_date)) {
      return { valid: false, errorType: 'invalidDate' };
    }
  }

  // Check that at least one field is being updated
  if (Object.keys(update).length === 0) {
    return { valid: false, errorType: 'noFieldsToUpdate' };
  }

  return { valid: true, data: update };
}

/**
 * NewsItemEditModal component
 */
export const NewsItemEditModal: React.FC<NewsItemEditModalProps> = ({
  open,
  onOpenChange,
  item,
}) => {
  const { t } = useTranslation('admin');
  const { currentLanguage } = useLanguage();
  const [jsonInput, setJsonInput] = useState('');
  const { updateNewsItem, isUpdating } = useAdminNewsStore();

  // Initialize JSON input when item changes
  useEffect(() => {
    if (item) {
      setJsonInput(itemToEditableJson(item, t('news.edit.imageUrlPlaceholder')));
    }
  }, [item, t]);

  const handleSave = async () => {
    if (!item) return;

    const validation = parseEditJson(jsonInput);

    if (!validation.valid || !validation.data) {
      toast({
        title: t('news.edit.validationError'),
        description: validation.errorType
          ? t(`news.validation.${validation.errorType}`)
          : undefined,
        variant: 'destructive',
      });
      return;
    }

    try {
      await updateNewsItem(item.id, validation.data);
      toast({
        title: t('news.edit.success'),
      });
      onOpenChange(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check for image download failure
      if (errorMessage.includes('400') || errorMessage.toLowerCase().includes('image')) {
        toast({
          title: t('news.edit.error'),
          description: t('news.create.imageDownloadFailed'),
          variant: 'destructive',
        });
      } else {
        toast({
          title: t('news.edit.error'),
          description: errorMessage,
          variant: 'destructive',
        });
      }
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]" data-testid="news-edit-modal">
        <DialogHeader>
          <DialogTitle>{t('news.edit.title')}</DialogTitle>
          <DialogDescription>{getLocalizedTitle(item, currentLanguage)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            className="min-h-[300px] font-mono text-sm"
            data-testid="news-edit-json-input"
          />
          <p className="text-sm text-muted-foreground">{t('news.edit.hint')}</p>
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUpdating}
            data-testid="news-edit-cancel"
          >
            {t('news.edit.cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={isUpdating || !jsonInput.trim()}
            data-testid="news-edit-save"
          >
            {isUpdating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('news.edit.saving')}
              </>
            ) : (
              t('news.edit.save')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
