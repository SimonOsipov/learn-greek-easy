const GreekPattern = () => {
  return (
    <div
      data-testid="greek-pattern"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* Subtle geometric pattern */}
      <svg
        className="absolute right-0 top-0 h-[600px] w-[600px] opacity-[0.03]"
        viewBox="0 0 400 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g stroke="currentColor" strokeWidth="1.5" className="text-primary">
          {/* Greek key meander pattern - modernized */}
          <path d="M50 50 L350 50 L350 100 L100 100 L100 150 L350 150" />
          <path d="M50 200 L300 200 L300 250 L50 250 L50 300 L350 300" />
          <rect x="150" y="120" width="100" height="60" rx="4" />
          <circle cx="200" cy="350" r="30" />
          <path d="M50 350 L130 350 M270 350 L350 350" />
        </g>
      </svg>

      {/* Floating geometric shapes */}
      <div
        className="absolute left-10 top-20 h-32 w-32 animate-float rounded-full bg-primary/[0.02]"
        style={{ animationDelay: '0s' }}
      />
      <div
        className="absolute bottom-40 right-20 h-24 w-24 animate-float rounded-full bg-accent/[0.03]"
        style={{ animationDelay: '2s' }}
      />
      <div
        className="absolute left-1/4 top-1/2 h-16 w-16 rotate-45 animate-float rounded-lg bg-primary/[0.02]"
        style={{ animationDelay: '4s' }}
      />
    </div>
  );
};

export default GreekPattern;
