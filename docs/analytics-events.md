# Analytics Events Documentation

This document describes the PostHog analytics events implemented in the Learn Greek Easy application.

## News Analytics Events

Events related to news feed interaction and news-sourced culture questions.

| Event | Properties | Trigger |
|-------|------------|---------|
| `news_article_clicked` | `item_id`, `article_domain` | User clicks on news card to read article |
| `news_questions_button_clicked` | `news_item_id`, `deck_id` | User clicks Questions button on dashboard news card |
| `news_source_link_clicked` | `card_id`, `article_domain` | User clicks source article link during question review |

### Event Properties

#### news_article_clicked

Fired when a user clicks on a news item to read the full article.

| Property | Type | Description |
|----------|------|-------------|
| `item_id` | string | UUID of the news item |
| `article_domain` | string | Hostname of the article URL (e.g., "ekathimerini.com") |

#### news_questions_button_clicked

Fired when a user clicks the "Questions" button on a news card in the dashboard.

| Property | Type | Description |
|----------|------|-------------|
| `news_item_id` | string | UUID of the news item |
| `deck_id` | string | UUID of the associated culture deck containing the question |

#### news_source_link_clicked

Fired when a user clicks the source article link shown in the question feedback screen after answering a question.

| Property | Type | Description |
|----------|------|-------------|
| `card_id` | string | UUID of the culture question card |
| `article_domain` | string | Hostname of the source article URL (e.g., "ekathimerini.com"), or "unknown" if URL parsing fails |

## Implementation Notes

### Graceful Degradation

All analytics functions are designed to fail silently if PostHog is not available or not properly initialized. This ensures that analytics issues never break the user experience.

```typescript
// Example pattern used in all tracking functions
if (typeof posthog?.capture === 'function') {
  posthog.capture('event_name', properties);
}
```

### Domain Extraction

For events that track `article_domain`, the domain is extracted from the full URL using `new URL(url).hostname`. If URL parsing fails, the fallback value "unknown" is used.

## File Locations

- Analytics functions: `learn-greek-easy-frontend/src/lib/analytics/newsAnalytics.ts`
- Exports: `learn-greek-easy-frontend/src/lib/analytics/index.ts`
- Tests: `learn-greek-easy-frontend/src/lib/analytics/__tests__/newsAnalytics.test.ts`

## Related Components

- **NewsSection.tsx** - Triggers `news_questions_button_clicked` when Questions button is clicked
- **QuestionFeedback.tsx** - Triggers `news_source_link_clicked` when source article link is clicked
