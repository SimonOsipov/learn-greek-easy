// src/components/admin/HtmlViewerModal.tsx

import React, { useCallback, useState } from 'react';

import { format } from 'date-fns';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface HtmlViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  htmlContent: string | null;
  fetchedAt: string | null;
  finalUrl: string | null;
}

/**
 * Modal for displaying raw HTML content from a fetch history item.
 *
 * Features:
 * - Displays raw HTML in a monospace pre element
 * - Copy to clipboard button
 * - Shows fetched_at date and final_url in header
 * - Scrollable for large content
 */
export const HtmlViewerModal: React.FC<HtmlViewerModalProps> = ({
  open,
  onOpenChange,
  htmlContent,
  fetchedAt,
  finalUrl,
}) => {
  const { t } = useTranslation('admin');
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!htmlContent) return;

    try {
      await navigator.clipboard.writeText(htmlContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = htmlContent;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [htmlContent]);

  const formattedDate = fetchedAt ? format(new Date(fetchedAt), 'PPpp') : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden">
        <DialogHeader>
          <DialogTitle data-testid="html-viewer-title">{t('sources.htmlViewer.title')}</DialogTitle>
          <DialogDescription className="space-y-1">
            {formattedDate && (
              <span className="block text-sm">
                {t('sources.history.columns.timestamp')}: {formattedDate}
              </span>
            )}
            {finalUrl && (
              <a
                href={finalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                {finalUrl}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            disabled={!htmlContent}
            data-testid="html-viewer-copy-btn"
          >
            {copied ? (
              <>
                <Check className="mr-1 h-4 w-4" />
                {t('sources.htmlViewer.copied')}
              </>
            ) : (
              <>
                <Copy className="mr-1 h-4 w-4" />
                {t('sources.htmlViewer.copy')}
              </>
            )}
          </Button>
        </div>

        <div
          className="max-h-[60vh] overflow-auto rounded-md border bg-muted/50 p-4"
          data-testid="html-viewer-content"
        >
          <pre className="whitespace-pre-wrap break-all font-mono text-xs">
            {htmlContent || t('sources.history.empty')}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
};
