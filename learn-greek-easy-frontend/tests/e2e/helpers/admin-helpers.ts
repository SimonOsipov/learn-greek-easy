import { Page } from '@playwright/test';

type AdminTabName =
  | 'decks'
  | 'news'
  | 'announcements'
  | 'changelog'
  | 'cardErrors'
  | 'feedback'
  | 'listeningDialogs'
  | 'situations';

const TAB_TO_GROUP: Record<AdminTabName, string> = {
  decks: 'content',
  news: 'content',
  situations: 'content',
  listeningDialogs: 'exercises',
  cardErrors: 'reviews',
  feedback: 'reviews',
  changelog: 'system',
  announcements: 'system',
};

export async function navigateToAdminTab(page: Page, tabName: AdminTabName): Promise<void> {
  const groupKey = TAB_TO_GROUP[tabName];
  await page.getByTestId(`admin-group-${groupKey}`).click();
  await page.getByTestId(`admin-tab-${tabName}`).click();
}
