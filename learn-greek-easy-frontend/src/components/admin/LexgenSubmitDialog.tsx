// src/components/admin/LexgenSubmitDialog.tsx
//
// Thin "submit lemma" dialog that POSTs to POST /api/v1/admin/lexgen/proposals
// and surfaces exactly two outcomes:
//   • needs_review → success toast pointing admin to the Verification Inbox
//   • rejected     → hard never-invent rejection toast with reason
//
// Review lives in the LEXGEN-12/13 inbox — this dialog does NOT link the
// word to a deck (deck-linking happens at inbox approve, not here — Decision §4).

import { useState } from 'react';

import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { adminAPI } from '@/services/adminAPI';

export interface LexgenSubmitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: () => void;
}

export function LexgenSubmitDialog({ open, onOpenChange, onSubmitted }: LexgenSubmitDialogProps) {
  const { t } = useTranslation('admin');
  const [lemma, setLemma] = useState('');

  const trimmed = lemma.trim();
  const isValid = trimmed.length > 0;

  const mutation = useMutation({
    mutationFn: () => adminAPI.submitLexgenProposal(trimmed),
    onSuccess: (data) => {
      if (data.status === 'needs_review') {
        toast({
          title: t('lexgenSubmit.successTitle'),
          description: t('lexgenSubmit.successDescription'),
          variant: 'success',
        });
        setLemma('');
        onOpenChange(false);
        onSubmitted?.();
      } else {
        // Hard never-invent rejection — stay open so admin sees the reason
        toast({
          title: t('lexgenSubmit.rejectedTitle'),
          description: data.rejection_reason ?? t('lexgenSubmit.rejectedFallback'),
          variant: 'destructive',
        });
      }
    },
    onError: () => {
      toast({
        title: t('lexgenSubmit.errorTitle'),
        variant: 'destructive',
      });
    },
  });

  function handleOpenChange(next: boolean) {
    if (!next) {
      setLemma('');
      mutation.reset();
    }
    onOpenChange(next);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || mutation.isPending) return;
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[420px]" data-testid="lexgen-submit-dialog">
        <DialogHeader>
          <DialogTitle>{t('lexgenSubmit.title')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="lexgen-submit-lemma">{t('lexgenSubmit.lemmaLabel')}</Label>
            <Input
              id="lexgen-submit-lemma"
              data-testid="lexgen-submit-input"
              value={lemma}
              onChange={(e) => setLemma(e.target.value)}
              placeholder={t('lexgenSubmit.lemmaPlaceholder')}
              disabled={mutation.isPending}
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={mutation.isPending}
              data-testid="lexgen-submit-cancel"
            >
              {t('lexgenSubmit.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={!isValid || mutation.isPending}
              data-testid="lexgen-submit-button"
            >
              {mutation.isPending ? t('lexgenSubmit.submitting') : t('lexgenSubmit.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
