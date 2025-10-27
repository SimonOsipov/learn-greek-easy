function App() {
  return (
    <div className="min-h-screen bg-bg-page">
      {/* Test Container */}
      <div className="container mx-auto py-8">
        {/* Header Test */}
        <header className="bg-white border-b border-gray mb-8 px-6 py-4">
          <h1 className="text-2xl font-semibold text-text-primary">
            Learn Greek Easy
          </h1>
        </header>

        {/* Welcome Section */}
        <section className="px-6 mb-8">
          <h2 className="text-3xl font-semibold text-text-primary mb-2">
            Welcome back!
          </h2>
          <p className="text-text-muted">
            Testing Tailwind CSS configuration with custom theme
          </p>
        </section>

        {/* Color Test Grid */}
        <section className="px-6 mb-8">
          <h3 className="text-lg font-medium text-text-secondary mb-4">
            Color Palette Test
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Primary */}
            <div className="bg-primary text-white p-4 rounded-lg text-center">
              <div className="font-medium">Primary</div>
              <div className="text-sm opacity-90">#2563eb</div>
            </div>

            {/* Gradient */}
            <div className="bg-gradient-to-br from-gradient-from to-gradient-to text-white p-4 rounded-lg text-center">
              <div className="font-medium">Gradient</div>
              <div className="text-sm opacity-90">Purple</div>
            </div>

            {/* Success */}
            <div className="bg-success text-white p-4 rounded-lg text-center">
              <div className="font-medium">Success</div>
              <div className="text-sm opacity-90">#10b981</div>
            </div>

            {/* Warning */}
            <div className="bg-warning text-white p-4 rounded-lg text-center">
              <div className="font-medium">Warning</div>
              <div className="text-sm opacity-90">#f97316</div>
            </div>
          </div>
        </section>

        {/* Typography Test */}
        <section className="px-6 mb-8">
          <h3 className="text-lg font-medium text-text-secondary mb-4">
            Typography Scale
          </h3>
          <div className="space-y-2 bg-white p-6 rounded-lg border border-gray">
            <div className="text-3xl font-bold text-text-primary">Heading 3xl (32px)</div>
            <div className="text-2xl font-semibold text-text-primary">Heading 2xl (28px)</div>
            <div className="text-xl font-semibold text-text-primary">Heading xl (20px)</div>
            <div className="text-lg font-medium text-text-secondary">Heading lg (18px)</div>
            <div className="text-base text-text-secondary">Body base (16px)</div>
            <div className="text-sm text-text-muted">Small text (14px)</div>
            <div className="text-xs text-text-subtle">Extra small (12px)</div>
          </div>
        </section>

        {/* Spacing Test */}
        <section className="px-6 mb-8">
          <h3 className="text-lg font-medium text-text-secondary mb-4">
            Spacing Scale (4px Grid)
          </h3>
          <div className="bg-white p-6 rounded-lg border border-gray space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-4 h-4 bg-primary"></div>
              <span className="text-sm text-text-muted">4px (spacing-1)</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 bg-primary"></div>
              <span className="text-sm text-text-muted">32px (spacing-8)</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-primary"></div>
              <span className="text-sm text-text-muted">64px (spacing-16)</span>
            </div>
          </div>
        </section>

        {/* Button Test */}
        <section className="px-6 mb-8">
          <h3 className="text-lg font-medium text-text-secondary mb-4">
            Button Styles
          </h3>
          <div className="flex flex-wrap gap-4">
            <button className="bg-gradient-to-br from-gradient-from to-gradient-to text-white px-6 py-3 rounded-lg font-medium hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
              Primary Button
            </button>
            <button className="bg-secondary text-secondary-foreground px-6 py-3 rounded-lg font-medium hover:bg-muted transition-colors duration-200">
              Secondary Button
            </button>
            <button className="bg-white border border-gray text-text-secondary px-6 py-3 rounded-lg font-medium hover:border-primary hover:text-primary transition-colors duration-200">
              Outline Button
            </button>
          </div>
        </section>

        {/* Card Test */}
        <section className="px-6 mb-8">
          <h3 className="text-lg font-medium text-text-secondary mb-4">
            Card Component
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-lg border border-gray hover:border-primary hover:shadow-md transition-all duration-200">
              <div className="text-sm text-text-muted mb-2">Due Today</div>
              <div className="text-3xl font-bold text-primary mb-1">24</div>
              <div className="text-xs text-text-subtle">cards to review</div>
            </div>
            <div className="bg-white p-6 rounded-lg border border-gray hover:border-warning hover:shadow-md transition-all duration-200">
              <div className="text-sm text-text-muted mb-2">Current Streak</div>
              <div className="text-3xl font-bold text-warning mb-1">7</div>
              <div className="text-xs text-text-subtle">days</div>
            </div>
            <div className="bg-white p-6 rounded-lg border border-gray hover:border-success hover:shadow-md transition-all duration-200">
              <div className="text-sm text-text-muted mb-2">Mastered</div>
              <div className="text-3xl font-bold text-success mb-1">186</div>
              <div className="text-xs text-text-subtle">words</div>
            </div>
          </div>
        </section>

        {/* Responsive Test */}
        <section className="px-6 mb-8">
          <h3 className="text-lg font-medium text-text-secondary mb-4">
            Responsive Design Test
          </h3>
          <div className="bg-white p-6 rounded-lg border border-gray">
            <div className="text-sm text-text-muted mb-2">Current Breakpoint:</div>
            <div className="font-medium text-text-primary">
              <span className="sm:hidden">Mobile (&lt; 640px)</span>
              <span className="hidden sm:inline md:hidden">Small (640px - 767px)</span>
              <span className="hidden md:inline lg:hidden">Medium (768px - 1023px)</span>
              <span className="hidden lg:inline xl:hidden">Large (1024px - 1279px)</span>
              <span className="hidden xl:inline 2xl:hidden">XL (1280px - 1439px)</span>
              <span className="hidden 2xl:inline">2XL (≥ 1440px)</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default App
