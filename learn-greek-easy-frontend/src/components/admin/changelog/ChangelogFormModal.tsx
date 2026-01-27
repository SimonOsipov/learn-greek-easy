/**
 * Modal form for creating/editing changelog entries.
 */

import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type {
  ChangelogEntryAdmin,
  ChangelogCreateRequest,
  ChangelogLanguage,
  ChangelogTag,
} from '@/types/changelog';
import {
  CHANGELOG_LANGUAGES,
  CHANGELOG_TAG_OPTIONS,
  CHANGELOG_TAG_CONFIG,
} from '@/types/changelog';

// Language labels for tabs
const LANGUAGE_LABELS: Record<ChangelogLanguage, string> = {
  en: 'English',
  el: 'Greek',
  ru: 'Russian',
};

// Validation schema
const formSchema = z.object({
  title_en: z.string().min(1, 'Title is required').max(500),
  title_el: z.string().min(1, 'Title is required').max(500),
  title_ru: z.string().min(1, 'Title is required').max(500),
  content_en: z.string().min(1, 'Content is required'),
  content_el: z.string().min(1, 'Content is required'),
  content_ru: z.string().min(1, 'Content is required'),
  tag: z.enum(['new_feature', 'bug_fix', 'announcement']),
});

type FormData = z.infer<typeof formSchema>;

interface ChangelogFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ChangelogCreateRequest) => Promise<void>;
  entry?: ChangelogEntryAdmin | null;
  isSaving: boolean;
}

export function ChangelogFormModal({
  open,
  onClose,
  onSubmit,
  entry,
  isSaving,
}: ChangelogFormModalProps) {
  const { t } = useTranslation(['admin', 'changelog']);
  const [activeTab, setActiveTab] = useState<ChangelogLanguage>('en');
  const isEditing = !!entry;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title_en: '',
      title_el: '',
      title_ru: '',
      content_en: '',
      content_el: '',
      content_ru: '',
      tag: 'new_feature',
    },
  });

  // Reset form when entry changes or modal opens
  useEffect(() => {
    if (open) {
      if (entry) {
        reset({
          title_en: entry.title_en,
          title_el: entry.title_el,
          title_ru: entry.title_ru,
          content_en: entry.content_en,
          content_el: entry.content_el,
          content_ru: entry.content_ru,
          tag: entry.tag,
        });
      } else {
        reset({
          title_en: '',
          title_el: '',
          title_ru: '',
          content_en: '',
          content_el: '',
          content_ru: '',
          tag: 'new_feature',
        });
      }
      setActiveTab('en');
    }
  }, [open, entry, reset]);

  const handleFormSubmit = async (data: FormData) => {
    await onSubmit(data);
  };

  const currentTag = watch('tag');

  // Check if a language tab has errors
  const hasTabErrors = (lang: ChangelogLanguage): boolean => {
    const titleKey = `title_${lang}` as keyof FormData;
    const contentKey = `content_${lang}` as keyof FormData;
    return !!(errors[titleKey] || errors[contentKey]);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Changelog Entry' : 'Create Changelog Entry'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Tag selector */}
          <div className="space-y-2">
            <Label htmlFor="tag">Tag</Label>
            <Select
              value={currentTag}
              onValueChange={(value: ChangelogTag) => setValue('tag', value)}
            >
              <SelectTrigger id="tag" data-testid="changelog-tag-select">
                <SelectValue placeholder="Select a tag" />
              </SelectTrigger>
              <SelectContent>
                {CHANGELOG_TAG_OPTIONS.map((tag) => (
                  <SelectItem key={tag} value={tag}>
                    {t(CHANGELOG_TAG_CONFIG[tag].labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.tag && <p className="text-sm text-destructive">Please select a tag</p>}
          </div>

          {/* Language tabs */}
          <div className="space-y-4">
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {CHANGELOG_LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setActiveTab(lang)}
                  data-testid={`changelog-lang-tab-${lang}`}
                  className={cn(
                    'relative flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                    activeTab === lang ? 'bg-background shadow' : 'hover:bg-background/50',
                    hasTabErrors(lang) && 'text-destructive'
                  )}
                >
                  {LANGUAGE_LABELS[lang]}
                  {hasTabErrors(lang) && (
                    <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-destructive" />
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {CHANGELOG_LANGUAGES.map((lang) => (
              <div key={lang} className={cn('space-y-4', activeTab !== lang && 'hidden')}>
                <div className="space-y-2">
                  <Label htmlFor={`title_${lang}`}>Title ({LANGUAGE_LABELS[lang]})</Label>
                  <Input
                    id={`title_${lang}`}
                    {...register(`title_${lang}` as keyof FormData)}
                    placeholder={`Enter title in ${LANGUAGE_LABELS[lang]}`}
                    data-testid={`changelog-title-input-${lang}`}
                  />
                  {errors[`title_${lang}` as keyof FormData] && (
                    <p className="text-sm text-destructive">Title is required</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`content_${lang}`}>Content ({LANGUAGE_LABELS[lang]})</Label>
                  <Textarea
                    id={`content_${lang}`}
                    {...register(`content_${lang}` as keyof FormData)}
                    placeholder={`Enter content in ${LANGUAGE_LABELS[lang]} (supports **bold** and *italic*)`}
                    rows={5}
                    data-testid={`changelog-content-input-${lang}`}
                  />
                  {errors[`content_${lang}` as keyof FormData] && (
                    <p className="text-sm text-destructive">Content is required</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
              data-testid="changelog-form-cancel"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving} data-testid="changelog-form-submit">
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : isEditing ? (
                'Save Changes'
              ) : (
                'Create'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
