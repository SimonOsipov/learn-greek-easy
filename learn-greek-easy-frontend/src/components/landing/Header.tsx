import { Button } from '@/components/ui/button';

const Header = () => {
  return (
    <header
      data-testid="header-section"
      className="fixed left-0 right-0 top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg"
    >
      <div className="flex h-16 w-full items-center justify-between px-6">
        <div className="flex items-center gap-2 text-left">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground">G</span>
          </div>
          <span className="text-lg font-semibold text-foreground">Greekly</span>
        </div>

        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="#features"
            className="text-lg text-muted-foreground transition-colors hover:text-foreground"
          >
            Features
          </a>
          <a
            href="#pricing"
            className="text-lg text-muted-foreground transition-colors hover:text-foreground"
          >
            Pricing
          </a>
          <a
            href="#about"
            className="text-lg text-muted-foreground transition-colors hover:text-foreground"
          >
            About Us
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <Button variant="ghost" className="hidden text-lg sm:inline-flex">
            Log In
          </Button>
          <Button className="text-lg">Get Started</Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
