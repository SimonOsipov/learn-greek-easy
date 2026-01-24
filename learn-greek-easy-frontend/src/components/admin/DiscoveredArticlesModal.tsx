// src/components/admin/DiscoveredArticlesModal.tsx

import React, { useState, useEffect, useCallback } from 'react';

import { format } from 'date-fns';
import {
  FileText,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  Loader2,
  CheckCircle,
  Sparkles,
  Eye,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  adminAPI,
  type FetchHistoryItem,
  type FetchHistoryDetailResponse,
  type DiscoveredArticle,
} from '@/services/adminAPI';
import { APIRequestError } from '@/services/api';

import { QuestionReviewModal } from './QuestionReviewModal';

interface DiscoveredArticlesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  historyItem: FetchHistoryItem | null;
  sourceName: string;
}

/**
 * Modal for displaying discovered articles from AI analysis.
 *
 * Features:
 * - Displays loading state while fetching
 * - Shows pending/analyzing state with spinner
 * - Shows completed state with articles list
 * - Shows empty state when no articles found
 * - Shows error state with retry button
 * - Displays token usage and estimated cost
 * - Auto-polls while analysis is pending
 */
export const DiscoveredArticlesModal: React.FC<DiscoveredArticlesModalProps> = ({
  open,
  onOpenChange,
  historyItem,
  sourceName,
}) => {
  const { t } = useTranslation('admin');
  const [data, setData] = useState<FetchHistoryDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State for article buttons
  interface ArticleState {
    buttonState: 'idle' | 'loading' | 'generated' | 'approved' | 'error';
    questionId: string | null;
  }
  const [articleStates, setArticleStates] = useState<Record<string, ArticleState>>({});

  // Review modal state
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewingArticle, setReviewingArticle] = useState<DiscoveredArticle | null>(null);
  const [reviewingQuestionId, setReviewingQuestionId] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    if (!historyItem) return;
    setIsLoading(true);
    setError(null);
    try {
      const results = await adminAPI.getAnalysisResults(historyItem.id);
      setData(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error.generic'));
    } finally {
      setIsLoading(false);
    }
  }, [historyItem, t]);

  // Fetch results when modal opens
  useEffect(() => {
    if (open && historyItem) {
      fetchResults();
    }
    // Reset state when modal closes
    if (!open) {
      setData(null);
      setError(null);
      setArticleStates({});
      setReviewModalOpen(false);
      setReviewingArticle(null);
      setReviewingQuestionId(null);
    }
  }, [open, historyItem, fetchResults]);

  // Poll while analysis is pending
  useEffect(() => {
    if (!open || data?.analysis_status !== 'pending') return;
    const interval = setInterval(fetchResults, 3000);
    return () => clearInterval(interval);
  }, [open, data?.analysis_status, fetchResults]);

  // Check article usage status when articles load
  useEffect(() => {
    if (!data?.discovered_articles || data.discovered_articles.length === 0) return;

    const checkUsage = async () => {
      const initialStates: Record<string, ArticleState> = {};

      await Promise.all(
        data.discovered_articles!.map(async (article) => {
          try {
            const result = await adminAPI.checkArticleUsage(article.url);
            if (result.used && result.question_id) {
              initialStates[article.url] = {
                buttonState: 'generated',
                questionId: result.question_id,
              };
            } else {
              initialStates[article.url] = { buttonState: 'idle', questionId: null };
            }
          } catch {
            initialStates[article.url] = { buttonState: 'idle', questionId: null };
          }
        })
      );

      setArticleStates(initialStates);
    };

    checkUsage();
  }, [data?.discovered_articles]);

  /**
   * Handle generating a question from an article
   */
  const handleGenerateQuestion = async (article: DiscoveredArticle) => {
    if (!historyItem) return;

    setArticleStates((prev) => ({
      ...prev,
      [article.url]: { buttonState: 'loading', questionId: null },
    }));

    try {
      const response = await adminAPI.generateQuestion({
        article_url: article.url,
        article_title: article.title,
        fetch_history_id: historyItem.id,
      });

      setArticleStates((prev) => ({
        ...prev,
        [article.url]: { buttonState: 'generated', questionId: response.question_id },
      }));
    } catch (err: unknown) {
      if (err instanceof APIRequestError && err.status === 409) {
        // Already used - check for question ID
        try {
          const check = await adminAPI.checkArticleUsage(article.url);
          setArticleStates((prev) => ({
            ...prev,
            [article.url]: {
              buttonState: 'generated',
              questionId: check.question_id || null,
            },
          }));
        } catch {
          setArticleStates((prev) => ({
            ...prev,
            [article.url]: { buttonState: 'generated', questionId: null },
          }));
        }
      } else {
        setArticleStates((prev) => ({
          ...prev,
          [article.url]: { buttonState: 'error', questionId: null },
        }));
        setTimeout(() => {
          setArticleStates((prev) => ({
            ...prev,
            [article.url]: { buttonState: 'idle', questionId: null },
          }));
        }, 3000);
      }
    }
  };

  /**
   * Open review modal for a generated question
   */
  const handleOpenReview = (article: DiscoveredArticle, questionId: string | null) => {
    if (!questionId) return;
    setReviewingArticle(article);
    setReviewingQuestionId(questionId);
    setReviewModalOpen(true);
  };

  /**
   * Handle question approval - update button to approved state
   */
  const handleReviewApproved = () => {
    if (reviewingArticle) {
      setArticleStates((prev) => ({
        ...prev,
        [reviewingArticle.url]: { buttonState: 'approved', questionId: null },
      }));
    }
    setReviewModalOpen(false);
    setReviewingArticle(null);
    setReviewingQuestionId(null);
  };

  /**
   * Handle question rejection - revert to idle state to allow regeneration
   */
  const handleReviewRejected = () => {
    if (reviewingArticle) {
      setArticleStates((prev) => ({
        ...prev,
        [reviewingArticle.url]: { buttonState: 'idle', questionId: null },
      }));
    }
    setReviewModalOpen(false);
    setReviewingArticle(null);
    setReviewingQuestionId(null);
  };

  const handleRetry = async () => {
    if (!historyItem) return;
    setIsRetrying(true);
    setError(null);
    try {
      await adminAPI.triggerAnalysis(historyItem.id);
      await fetchResults();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error.generic'));
    } finally {
      setIsRetrying(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'PPpp');
  };

  /**
   * Estimate cost based on Claude Sonnet pricing
   * ~$3/M input tokens, ~$15/M output tokens
   * Rough estimate assuming 90% input, 10% output
   */
  const estimateCost = (tokens: number) => {
    const cost = (tokens * 0.9 * 3 + tokens * 0.1 * 15) / 1000000;
    return `~$${cost.toFixed(3)}`;
  };

  /**
   * Format URL for display - shows hostname and truncated path
   */
  const formatUrl = (url: string): string => {
    try {
      const parsed = new URL(url);
      const path = parsed.pathname.slice(0, 30);
      return `${parsed.hostname}${path}${parsed.pathname.length > 30 ? '...' : ''}`;
    } catch {
      return url.slice(0, 50) + (url.length > 50 ? '...' : '');
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-h-[80vh] max-w-2xl overflow-y-auto"
          data-testid="discovered-articles-modal"
        >
          <DialogHeader>
            <DialogTitle data-testid="discovered-articles-title">
              {t('sources.articles.title')} - {sourceName}
            </DialogTitle>
            <DialogDescription>
              {historyItem && formatDate(historyItem.fetched_at)}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            {/* Loading state */}
            {isLoading && (
              <div
                className="flex flex-col items-center py-8"
                data-testid="discovered-articles-loading"
              >
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-2 text-muted-foreground">{t('common.loading')}</p>
              </div>
            )}

            {/* Pending/Analyzing state */}
            {!isLoading && data?.analysis_status === 'pending' && (
              <div
                className="flex flex-col items-center py-8"
                data-testid="discovered-articles-analyzing"
              >
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <p className="mt-2 text-muted-foreground">{t('sources.articles.analyzing')}</p>
              </div>
            )}

            {/* Error/Failed state */}
            {!isLoading && data?.analysis_status === 'failed' && (
              <Alert
                variant="destructive"
                className="flex flex-col items-center py-6"
                data-testid="discovered-articles-failed"
              >
                <AlertCircle className="h-10 w-10" />
                <AlertTitle className="mt-4">{t('sources.articles.failed')}</AlertTitle>
                <AlertDescription className="mt-2 text-center">
                  {data.analysis_error || t('common.error.generic')}
                </AlertDescription>
                <Button
                  className="mt-4"
                  onClick={handleRetry}
                  disabled={isRetrying}
                  data-testid="discovered-articles-retry-btn"
                >
                  {isRetrying ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  {t('sources.articles.retry')}
                </Button>
              </Alert>
            )}

            {/* Empty state */}
            {!isLoading &&
              data?.analysis_status === 'completed' &&
              (!data.discovered_articles || data.discovered_articles.length === 0) && (
                <Alert
                  className="flex flex-col items-center py-6"
                  data-testid="discovered-articles-empty"
                >
                  <FileText className="h-10 w-10 text-muted-foreground" />
                  <AlertTitle className="mt-4">{t('sources.articles.noArticles')}</AlertTitle>
                  <AlertDescription className="mt-2 text-center">
                    {t('sources.articles.noArticlesDesc')}
                  </AlertDescription>
                </Alert>
              )}

            {/* Success state with articles */}
            {!isLoading &&
              data?.analysis_status === 'completed' &&
              data.discovered_articles &&
              data.discovered_articles.length > 0 && (
                <div className="space-y-4" data-testid="discovered-articles-list">
                  {/* Summary */}
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>
                      {t('sources.articles.found', { count: data.discovered_articles.length })}
                    </span>
                    {data.analysis_tokens_used && (
                      <span>
                        {data.analysis_tokens_used.toLocaleString()} {t('sources.articles.tokens')}{' '}
                        ({estimateCost(data.analysis_tokens_used)})
                      </span>
                    )}
                  </div>

                  <Separator />

                  {/* Articles list */}
                  {data.discovered_articles.map((article, index) => (
                    <div
                      key={index}
                      className="rounded-lg border p-4 transition-colors hover:bg-muted/50"
                      data-testid={`discovered-article-${index}`}
                    >
                      <div className="space-y-2">
                        {/* Title */}
                        <div className="flex items-start gap-2">
                          <FileText className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                          <p className="line-clamp-2 font-medium">{article.title}</p>
                        </div>

                        {/* URL */}
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          {formatUrl(article.url)}
                          <ExternalLink className="h-3 w-3" />
                        </a>

                        {/* Reasoning */}
                        <div className="flex items-start gap-2">
                          <Badge variant="secondary" className="flex-shrink-0">
                            {t('sources.articles.reasoning')}
                          </Badge>
                          <p className="text-sm text-muted-foreground">{article.reasoning}</p>
                        </div>

                        {/* Generate/Review Question Button */}
                        <div className="mt-3 flex justify-end">
                          {(() => {
                            const state = articleStates[article.url] || {
                              buttonState: 'idle',
                              questionId: null,
                            };

                            switch (state.buttonState) {
                              case 'loading':
                                return (
                                  <Button variant="outline" size="sm" disabled>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {t('sources.articles.generating')}
                                  </Button>
                                );

                              case 'generated':
                                return (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="secondary"
                                          size="sm"
                                          onClick={() =>
                                            handleOpenReview(article, state.questionId)
                                          }
                                          data-testid={`review-question-btn-${index}`}
                                        >
                                          <Eye className="mr-2 h-4 w-4" />
                                          {t('sources.articles.reviewQuestion')}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {t('sources.articles.reviewQuestionTooltip')}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                );

                              case 'approved':
                                return (
                                  <Button variant="outline" size="sm" disabled>
                                    <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                                    {t('sources.articles.approved')}
                                  </Button>
                                );

                              case 'error':
                                return (
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleGenerateQuestion(article)}
                                    data-testid={`generate-question-btn-${index}`}
                                  >
                                    <AlertCircle className="mr-2 h-4 w-4" />
                                    {t('sources.articles.generateError')}
                                  </Button>
                                );

                              default: // idle
                                return (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleGenerateQuestion(article)}
                                          data-testid={`generate-question-btn-${index}`}
                                        >
                                          <Sparkles className="mr-2 h-4 w-4" />
                                          {t('sources.articles.generateQuestion')}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {t('sources.articles.generateTooltip')}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                );
                            }
                          })()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            {/* Error fetching results */}
            {error && !isLoading && (
              <Alert variant="destructive" data-testid="discovered-articles-error">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{t('common.error.generic')}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Question Review Modal */}
      {reviewingQuestionId && reviewingArticle && (
        <QuestionReviewModal
          open={reviewModalOpen}
          onOpenChange={setReviewModalOpen}
          questionId={reviewingQuestionId}
          articleUrl={reviewingArticle.url}
          onApproved={handleReviewApproved}
          onRejected={handleReviewRejected}
        />
      )}
    </>
  );
};
