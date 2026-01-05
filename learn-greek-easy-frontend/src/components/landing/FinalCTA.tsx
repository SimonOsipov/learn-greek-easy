import { ArrowRight, BookOpen } from 'lucide-react';

import ctaImage from '@/assets/landing/limassol-cta.webp';
import { Button } from '@/components/ui/button';

const FinalCTA = () => {
  return (
    <section
      data-testid="final-cta-section"
      className="relative flex min-h-[500px] items-center overflow-hidden py-24 md:py-32"
    >
      {/* Background Image */}
      <img
        src={ctaImage}
        alt="Limassol cityscape with Mediterranean Sea"
        width={1920}
        height={1080}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-foreground/70" />

      <div className="container relative z-10 mx-auto px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            className="mb-6 animate-fade-up text-3xl font-bold text-background opacity-0 md:text-4xl lg:text-5xl"
            style={{ animationDelay: '0.1s' }}
          >
            Your citizenship journey starts with the right foundation
          </h2>

          <p
            className="mb-10 animate-fade-up text-lg text-background/80 opacity-0"
            style={{ animationDelay: '0.2s' }}
          >
            Stop wasting time with scattered resources. Get a structured path to Greek fluency.
          </p>

          <div
            className="flex animate-fade-up flex-col items-center justify-center gap-4 opacity-0 sm:flex-row"
            style={{ animationDelay: '0.3s' }}
          >
            <Button
              size="xl"
              className="group bg-background text-foreground shadow-lg hover:bg-background/90"
            >
              Start Free Trial
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button
              size="xl"
              variant="ghost"
              className="border border-background/20 text-background hover:bg-background/10"
            >
              <BookOpen className="h-4 w-4" />
              View Lesson Preview
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;
