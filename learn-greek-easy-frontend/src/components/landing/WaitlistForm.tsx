import { useState } from 'react';

import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { APIRequestError } from '@/services/api';
import { waitlistAPI } from '@/services/waitlistAPI';

const WaitlistForm = () => {
  const { t } = useTranslation('landing');
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await waitlistAPI.subscribe(email);
      navigate('/waitlist/confirm');
    } catch (err) {
      if (err instanceof APIRequestError) {
        if (err.status === 409) {
          setError(t('waitlistForm.alreadyOnWaitlist'));
        } else if (err.status === 422) {
          setError(t('waitlistForm.validationError'));
        } else {
          setError(t('waitlistForm.genericError'));
        }
      } else {
        setError(t('waitlistForm.genericError'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex w-full max-w-md flex-col gap-3 sm:flex-row sm:items-start"
    >
      <div className="flex-1">
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('waitlistForm.emailPlaceholder')}
          className="h-14 rounded-xl border-landing-header-fg/40 bg-landing-header-bg/60 text-landing-header-fg backdrop-blur-sm placeholder:text-landing-header-fg/70 focus:border-landing-header-fg"
          disabled={isSubmitting}
          data-testid="waitlist-email-input"
        />
        {error && (
          <p className="mt-1 text-sm text-red-300" data-testid="waitlist-error">
            {error}
          </p>
        )}
      </div>
      <Button
        type="submit"
        disabled={isSubmitting}
        variant="landing-primary"
        size="xl"
        className="focus-visible:ring-landing-gold"
        data-testid="waitlist-submit-button"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('waitlistForm.submitting')}
          </>
        ) : (
          t('waitlistForm.submitButton')
        )}
      </Button>
    </form>
  );
};

export default WaitlistForm;
