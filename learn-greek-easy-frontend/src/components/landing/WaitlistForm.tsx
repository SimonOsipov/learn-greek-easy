import { useState } from 'react';

import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { APIRequestError } from '@/services/api';
import { waitlistAPI } from '@/services/waitlistAPI';

interface WaitlistFormProps {
  variant: 'hero' | 'dark';
}

const WaitlistForm = ({ variant }: WaitlistFormProps) => {
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

  const isDark = variant === 'dark';
  const inputClasses = isDark
    ? 'bg-white/10 border-white/30 text-white placeholder:text-white/60 focus:border-white'
    : '';
  const errorClasses = isDark ? 'text-red-300' : 'text-destructive';

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
          className={inputClasses}
          disabled={isSubmitting}
          data-testid="waitlist-email-input"
        />
        {error && (
          <p className={`mt-1 text-sm ${errorClasses}`} data-testid="waitlist-error">
            {error}
          </p>
        )}
      </div>
      <Button
        type="submit"
        disabled={isSubmitting}
        variant={isDark ? 'default' : 'hero'}
        size="xl"
        className={isDark ? 'bg-white text-gray-900 hover:bg-white/90' : ''}
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
