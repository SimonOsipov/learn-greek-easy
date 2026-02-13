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

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Circle, Loader2, RefreshCw } from 'lucide-react';
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

function formatAudioDuration(seconds: number): string {
  const safe = Math.max(0, seconds || 0);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
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
  const { updateNewsItem, isUpdating, regenerateAudio } = useAdminNewsStore();

  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize JSON input when item changes
  useEffect(() => {
    if (item) {
      setJsonInput(itemToEditableJson(item, t('news.edit.imageUrlPlaceholder')));
    }
  }, [item, t]);

  // Clear cooldown when modal closes
  useEffect(() => {
    if (!open) {
      setCooldownRemaining(0);
      setIsRegenerating(false);
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
    }
  }, [open]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
      }
    };
  }, []);

  const handleRegenerate = useCallback(async () => {
    if (!item || isRegenerating || cooldownRemaining > 0) return;

    setIsRegenerating(true);
    try {
      await regenerateAudio(item.id);
      toast({ title: t('news.audio.regenerateSuccess') });

      setCooldownRemaining(15);
      cooldownTimerRef.current = setInterval(() => {
        setCooldownRemaining((prev) => {
          if (prev <= 1) {
            if (cooldownTimerRef.current) {
              clearInterval(cooldownTimerRef.current);
              cooldownTimerRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: t('news.audio.regenerateError'),
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsRegenerating(false);
    }
  }, [item, isRegenerating, cooldownRemaining, regenerateAudio, t]);

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

        {/* Audio Status Section */}
        <div className="rounded-lg border p-4" data-testid="audio-status-section">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium">{t('news.audio.statusTitle')}</h4>
                {item.audio_url ? (
                  <Circle className="h-2.5 w-2.5 fill-green-500 text-green-500" />
                ) : (
                  <Circle className="h-2.5 w-2.5 fill-muted-foreground/40 text-muted-foreground/40" />
                )}
              </div>
              {item.audio_url ? (
                <div className="space-y-0.5 text-xs text-muted-foreground">
                  {item.audio_duration_seconds != null && (
                    <p>
                      {t('news.audio.duration')}: {formatAudioDuration(item.audio_duration_seconds)}
                    </p>
                  )}
                  {item.audio_file_size_bytes != null && (
                    <p>
                      {t('news.audio.fileSize')}: {formatFileSize(item.audio_file_size_bytes)}
                    </p>
                  )}
                  {item.audio_generated_at && (
                    <p>
                      {t('news.audio.generated')}:{' '}
                      {new Date(item.audio_generated_at).toLocaleString()}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/60">
                  {t('news.audio.noAudioGenerated')}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={isRegenerating || cooldownRemaining > 0}
              data-testid="modal-regenerate-audio"
            >
              {isRegenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('news.audio.regenerating')}
                </>
              ) : cooldownRemaining > 0 ? (
                `${cooldownRemaining}s`
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t('news.audio.regenerate')}
                </>
              )}
            </Button>
          </div>
        </div>

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
