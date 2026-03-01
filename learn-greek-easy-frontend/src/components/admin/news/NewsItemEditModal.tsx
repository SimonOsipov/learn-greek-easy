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

import { format } from 'date-fns';
import { el } from 'date-fns/locale/el';
import { ru } from 'date-fns/locale/ru';
import { Circle, Loader2, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { WaveformPlayer } from '@/components/culture/WaveformPlayer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/useLanguage';
import type { NewsItemResponse, NewsItemUpdate } from '@/services/adminAPI';
import { useAdminNewsStore } from '@/stores/adminNewsStore';

function getDateLocale(lang: string) {
  switch (lang) {
    case 'el':
      return el;
    case 'ru':
      return ru;
    default:
      return undefined;
  }
}

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
    country: item.country,
    title_el: item.title_el,
    title_en: item.title_en,
    title_ru: item.title_ru,
    description_el: item.description_el,
    description_en: item.description_en,
    description_ru: item.description_ru,
    title_el_a2: item.title_el_a2 ?? '',
    description_el_a2: item.description_el_a2 ?? '',
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
  | 'noFieldsToUpdate'
  | 'invalidCountry'
  | 'a2FieldsPaired';

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

  // Handle country field if present
  const countryValue = parsed.country;
  if (typeof countryValue === 'string' && countryValue.trim()) {
    const VALID_COUNTRIES = ['cyprus', 'greece', 'world'];
    if (!VALID_COUNTRIES.includes(countryValue.trim())) {
      return { valid: false, errorType: 'invalidCountry' };
    }
    (update as Record<string, string>)['country'] = countryValue.trim();
  }

  // A2 pair validation: both keys must be present together or absent together
  const hasA2TitleKey = Object.prototype.hasOwnProperty.call(parsed, 'title_el_a2');
  const hasA2DescKey = Object.prototype.hasOwnProperty.call(parsed, 'description_el_a2');
  if (hasA2TitleKey !== hasA2DescKey) {
    return { valid: false, errorType: 'a2FieldsPaired' };
  }
  if (hasA2TitleKey && hasA2DescKey) {
    if (typeof parsed.title_el_a2 !== 'string' || typeof parsed.description_el_a2 !== 'string') {
      return { valid: false, errorType: 'a2FieldsPaired' };
    }
    const a2Title = parsed.title_el_a2.trim();
    const a2Desc = parsed.description_el_a2.trim();
    const hasA2Title = a2Title !== '';
    const hasA2Desc = a2Desc !== '';
    if (hasA2Title !== hasA2Desc) {
      return { valid: false, errorType: 'a2FieldsPaired' };
    }
    (update as Record<string, unknown>)['title_el_a2'] = a2Title;
    (update as Record<string, unknown>)['description_el_a2'] = a2Desc;
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
  const { updateNewsItem, isUpdating, regenerateAudio, regenerateA2Audio } = useAdminNewsStore();
  const [audioError, setAudioError] = useState(false);

  const [cooldownB2Remaining, setCooldownB2Remaining] = useState(0);
  const [isRegeneratingB2, setIsRegeneratingB2] = useState(false);
  const cooldownB2TimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [cooldownA2Remaining, setCooldownA2Remaining] = useState(0);
  const [isRegeneratingA2, setIsRegeneratingA2] = useState(false);
  const cooldownA2TimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [audioA2Error, setAudioA2Error] = useState<string | null>(null);

  // Initialize JSON input when item changes
  useEffect(() => {
    if (item) {
      setJsonInput(itemToEditableJson(item, t('news.edit.imageUrlPlaceholder')));
      setAudioError(false);
    }
  }, [item, t]);

  // Clear cooldown when modal closes
  useEffect(() => {
    if (!open) {
      setCooldownB2Remaining(0);
      setIsRegeneratingB2(false);
      if (cooldownB2TimerRef.current) {
        clearInterval(cooldownB2TimerRef.current);
        cooldownB2TimerRef.current = null;
      }
      setCooldownA2Remaining(0);
      setIsRegeneratingA2(false);
      if (cooldownA2TimerRef.current) {
        clearInterval(cooldownA2TimerRef.current);
        cooldownA2TimerRef.current = null;
      }
      setAudioA2Error(null);
    }
  }, [open]);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (cooldownB2TimerRef.current) {
        clearInterval(cooldownB2TimerRef.current);
      }
      if (cooldownA2TimerRef.current) {
        clearInterval(cooldownA2TimerRef.current);
      }
    };
  }, []);

  const handleRegenerateB2 = useCallback(async () => {
    if (!item || isRegeneratingB2 || cooldownB2Remaining > 0) return;

    setIsRegeneratingB2(true);
    try {
      await regenerateAudio(item.id);
      toast({ title: t('news.audio.regenerateSuccess') });

      setCooldownB2Remaining(15);
      cooldownB2TimerRef.current = setInterval(() => {
        setCooldownB2Remaining((prev) => {
          if (prev <= 1) {
            if (cooldownB2TimerRef.current) {
              clearInterval(cooldownB2TimerRef.current);
              cooldownB2TimerRef.current = null;
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
      setIsRegeneratingB2(false);
    }
  }, [item, isRegeneratingB2, cooldownB2Remaining, regenerateAudio, t]);

  const handleRegenerateA2 = useCallback(async () => {
    if (!item || !item.has_a2_content || isRegeneratingA2 || cooldownA2Remaining > 0) return;

    setIsRegeneratingA2(true);
    try {
      await regenerateA2Audio(item.id);
      toast({ title: t('news.audio.regenerateA2Success') });
      // Start A2 cooldown timer (same pattern as B2)
      setCooldownA2Remaining(30);
      cooldownA2TimerRef.current = setInterval(() => {
        setCooldownA2Remaining((prev) => {
          if (prev <= 1) {
            if (cooldownA2TimerRef.current) {
              clearInterval(cooldownA2TimerRef.current);
              cooldownA2TimerRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch {
      toast({ title: t('news.audio.regenerateA2Error'), variant: 'destructive' });
    } finally {
      setIsRegeneratingA2(false);
    }
  }, [item, isRegeneratingA2, cooldownA2Remaining, regenerateA2Audio, t]);

  const handleAudioError = useCallback(() => {
    setAudioError(true);
  }, []);

  const handleA2AudioError = () => setAudioA2Error(t('news.audio.loadError'));

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
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]"
        data-testid="news-edit-modal"
      >
        <DialogHeader>
          <DialogTitle>{t('news.edit.title')}</DialogTitle>
          <DialogDescription>{getLocalizedTitle(item, currentLanguage)}</DialogDescription>
        </DialogHeader>

        {/* Audio Status Section */}
        <Card data-testid="audio-status-section">
          <CardContent className="p-4">
            {/* B2 Audio Section */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium">{t('news.audio.b2StatusTitle')}</h4>
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
                        {t('news.audio.duration')}:{' '}
                        {formatAudioDuration(item.audio_duration_seconds)}
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
                        {format(new Date(item.audio_generated_at), 'dd MMM yyyy, HH:mm', {
                          locale: getDateLocale(currentLanguage),
                        })}
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
                onClick={handleRegenerateB2}
                disabled={isRegeneratingB2 || cooldownB2Remaining > 0}
                data-testid="modal-regenerate-b2-audio"
              >
                {isRegeneratingB2 ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('news.audio.regeneratingB2')}
                  </>
                ) : cooldownB2Remaining > 0 ? (
                  `${cooldownB2Remaining}s`
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {t('news.audio.regenerateB2')}
                  </>
                )}
              </Button>
            </div>
            {/* B2 Audio Player */}
            <div className="mt-3" data-testid="audio-player-container">
              <WaveformPlayer
                audioUrl={item.audio_url ?? undefined}
                variant="admin"
                showSpeedControl={false}
                disabled={!item.audio_url}
                onError={handleAudioError}
              />
              {audioError && (
                <p
                  className="mt-1.5 text-xs text-destructive"
                  data-testid="audio-load-error"
                  role="alert"
                >
                  {t('news.audio.loadError')}
                </p>
              )}
            </div>

            <Separator className="my-4" />

            {/* A2 Audio Section */}
            <div>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium">{t('news.audio.a2StatusTitle')}</h4>
                    <div
                      className={`h-2 w-2 rounded-full ${item.audio_a2_url ? 'bg-green-500' : 'bg-gray-300'}`}
                    />
                  </div>
                  {item.has_a2_content ? (
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {item.audio_a2_duration_seconds && (
                        <p>{Math.round(item.audio_a2_duration_seconds)}s</p>
                      )}
                      {item.audio_a2_file_size_bytes && (
                        <p>{Math.round(item.audio_a2_file_size_bytes / 1024)}KB</p>
                      )}
                      {item.audio_a2_generated_at && (
                        <p>{new Date(item.audio_a2_generated_at).toLocaleDateString()}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t('news.audio.noA2Content')}</p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isRegeneratingA2 || cooldownA2Remaining > 0 || !item.has_a2_content}
                  onClick={handleRegenerateA2}
                  data-testid="modal-regenerate-a2-audio"
                >
                  {isRegeneratingA2
                    ? t('news.audio.regeneratingA2')
                    : cooldownA2Remaining > 0
                      ? `${cooldownA2Remaining}s`
                      : t('news.audio.regenerateA2')}
                </Button>
              </div>
              {audioA2Error && <p className="mt-1 text-xs text-destructive">{audioA2Error}</p>}
              <div className="mt-3" data-testid="audio-a2-player-container">
                <WaveformPlayer
                  audioUrl={item.audio_a2_url ?? undefined}
                  variant="admin"
                  showSpeedControl={false}
                  disabled={!item.audio_a2_url}
                  onError={handleA2AudioError}
                />
              </div>
            </div>
          </CardContent>
        </Card>

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
