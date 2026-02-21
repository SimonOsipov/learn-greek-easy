import React, { useEffect } from 'react';

import posthog from 'posthog-js';
import { useNavigate, useSearchParams } from 'react-router-dom';

export const CheckoutCancelPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const billingCycle = searchParams.get('billing_cycle');
    if (typeof posthog?.capture === 'function') {
      posthog.capture('checkout_abandoned', {
        ...(billingCycle && { billing_cycle: billingCycle }),
      });
    }
    navigate('/upgrade', { replace: true });
  }, [navigate, searchParams]);

  return null;
};
