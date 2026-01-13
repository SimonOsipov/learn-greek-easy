import { useTranslation } from 'react-i18next';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShortcutItemProps {
  keys: string[];
  description: string;
}

function ShortcutItem({ keys, description }: ShortcutItemProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-foreground">{description}</span>
      <div className="flex gap-1">
        {keys.map((key) => (
          <kbd
            key={key}
            className="min-w-[2rem] rounded border border-border bg-muted px-2 py-1 text-center text-xs font-semibold text-foreground shadow-sm"
          >
            {key}
          </kbd>
        ))}
      </div>
    </div>
  );
}

export function KeyboardShortcutsHelp({ open, onOpenChange }: KeyboardShortcutsHelpProps) {
  const { t } = useTranslation('review');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('keyboard.title')}</DialogTitle>
          <DialogDescription>{t('keyboard.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Review Actions Section */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              {t('keyboard.reviewActions')}
            </h3>
            <div className="space-y-1 border-l-2 border-blue-500 pl-4">
              <ShortcutItem keys={[t('keyboard.spaceKey')]} description={t('keyboard.flipCard')} />
              <ShortcutItem keys={['1']} description={t('keyboard.rateAgain')} />
              <ShortcutItem keys={['2']} description={t('keyboard.rateHard')} />
              <ShortcutItem keys={['3']} description={t('keyboard.rateGood')} />
              <ShortcutItem keys={['4']} description={t('keyboard.rateEasy')} />
            </div>
          </div>

          {/* Navigation Section */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              {t('keyboard.navigation')}
            </h3>
            <div className="space-y-1 border-l-2 border-purple-500 pl-4">
              <ShortcutItem keys={['?']} description={t('keyboard.toggleHelp')} />
              <ShortcutItem keys={[t('keyboard.escKey')]} description={t('keyboard.closeOrExit')} />
            </div>
          </div>

          {/* Footer Tip */}
          <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
            <strong>{t('keyboard.tip')}</strong> {t('keyboard.tipMessage')}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
