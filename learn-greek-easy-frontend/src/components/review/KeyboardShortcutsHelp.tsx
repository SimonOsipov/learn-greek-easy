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
      <span className="text-sm text-gray-700">{description}</span>
      <div className="flex gap-1">
        {keys.map((key) => (
          <kbd
            key={key}
            className="min-w-[2rem] rounded border border-gray-300 bg-gray-100 px-2 py-1 text-center text-xs font-semibold text-gray-800 shadow-sm"
          >
            {key}
          </kbd>
        ))}
      </div>
    </div>
  );
}

export function KeyboardShortcutsHelp({
  open,
  onOpenChange,
}: KeyboardShortcutsHelpProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Use these keyboard shortcuts to navigate and review cards quickly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Review Actions Section */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              Review Actions
            </h3>
            <div className="space-y-1 border-l-2 border-blue-500 pl-4">
              <ShortcutItem keys={['Space']} description="Flip flashcard" />
              <ShortcutItem
                keys={['1']}
                description="Rate 'Again' (show again soon)"
              />
              <ShortcutItem
                keys={['2']}
                description="Rate 'Hard' (reduced interval)"
              />
              <ShortcutItem
                keys={['3']}
                description="Rate 'Good' (standard interval)"
              />
              <ShortcutItem
                keys={['4']}
                description="Rate 'Easy' (longer interval)"
              />
            </div>
          </div>

          {/* Navigation Section */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              Navigation
            </h3>
            <div className="space-y-1 border-l-2 border-purple-500 pl-4">
              <ShortcutItem
                keys={['?']}
                description="Show/hide keyboard shortcuts"
              />
              <ShortcutItem
                keys={['Esc']}
                description="Close help or exit review"
              />
            </div>
          </div>

          {/* Footer Tip */}
          <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
            <strong>Tip:</strong> You can use your keyboard to review cards
            without touching your mouse!
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
