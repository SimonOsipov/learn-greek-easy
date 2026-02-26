// src/components/admin/news/NewsTab.tsx

/**
 * Admin News Tab Component
 *
 * Main container for managing news items in the admin panel.
 * Features:
 * - JSON input textarea for creating new news items
 * - Submit button with validation
 * - News items table with pagination
 * - Edit and delete functionality
 */

import React, { useEffect, useState } from 'react';

import { Loader2, Newspaper, Volume2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { SummaryCard } from '@/components/admin/SummaryCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import type {
  NewsItemResponse,
  NewsItemWithQuestionCreate,
  QuestionCreate,
} from '@/services/adminAPI';
import { useAdminNewsStore } from '@/stores/adminNewsStore';

import { NewsItemDeleteDialog } from './NewsItemDeleteDialog';
import { NewsItemEditModal } from './NewsItemEditModal';
import { NewsItemsTable } from './NewsItemsTable';

/**
 * Example JSON for the placeholder
 */
const JSON_PLACEHOLDER = `{
  "country": "cyprus",
  "title_el": "Τίτλος ειδήσεων",
  "title_en": "News title",
  "title_ru": "Заголовок новости",
  "description_el": "Περιγραφή στα ελληνικά",
  "description_en": "Description in English",
  "description_ru": "Описание на русском",
  "publication_date": "2024-01-15",
  "original_article_url": "https://example.com/article",
  "source_image_url": "https://example.com/image.jpg",
  "question": {
    "deck_id": "uuid-of-target-deck",
    "question_el": "Ερώτηση στα ελληνικά;",
    "question_en": "Question in English?",
    "question_ru": "Вопрос на русском?",
    "options": [
      { "text_el": "Επιλογή Α", "text_en": "Option A", "text_ru": "Вариант А" },
      { "text_el": "Επιλογή Β", "text_en": "Option B", "text_ru": "Вариант Б" },
      { "text_el": "Επιλογή Γ", "text_en": "Option C", "text_ru": "Вариант В" },
      { "text_el": "Επιλογή Δ", "text_en": "Option D", "text_ru": "Вариант Г" }
    ],
    "correct_answer_index": 0
  }
}`;

/**
 * Required fields for news item creation
 */
const REQUIRED_FIELDS = [
  'country',
  'title_el',
  'title_en',
  'title_ru',
  'description_el',
  'description_en',
  'description_ru',
  'publication_date',
  'original_article_url',
  'source_image_url',
] as const;

/**
 * Validation error types for translation
 */
type ValidationErrorType =
  | 'invalidJson'
  | 'missingFields'
  | 'invalidArticleUrl'
  | 'invalidImageUrl'
  | 'invalidDate'
  | 'invalidCountry';

/**
 * Validates JSON input for news item creation
 */
function validateNewsItemJson(json: string): {
  valid: boolean;
  data?: NewsItemWithQuestionCreate;
  errorType?: ValidationErrorType;
  errorParams?: Record<string, string>;
} {
  // Try to parse JSON
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { valid: false, errorType: 'invalidJson' };
  }

  // Check for required fields
  const missingFields = REQUIRED_FIELDS.filter(
    (field) => !parsed[field] || typeof parsed[field] !== 'string'
  );

  if (missingFields.length > 0) {
    return {
      valid: false,
      errorType: 'missingFields',
      errorParams: { fields: missingFields.join(', ') },
    };
  }

  // Validate URL fields
  try {
    new URL(parsed.original_article_url as string);
  } catch {
    return { valid: false, errorType: 'invalidArticleUrl' };
  }

  try {
    new URL(parsed.source_image_url as string);
  } catch {
    return { valid: false, errorType: 'invalidImageUrl' };
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(parsed.publication_date as string)) {
    return { valid: false, errorType: 'invalidDate' };
  }

  // Validate country
  const VALID_COUNTRIES = ['cyprus', 'greece', 'world'];
  if (!VALID_COUNTRIES.includes(parsed.country as string)) {
    return { valid: false, errorType: 'invalidCountry' };
  }

  // Build the data object
  const data: NewsItemWithQuestionCreate = {
    country: parsed.country as string,
    title_el: parsed.title_el as string,
    title_en: parsed.title_en as string,
    title_ru: parsed.title_ru as string,
    description_el: parsed.description_el as string,
    description_en: parsed.description_en as string,
    description_ru: parsed.description_ru as string,
    publication_date: parsed.publication_date as string,
    original_article_url: parsed.original_article_url as string,
    source_image_url: parsed.source_image_url as string,
  };

  // Include question if present (optional field - backend will validate structure)
  if (parsed.question !== undefined && parsed.question !== null) {
    data.question = parsed.question as QuestionCreate;
  }

  return {
    valid: true,
    data,
  };
}

/**
 * NewsTab component
 */
export const NewsTab: React.FC = () => {
  const { t } = useTranslation('admin');
  const [jsonInput, setJsonInput] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const {
    newsItems,
    selectedItem,
    page,
    pageSize,
    total,
    totalPages,
    isLoading,
    isCreating,
    fetchNewsItems,
    createNewsItem,
    setPage,
    setSelectedItem,
    setCountryFilter,
    countryFilter,
    regeneratingId,
    cooldownEndTime,
    regenerateAudio,
  } = useAdminNewsStore();

  const newsWithAudio = newsItems.filter((item) => !!item.audio_url).length;

  // Fetch news items on mount
  useEffect(() => {
    fetchNewsItems();
  }, [fetchNewsItems]);

  /**
   * Handle JSON submission for creating a news item
   */
  const handleSubmit = async () => {
    const validation = validateNewsItemJson(jsonInput);

    if (!validation.valid || !validation.data) {
      toast({
        title: t('news.create.validationError'),
        description: validation.errorType
          ? t(`news.validation.${validation.errorType}`, validation.errorParams)
          : undefined,
        variant: 'destructive',
      });
      return;
    }

    try {
      await createNewsItem(validation.data);
      toast({
        title: t('news.create.success'),
      });
      setJsonInput(''); // Clear input on success
    } catch (error) {
      // Handle specific error cases
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check for duplicate URL (409)
      if (errorMessage.includes('409') || errorMessage.toLowerCase().includes('duplicate')) {
        toast({
          title: t('news.create.error'),
          description: t('news.create.duplicateUrl'),
          variant: 'destructive',
        });
      }
      // Check for image download failure (400)
      else if (errorMessage.includes('400') || errorMessage.toLowerCase().includes('image')) {
        toast({
          title: t('news.create.error'),
          description: t('news.create.imageDownloadFailed'),
          variant: 'destructive',
        });
      } else {
        toast({
          title: t('news.create.error'),
          description: errorMessage,
          variant: 'destructive',
        });
      }
    }
  };

  /**
   * Handle edit button click
   */
  const handleEdit = (item: typeof selectedItem) => {
    if (item) {
      setSelectedItem(item);
      setIsEditModalOpen(true);
    }
  };

  /**
   * Handle delete button click
   */
  const handleDelete = (item: typeof selectedItem) => {
    if (item) {
      setSelectedItem(item);
      setIsDeleteDialogOpen(true);
    }
  };

  /**
   * Handle regenerate audio button click
   */
  const handleRegenerateAudio = async (item: NewsItemResponse) => {
    try {
      await regenerateAudio(item.id);
      toast({
        title: t('news.audio.regenerateSuccess'),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: t('news.audio.regenerateError'),
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  /**
   * Handle edit modal close
   */
  const handleEditModalClose = (open: boolean) => {
    setIsEditModalOpen(open);
    if (!open) {
      setSelectedItem(null);
    }
  };

  /**
   * Handle delete dialog close
   */
  const handleDeleteDialogClose = (open: boolean) => {
    setIsDeleteDialogOpen(open);
    if (!open) {
      setSelectedItem(null);
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* Create News Item Section */}
        <Card data-testid="news-create-card">
          <CardHeader>
            <CardTitle>{t('news.create.title')}</CardTitle>
            <CardDescription>{t('news.create.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder={JSON_PLACEHOLDER}
                className="min-h-[400px] font-mono text-sm"
                data-testid="news-json-input"
              />
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{t('news.create.hint')}</p>
                <Button
                  onClick={handleSubmit}
                  disabled={isCreating || !jsonInput.trim()}
                  data-testid="news-submit-button"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('news.create.submitting')}
                    </>
                  ) : (
                    t('news.create.submit')
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SummaryCard
            title={t('news.stats.total')}
            value={total}
            icon={<Newspaper className="h-5 w-5 text-muted-foreground" />}
            testId="news-total-card"
          />
          <SummaryCard
            title={t('news.stats.withAudio')}
            value={newsWithAudio}
            icon={<Volume2 className="h-5 w-5 text-muted-foreground" />}
            testId="news-with-audio-card"
          />
        </div>

        {/* News Items Table Section */}
        <NewsItemsTable
          newsItems={newsItems}
          isLoading={isLoading}
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
          onPageChange={setPage}
          onEdit={handleEdit}
          onDelete={handleDelete}
          regeneratingId={regeneratingId}
          cooldownEndTime={cooldownEndTime}
          onRegenerateAudio={handleRegenerateAudio}
          countryFilter={countryFilter}
          onCountryFilterChange={(v) =>
            setCountryFilter(v === null ? 'all' : (v as 'cyprus' | 'greece' | 'world'))
          }
        />
      </div>

      {/* Edit Modal */}
      <NewsItemEditModal
        open={isEditModalOpen}
        onOpenChange={handleEditModalClose}
        item={selectedItem}
      />

      {/* Delete Dialog */}
      <NewsItemDeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={handleDeleteDialogClose}
        item={selectedItem}
      />
    </>
  );
};
