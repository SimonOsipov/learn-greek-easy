import React, { useCallback, useEffect, useState } from 'react';

import { ArrowUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SCROLL_THRESHOLD = 400;

export const ScrollToTopButton: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > SCROLL_THRESHOLD);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={scrollToTop}
      aria-label="Scroll to top"
      className={cn(
        'fixed bottom-20 right-4 z-40 h-10 w-10 rounded-full shadow-md transition-opacity duration-200 lg:bottom-6',
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      )}
    >
      <ArrowUp className="h-5 w-5" />
    </Button>
  );
};
