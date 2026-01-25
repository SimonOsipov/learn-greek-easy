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

import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import type { NewsItemCreate } from '@/services/adminAPI';
import { useAdminNewsStore } from '@/stores/adminNewsStore';

import { NewsItemDeleteDialog } from './NewsItemDeleteDialog';
import { NewsItemEditModal } from './NewsItemEditModal';
import { NewsItemsTable } from './NewsItemsTable';

/**
 * Example JSON for the placeholder
 */
const JSON_PLACEHOLDER = `{
  "title_el": "Greek title",
  "title_en": "English title",
  "title_ru": "Russian title",
  "description_el": "Greek description",
  "description_en": "English description",
  "description_ru": "Russian description",
  "publication_date": "2024-01-15",
  "original_article_url": "https://example.com/article",
  "source_image_url": "https://example.com/image.jpg"
}`;

/**
 * Required fields for news item creation
 */
const REQUIRED_FIELDS = [
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
 * Validates JSON input for news item creation
 */
function validateNewsItemJson(json: string): {
  valid: boolean;
  data?: NewsItemCreate;
  error?: string;
} {
  // Try to parse JSON
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { valid: false, error: 'Invalid JSON format' };
  }

  // Check for required fields
  const missingFields = REQUIRED_FIELDS.filter(
    (field) => !parsed[field] || typeof parsed[field] !== 'string'
  );

  if (missingFields.length > 0) {
    return {
      valid: false,
      error: `Missing or invalid fields: ${missingFields.join(', ')}`,
    };
  }

  // Validate URL fields
  try {
    new URL(parsed.original_article_url as string);
  } catch {
    return { valid: false, error: 'Invalid original_article_url format' };
  }

  try {
    new URL(parsed.source_image_url as string);
  } catch {
    return { valid: false, error: 'Invalid source_image_url format' };
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(parsed.publication_date as string)) {
    return { valid: false, error: 'Invalid publication_date format (use YYYY-MM-DD)' };
  }

  return {
    valid: true,
    data: {
      title_el: parsed.title_el as string,
      title_en: parsed.title_en as string,
      title_ru: parsed.title_ru as string,
      description_el: parsed.description_el as string,
      description_en: parsed.description_en as string,
      description_ru: parsed.description_ru as string,
      publication_date: parsed.publication_date as string,
      original_article_url: parsed.original_article_url as string,
      source_image_url: parsed.source_image_url as string,
    },
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
  } = useAdminNewsStore();

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
        description: validation.error,
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
                className="min-h-[200px] font-mono text-sm"
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
