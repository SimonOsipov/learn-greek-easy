// src/components/feedback-voting/FeedbackFilters.tsx

import React from 'react';

import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFeedbackStore } from '@/stores/feedbackStore';
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_STATUSES,
  type FeedbackCategory,
  type FeedbackStatus,
  type FeedbackSortField,
  type SortOrder,
} from '@/types/feedback';

export const FeedbackFilters: React.FC = () => {
  const { filters, setFilters, clearFilters } = useFeedbackStore();

  const hasActiveFilters = filters.category || filters.status;

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Select
        value={filters.category || 'all'}
        onValueChange={(v) =>
          setFilters({ category: v === 'all' ? null : (v as FeedbackCategory) })
        }
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          {FEEDBACK_CATEGORIES.map((cat) => (
            <SelectItem key={cat.value} value={cat.value}>
              {cat.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.status || 'all'}
        onValueChange={(v) => setFilters({ status: v === 'all' ? null : (v as FeedbackStatus) })}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          {FEEDBACK_STATUSES.map((status) => (
            <SelectItem key={status.value} value={status.value}>
              {status.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={`${filters.sort}-${filters.order}`}
        onValueChange={(v) => {
          // QA Correction: Use `order` not `sort_order`
          const [sort, order] = v.split('-') as [FeedbackSortField, SortOrder];
          setFilters({ sort, order });
        }}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="votes-desc">Most Votes</SelectItem>
          <SelectItem value="votes-asc">Least Votes</SelectItem>
          <SelectItem value="created_at-desc">Newest</SelectItem>
          <SelectItem value="created_at-asc">Oldest</SelectItem>
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="mr-2 h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  );
};
