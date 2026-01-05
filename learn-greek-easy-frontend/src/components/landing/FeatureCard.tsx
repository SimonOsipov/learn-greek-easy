import type { ReactNode } from 'react';

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  delay?: string;
}

const FeatureCard = ({ icon, title, description, delay = '0s' }: FeatureCardProps) => {
  return (
    <div
      data-testid="feature-card"
      className="group relative animate-fade-up rounded-2xl border border-border/50 bg-card p-8 opacity-0 shadow-landing-card transition-all duration-300 hover:shadow-landing-card-hover"
      style={{ animationDelay: delay }}
    >
      {/* Icon container */}
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-landing-greek-blue-light transition-transform duration-300 group-hover:scale-110">
        <div className="text-primary">{icon}</div>
      </div>

      {/* Content */}
      <h3 className="mb-3 text-xl font-semibold text-foreground">{title}</h3>
      <p className="leading-relaxed text-muted-foreground">{description}</p>

      {/* Hover accent line */}
      <div className="absolute bottom-0 left-8 right-8 h-0.5 bg-gradient-to-r from-primary/0 via-primary to-primary/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
    </div>
  );
};

export default FeatureCard;
