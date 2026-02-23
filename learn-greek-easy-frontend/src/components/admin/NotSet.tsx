import { useTranslation } from 'react-i18next';

export function NotSet() {
  const { t } = useTranslation('admin');
  return <span className="italic text-destructive">{t('wordEntryContent.notSet')}</span>;
}
