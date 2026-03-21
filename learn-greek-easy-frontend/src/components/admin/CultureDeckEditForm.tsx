// src/components/admin/CultureDeckEditForm.tsx

import React, { useEffect, useRef, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DialogFooter } from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { UnifiedDeckItem } from '@/services/adminAPI';

import { DeactivationWarningDialog } from './DeactivationWarningDialog';

/**
 * Supported languages for culture deck names and descriptions
 */
const DECK_LANGUAGES = ['en', 'ru'] as const;
type DeckLanguage = (typeof DECK_LANGUAGES)[number];

const LANGUAGE_LABELS: Record<DeckLanguage, string> = {
  en: 'English',
  ru: 'Russian',
};

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE_BYTES = 3 * 1024 * 1024;

/**
 * Culture deck categories
 */
const CULTURE_CATEGORIES = [
  'history',
  'geography',
  'politics',
  'culture',
  'traditions',
  'practical',
  'news',
] as const;

type CultureCategory = (typeof CULTURE_CATEGORIES)[number];

/**
 * Validation schema for culture deck edit form with bilingual support
 */
const cultureDeckSchema = z.object({
  name_en: z.string().min(1, 'Name is required').max(255),
  name_ru: z.string().min(1, 'Name is required').max(255),
  description_en: z.string().max(2000).optional().or(z.literal('')),
  description_ru: z.string().max(2000).optional().or(z.literal('')),
  category: z.enum(CULTURE_CATEGORIES as readonly [string, ...string[]]),
  is_active: z.boolean(),
  is_premium: z.boolean(),
});

export type CultureDeckFormData = z.infer<typeof cultureDeckSchema>;

interface BilingualCultureDeckItem extends UnifiedDeckItem {
  name_el?: string;
  name_en?: string;
  name_ru?: string;
  description_el?: string;
  description_en?: string;
  description_ru?: string;
  cover_image_url?: string | null;
}

interface CultureDeckEditFormProps {
  deck: BilingualCultureDeckItem;
  onSave: (data: CultureDeckFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
  onUploadCoverImage?: (file: File) => Promise<void>;
  onRemoveCoverImage?: () => Promise<void>;
}

/**
 * Form component for editing culture deck metadata with bilingual support
 *
 * Fields:
 * - name_en/name_ru: Required text inputs per language (1-255 chars)
 * - description_en/description_ru: Optional textareas per language (max 2000 chars)
 * - category: Culture category dropdown
 * - is_active: Toggle switch for active status
 * - is_premium: Toggle switch for premium status
 */
export const CultureDeckEditForm: React.FC<CultureDeckEditFormProps> = ({
  deck,
  onSave,
  onCancel,
  isLoading = false,
  onUploadCoverImage,
  onRemoveCoverImage,
}) => {
  const { t } = useTranslation('admin');
  const [showDeactivationWarning, setShowDeactivationWarning] = useState(false);
  const [activeTab, setActiveTab] = useState<DeckLanguage>('en');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be selected again
    e.target.value = '';

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setImageError(t('deckEdit.imageFormatError'));
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setImageError(t('deckEdit.imageSizeError'));
      return;
    }

    // Revoke previous blob URL if any
    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }

    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
    setImageError(null);
    setIsUploading(true);

    try {
      await onUploadCoverImage?.(file);
    } catch {
      // Revert preview on error
      URL.revokeObjectURL(previewUrl);
      setImagePreview(deck.cover_image_url ?? null);
      setImageError(t('deckEdit.imageUploadError'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!onRemoveCoverImage) return;
    try {
      setImageError(null);
      await onRemoveCoverImage();
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
      setImagePreview(null);
    } catch {
      setImageError(t('deckEdit.imageRemoveError'));
    }
  };

  const currentImageUrl = imagePreview ?? deck.cover_image_url ?? null;

  // Get the deck name for display in deactivation dialog (prefer English)
  const deckNameDisplay =
    typeof deck.name === 'string'
      ? deck.name
      : typeof deck.name === 'object' && deck.name !== null
        ? deck.name.en || deck.name.ru || ''
        : '';

  const form = useForm<CultureDeckFormData>({
    resolver: zodResolver(cultureDeckSchema),
    mode: 'onChange',
    defaultValues: {
      name_en:
        ((deck as Record<string, unknown>).name_en as string) ||
        (typeof deck.name === 'object' && deck.name !== null
          ? deck.name.en
          : typeof deck.name === 'string'
            ? deck.name
            : '') ||
        '',
      name_ru:
        ((deck as Record<string, unknown>).name_ru as string) ||
        (typeof deck.name === 'object' && deck.name !== null ? deck.name.ru : '') ||
        '',
      description_en: ((deck as Record<string, unknown>).description_en as string) || '',
      description_ru: ((deck as Record<string, unknown>).description_ru as string) || '',
      category: (deck.category as CultureCategory) || 'culture',
      is_active: deck.is_active,
      is_premium: deck.is_premium ?? false,
    },
  });

  /**
   * Check if a language tab has validation errors
   */
  const hasTabErrors = (lang: DeckLanguage): boolean => {
    const nameKey = `name_${lang}` as keyof CultureDeckFormData;
    const descKey = `description_${lang}` as keyof CultureDeckFormData;
    return !!(form.formState.errors[nameKey] || form.formState.errors[descKey]);
  };

  const onSubmit = (data: CultureDeckFormData) => {
    onSave(data);
  };

  /**
   * Handles changes to the is_active switch.
   * Shows a warning dialog when toggling from active to inactive.
   */
  const handleActiveChange = (checked: boolean) => {
    if (!checked && form.getValues('is_active')) {
      // Toggling from active to inactive - show warning
      setShowDeactivationWarning(true);
    } else {
      // Toggling from inactive to active - allow directly
      form.setValue('is_active', checked, { shouldDirty: true });
    }
  };

  const handleDeactivationCancel = () => {
    setShowDeactivationWarning(false);
  };

  const handleDeactivationConfirm = () => {
    setShowDeactivationWarning(false);
    form.setValue('is_active', false, { shouldDirty: true });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
        data-testid="culture-deck-edit-form"
      >
        {/* Language Tabs */}
        <div className="space-y-4">
          <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as DeckLanguage)}>
            <TabsList className="w-full">
              {DECK_LANGUAGES.map((lang) => (
                <TabsTrigger
                  key={lang}
                  value={lang}
                  className={cn('relative flex-1', hasTabErrors(lang) && 'text-destructive')}
                  data-testid={`culture-deck-edit-lang-tab-${lang}`}
                >
                  {LANGUAGE_LABELS[lang]}
                  {hasTabErrors(lang) && (
                    <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-destructive" />
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Tab Content - name and description per language */}
          {DECK_LANGUAGES.map((lang) => (
            <div key={lang} className={cn('space-y-4', activeTab !== lang && 'hidden')}>
              {/* Name field */}
              <FormField
                control={form.control}
                name={`name_${lang}` as 'name_en' | 'name_ru'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name ({LANGUAGE_LABELS[lang]})</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter deck name"
                        data-testid={`culture-deck-edit-name-${lang}`}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description field */}
              <FormField
                control={form.control}
                name={`description_${lang}` as 'description_en' | 'description_ru'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description ({LANGUAGE_LABELS[lang]})</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter deck description (optional)"
                        className="min-h-[100px]"
                        data-testid={`culture-deck-edit-description-${lang}`}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          ))}
        </div>

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('deckEdit.category')}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="deck-edit-category">
                    <SelectValue placeholder={t('deckEdit.categoryPlaceholder')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {CULTURE_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {t(`categories.${category}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">{t('deckEdit.isActive')}</FormLabel>
                <FormDescription>{t('deckEdit.isActiveDescription')}</FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={handleActiveChange}
                  data-testid="deck-edit-is-active"
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="is_premium"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">{t('deckEdit.isPremium')}</FormLabel>
                <FormDescription>{t('deckEdit.isPremiumDescription')}</FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="deck-edit-is-premium"
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Background Image */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('deckEdit.backgroundImage')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('deckEdit.backgroundImageDescription')}
            </p>
            {currentImageUrl && (
              <img
                src={currentImageUrl}
                alt=""
                className="h-24 w-auto rounded-md object-cover"
                data-testid="deck-edit-cover-preview"
              />
            )}
            {isUploading ? (
              <p className="text-sm text-muted-foreground" data-testid="deck-edit-image-uploading">
                {t('deckEdit.imageUploading')}
              </p>
            ) : (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="deck-edit-upload-image"
                >
                  {currentImageUrl ? t('deckEdit.replaceImage') : t('deckEdit.uploadImage')}
                </Button>
                {deck.cover_image_url && onRemoveCoverImage && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleRemoveImage}
                    data-testid="deck-edit-remove-image"
                  >
                    {t('deckEdit.removeImage')}
                  </Button>
                )}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(',')}
              onChange={handleImageChange}
              className="hidden"
              data-testid="deck-edit-cover-input"
            />
            {imageError && (
              <p className="text-sm text-destructive" data-testid="deck-edit-image-error">
                {imageError}
              </p>
            )}
          </CardContent>
        </Card>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} data-testid="deck-edit-cancel">
            {t('deckEdit.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={isLoading || !form.formState.isValid}
            data-testid="deck-edit-save"
          >
            {isLoading ? t('deckEdit.saving') : t('deckEdit.save')}
          </Button>
        </DialogFooter>

        <DeactivationWarningDialog
          open={showDeactivationWarning}
          onCancel={handleDeactivationCancel}
          onConfirm={handleDeactivationConfirm}
          deckName={deckNameDisplay}
        />
      </form>
    </Form>
  );
};
