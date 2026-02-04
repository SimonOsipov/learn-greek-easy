/**
 * Card Error Components - Public API Exports
 *
 * Components for reporting errors on vocabulary cards and culture questions.
 *
 * @example
 * ```tsx
 * import { ReportErrorButton, ReportErrorModal } from '@/components/card-errors';
 *
 * // In your component
 * const [isOpen, setIsOpen] = useState(false);
 *
 * <ReportErrorButton onClick={() => setIsOpen(true)} />
 * <ReportErrorModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   cardId={card.id}
 *   cardType="VOCABULARY"
 * />
 * ```
 */

export { ReportErrorButton } from './ReportErrorButton';
export type { ReportErrorButtonProps } from './ReportErrorButton';

export { ReportErrorModal } from './ReportErrorModal';
export type { ReportErrorModalProps } from './ReportErrorModal';
