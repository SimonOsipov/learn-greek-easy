# News Questions - Technical Architecture

## Overview

**Feature**: Extend the News Feed feature to optionally include culture questions when creating news items.

**PRD Reference**: `/home/dev/tasks/News Questions.md`

**Architecture Pattern**: Extension of existing REST API with transactional card creation, frontend component composition.

## System Architecture

### Component Diagram

```
+-------------------+      +-------------------+      +-------------------+
|   Admin Panel     |      |   Dashboard       |      |   Review Flow     |
|  (NewsTab.tsx)    |      |  (NewsSection)    |      | (CulturePractice) |
+--------+----------+      +--------+----------+      +--------+----------+
         |                          |                          |
         | POST /admin/news         | GET /news                | (uses card data)
         | (with question)          | (with card_id)           |
         v                          v                          v
+--------+----------+      +--------+----------+      +-------------------+
|  NewsItemService  |      |  NewsItemService  |      |  CultureQuestion  |
|  (extended)       |      |  (with card join) |      |  (source link)    |
+--------+----------+      +-------------------+      +-------------------+
         |
         | Transaction
         v
+--------+----------+
|   PostgreSQL      |
| - NewsItem        |
| - CultureQuestion |
+-------------------+
```

### Data Flow

1. **Admin creates news with question**:
   - Admin submits extended JSON via POST `/api/v1/admin/news`
   - Backend validates news + question data
   - Single transaction creates NewsItem + CultureQuestion
   - CultureQuestion.source_article_url = NewsItem.original_article_url
   - Response includes both created entities

2. **Learner views dashboard**:
   - Frontend fetches GET `/api/v1/news`
   - Response includes `card_id` and `deck_id` for each news item (if exists)
   - NewsCard component conditionally renders action buttons

3. **Learner clicks Questions button**:
   - Navigate to `/culture/{deck_id}/practice`
   - Standard deck practice flow (unchanged)

4. **Learner sees source link in review**:
   - CultureQuestion.source_article_url displayed during review
   - Link opens in new tab

### Integration Points

- **Existing NewsItem model**: Extend response to include card association
- **Existing CultureQuestion model**: Add `source_article_url` field (different from existing `source_article_url` which is for AI-generated questions)
- **Existing news API endpoints**: Extend POST /admin/news, GET /news
- **Existing Dashboard NewsSection**: Add action buttons to NewsCard

## Data Model

### Schema Changes

**CultureQuestion table extension** (new field):

```sql
ALTER TABLE culture_questions
ADD COLUMN original_article_url VARCHAR(500) NULL;
```

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| original_article_url | VARCHAR(500) | NULLABLE | Link to source news article (if card originated from news). Different from `source_article_url` which is used for AI question generation deduplication. |

**Key Decision**: Store URL directly on CultureQuestion rather than creating a foreign key relationship. This ensures:
- Card remains valid if NewsItem is deleted
- Simpler querying for review flow
- No circular dependency concerns

### Entity Relationships

```
NewsItem (existing)
├── original_article_url (unique, indexed) ──────┐
│                                                 │
CultureQuestion (extended)                        │
├── original_article_url (nullable) ──────────────┘
│   (denormalized copy for card independence)
└── deck_id (FK to CultureDeck)
```

### News-to-Card Association

Rather than storing `card_id` on NewsItem (which would require migration), we'll query the association:

```sql
-- Find card for a news item
SELECT cq.id as card_id, cq.deck_id
FROM culture_questions cq
WHERE cq.original_article_url = news_items.original_article_url;
```

This approach:
- Avoids modifying NewsItem table
- Allows multiple questions from same article (if future requirement)
- Works with existing CultureQuestion model

## API Specifications

### Modified Endpoint: POST /api/v1/admin/news

**Extended Request Schema**:

```json
{
  "title_el": "string (required)",
  "title_en": "string (required)",
  "title_ru": "string (required)",
  "description_el": "string (required)",
  "description_en": "string (required)",
  "description_ru": "string (required)",
  "image_url": "string (required)",
  "publication_date": "YYYY-MM-DD (required)",
  "original_article_url": "string (required, unique)",
  "source_image_url": "string (required)",

  "question": {
    "deck_id": "uuid (required)",
    "question_el": "string (required)",
    "question_en": "string (required)",
    "options": [
      {"text_el": "string", "text_en": "string"},
      {"text_el": "string", "text_en": "string"},
      {"text_el": "string", "text_en": "string"},
      {"text_el": "string", "text_en": "string"}
    ],
    "correct_answer_index": "int 0-3 (required)"
  }
}
```

**Response Schema (with question)**:

```json
{
  "news_item": {
    "id": "uuid",
    "title_el": "...",
    "title_en": "...",
    "title_ru": "...",
    ...
  },
  "card": {
    "id": "uuid",
    "deck_id": "uuid",
    "question_text": {"el": "...", "en": "..."},
    ...
  },
  "message": "News item and question created successfully"
}
```

**Response (without question)**: Same as current

**Response (invalid deck_id)**:
```json
{
  "news_item": {...},
  "card": null,
  "message": "News item created. Question skipped: deck not found"
}
```

### Modified Endpoint: GET /api/v1/news

**Extended Response Item**:

```json
{
  "id": "uuid",
  "title_el": "...",
  ...
  "card_id": "uuid or null",
  "deck_id": "uuid or null"
}
```

Implementation: LEFT JOIN to culture_questions on original_article_url match.

### New Endpoint: GET /api/v1/news/{id}/card

**Response (if card exists)**:
```json
{
  "card_id": "uuid",
  "deck_id": "uuid"
}
```

**Response (if no card)**: 404 Not Found

This endpoint enables efficient lookup without fetching full news list.

## Implementation Approach

### Backend Code Organization

```
learn-greek-easy-backend/
├── alembic/versions/
│   └── YYYYMMDD_HHMM_add_original_article_url_to_culture_questions.py
├── src/
│   ├── schemas/
│   │   └── news_item.py  # Extend NewsItemCreate, add NewsItemWithQuestionCreate
│   ├── services/
│   │   └── news_item_service.py  # Extend create() for question handling
│   └── api/v1/
│       ├── admin.py  # Extend POST /news endpoint
│       └── news.py   # Add GET /news/{id}/card, extend list response
```

### Frontend Code Organization

```
learn-greek-easy-frontend/
├── src/
│   ├── components/dashboard/
│   │   └── NewsSection.tsx  # Add action buttons to NewsCard
│   ├── pages/culture/
│   │   └── CulturePracticePage.tsx  # Add source link display
│   ├── services/
│   │   └── adminAPI.ts  # Update types for extended API
│   └── lib/analytics/
│       └── newsAnalytics.ts  # Add new PostHog events
```

### Transaction Handling

```python
async def create_with_question(self, data: NewsItemWithQuestionCreate) -> NewsItemWithCardResponse:
    """Create news item with optional linked question in single transaction."""
    async with self.db.begin():  # Transaction starts
        # 1. Create NewsItem
        news_item = await self._create_news_item(data)

        # 2. Validate deck if question provided
        card = None
        message = "News item created successfully"

        if data.question:
            deck = await self._validate_deck(data.question.deck_id)
            if deck:
                # 3. Create CultureQuestion
                card = await self._create_culture_question(
                    deck_id=deck.id,
                    question_data=data.question,
                    original_article_url=str(data.original_article_url)
                )
                message = "News item and question created successfully"
            else:
                message = "News item created. Question skipped: deck not found"

        # Transaction commits or rolls back atomically

    return NewsItemWithCardResponse(
        news_item=news_item,
        card=card,
        message=message
    )
```

### Key Algorithms

**CultureQuestion creation from news**:
```python
def _create_culture_question(self, deck_id, question_data, original_article_url):
    """Create CultureQuestion with multilingual JSON structure."""
    return CultureQuestion(
        deck_id=deck_id,
        question_text={"el": question_data.question_el, "en": question_data.question_en},
        option_a={"el": question_data.options[0].text_el, "en": question_data.options[0].text_en},
        option_b={"el": question_data.options[1].text_el, "en": question_data.options[1].text_en},
        option_c={"el": question_data.options[2].text_el, "en": question_data.options[2].text_en},
        option_d={"el": question_data.options[3].text_el, "en": question_data.options[3].text_en},
        correct_option=question_data.correct_answer_index + 1,  # Convert 0-indexed to 1-indexed
        original_article_url=original_article_url,
        is_pending_review=False,  # Admin-created questions are auto-approved
    )
```

### Third-Party Libraries

No new dependencies required. Uses existing:
- SQLAlchemy for database operations
- Pydantic for schema validation
- React Router for navigation
- PostHog for analytics

## Security Considerations

- **Admin authentication**: POST /news requires superuser (existing)
- **Source link security**: Add `rel="noopener noreferrer"` to external links
- **Input validation**:
  - Validate deck_id is valid UUID
  - Validate exactly 4 options provided
  - Validate correct_answer_index is 0-3
  - Sanitize question text (XSS prevention via React's default escaping)

## Performance & Scalability

### Database Optimization

- **Index on original_article_url** in culture_questions table for JOIN queries
- Existing index on news_items.original_article_url

```sql
CREATE INDEX ix_culture_questions_original_article_url
ON culture_questions (original_article_url)
WHERE original_article_url IS NOT NULL;
```

### Query Optimization

News list with card association (efficient single query):
```sql
SELECT n.*, cq.id as card_id, cq.deck_id
FROM news_items n
LEFT JOIN culture_questions cq ON cq.original_article_url = n.original_article_url
ORDER BY n.publication_date DESC
LIMIT :limit OFFSET :offset;
```

### Caching Strategy

- No additional caching needed
- News list already fetched on dashboard load
- Card lookup is single-row query

## Error Handling & Resilience

### Error Scenarios

| Scenario | HTTP Code | Response |
|----------|-----------|----------|
| Invalid deck_id format | 400 | "Invalid deck_id format" |
| Deck not found | 201 | Partial success with warning |
| Fewer than 4 options | 400 | "Exactly 4 options required" |
| Duplicate options | 400 | "All options must be unique" |
| Invalid correct_answer_index | 400 | "correct_answer_index must be 0-3" |
| NewsItem creation fails | 500 | Full rollback, error message |
| Card creation fails after NewsItem | 500 | Full rollback, error message |

### Fallback Mechanisms

- If card lookup fails, dashboard shows news without buttons (graceful degradation)
- If external article link is broken, not our concern (opens in new tab)

## Testing Strategy

### Unit Tests

**Backend**:
- `test_news_item_service.py`: Test create_with_question() with valid/invalid data
- `test_news_schemas.py`: Test extended schema validation

**Frontend**:
- `NewsCard.test.tsx`: Test button visibility logic
- `CulturePracticePage.test.tsx`: Test source link rendering

### Integration Tests

- Full news creation flow with question
- News list includes card association
- Card lookup endpoint

### E2E Test Scenarios

See PRD for detailed test scenarios. Key flows:
1. Admin creates news with question
2. Admin creates news without question
3. Learner sees correct buttons on dashboard
4. Learner clicks Questions button and navigates to practice
5. Learner sees source link during review

### Seeding Endpoint

`POST /api/v1/test/seed/news-questions`

Creates:
- 2 NewsItems WITH associated CultureQuestions
- 1 NewsItem WITHOUT associated card
- Uses existing "E2E Culture Deck" or creates one

## Subtasks (Implementation Order)

1. **[NEWS-QUESTIONS-01] Backend: Add original_article_url to CultureQuestion**
   - Alembic migration
   - Update model
   - Add index

2. **[NEWS-QUESTIONS-02] Backend: Extend news creation endpoint**
   - Extended schemas
   - Transactional creation
   - Response with card info

3. **[NEWS-QUESTIONS-03] Backend: News card lookup + list enhancement**
   - GET /news/{id}/card endpoint
   - Extend GET /news with card_id/deck_id

4. **[NEWS-QUESTIONS-04] Frontend: Dashboard news card buttons**
   - NewsCard component with Audio/Questions buttons
   - Navigation to deck practice

5. **[NEWS-QUESTIONS-05] Frontend: Review flow source link**
   - Display source article link in MCQComponent
   - PostHog event tracking

6. **[NEWS-QUESTIONS-06] E2E: Seeding + test scenarios**
   - Seed endpoint for test data
   - Update e2e-seeding.md

7. **[NEWS-QUESTIONS-07] Analytics: PostHog events**
   - news_questions_button_clicked
   - news_source_link_clicked

## Branch Strategy

- **Branch**: `feature/news-questions`
- **Single draft PR** for all subtasks
- Use `skip-visual` label during development
- Remove label and mark ready on final subtask
