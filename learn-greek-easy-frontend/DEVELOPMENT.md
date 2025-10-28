# Learn Greek Easy - Development Guide

## Quick Start

### Prerequisites
- Node.js 20+ and npm 10+
- VS Code (recommended) with extensions
- Git

### Initial Setup
1. Clone the repository
2. Navigate to frontend: `cd learn-greek-easy-frontend`
3. Copy environment variables: `cp .env.example .env.local`
4. Install dependencies: `npm install`
5. Start development server: `npm run dev`
6. Open browser at http://localhost:5173

## Project Structure

```
src/
├── assets/          # Static assets (images, fonts)
├── components/      # React components
│   ├── ui/         # Shadcn/ui components
│   ├── layout/     # Layout components
│   ├── navigation/ # Navigation components
│   ├── display/    # Display components
│   └── interactive/# Interactive components
├── hooks/          # Custom React hooks
├── lib/            # Utilities and helpers
├── pages/          # Page components
├── types/          # TypeScript definitions
├── App.tsx         # Main app component
├── main.tsx        # Entry point
└── env.d.ts        # Environment types
```

## Available Scripts

### Development
- `npm run dev` - Start development server
- `npm run dev:host` - Start dev server accessible from network
- `npm run dev:debug` - Start with verbose debugging

### Building
- `npm run build` - Build for production
- `npm run build:analyze` - Build and analyze bundle size
- `npm run preview` - Preview production build
- `npm run preview:host` - Preview accessible from network

### Code Quality
- `npm run lint` - Check ESLint issues
- `npm run lint:fix` - Fix ESLint issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check formatting
- `npm run type-check` - Check TypeScript types
- `npm run check-all` - Run all checks
- `npm run fix-all` - Fix all auto-fixable issues

### Maintenance
- `npm run clean` - Clean build artifacts
- `npm run clean:all` - Full clean including node_modules
- `npm run reinstall` - Clean reinstall dependencies
- `npm run update-deps` - Update and check dependencies

## Environment Variables

All environment variables are prefixed with `VITE_` to be accessible in the app.

### Required Variables
- `VITE_API_URL` - Backend API URL
- `VITE_GOOGLE_CLIENT_ID` - Google OAuth client ID
- `VITE_APP_NAME` - Application name
- `VITE_APP_VERSION` - Application version
- `VITE_APP_ENV` - Environment (development/staging/production)

### Feature Flags
- `VITE_ENABLE_MOCK_DATA` - Use mock data instead of API
- `VITE_ENABLE_DEVTOOLS` - Show development tools
- `VITE_ENABLE_DEBUG_MODE` - Enable verbose logging
- `VITE_ENABLE_ANALYTICS` - Enable analytics tracking

## Debugging

### VS Code Debugging
1. Install "Debugger for Chrome" extension
2. Press F5 to start debugging
3. Set breakpoints in VS Code
4. Debug will launch Chrome with source maps

### Browser DevTools
- React Developer Tools extension recommended
- Use `console.log()` with `VITE_ENABLE_DEBUG_MODE=true`
- Network tab to monitor API calls
- Performance tab for optimization

### Common Issues
- Port 5173 already in use: Kill process or change port in .env.local
- Module not found: Check imports and run `npm install`
- TypeScript errors: Run `npm run type-check` for details
- Build fails: Check console for specific errors

## Styling Guidelines

### Tailwind CSS
- Use utility classes for styling
- Custom theme configured in tailwind.config.js
- Use `cn()` utility for conditional classes
- Responsive utilities: `sm:`, `md:`, `lg:`, `xl:`, `2xl:`

### Component Classes
```tsx
// Good - using cn() utility
<div className={cn(
  "flex items-center gap-4",
  isActive && "bg-primary text-white",
  className
)}>

// Bad - string concatenation
<div className={`flex items-center gap-4 ${isActive ? 'bg-primary' : ''}`}>
```

### Color Palette
- Primary: `#2563eb` (blue)
- Success: `#10b981` (green)
- Warning: `#f97316` (orange)
- Error: `#ef4444` (red)
- See Style Guide for complete palette

## Component Development

### Creating New Components
1. Create component file in appropriate folder
2. Export from index.ts barrel file
3. Add TypeScript interface for props
4. Use Shadcn/ui components when possible
5. Add JSDoc comments for documentation

### Component Template
```tsx
import { cn } from '@/lib/utils';

interface ComponentNameProps {
  className?: string;
  children?: React.ReactNode;
}

/**
 * ComponentName - Brief description
 * @param className - Additional CSS classes
 * @param children - Child elements
 */
export const ComponentName = ({
  className,
  children
}: ComponentNameProps) => {
  return (
    <div className={cn("default-styles", className)}>
      {children}
    </div>
  );
};
```

## Dependencies

### Core
- React 19.1.1
- TypeScript 5.9.3
- Vite 7.1.7
- Tailwind CSS 3.4.18

### UI Components
- Shadcn/ui (Radix UI based)
- class-variance-authority
- tailwindcss-animate

### Development
- ESLint 9.38.0
- Prettier 3.6.2
- prettier-plugin-tailwindcss

## Deployment

### Production Build
1. Set production environment variables
2. Run `npm run build`
3. Output will be in `dist/` folder
4. Serve with any static hosting

### Environment-Specific Builds
```bash
# Development build
npm run build -- --mode development

# Staging build
npm run build -- --mode staging

# Production build
npm run build -- --mode production
```

## Resources

### Documentation
- [React Documentation](https://react.dev)
- [TypeScript Documentation](https://www.typescriptlang.org)
- [Vite Documentation](https://vitejs.dev)
- [Tailwind CSS Documentation](https://tailwindcss.com)
- [Shadcn/ui Documentation](https://ui.shadcn.com)

### Project Specific
- [Style Guide](../.claude/01-MVP/frontend/Style-Guide.md)
- [Component Reference](../.claude/01-MVP/frontend/01/01.03-component-identification.md)
- [Design Decisions](../.claude/01-MVP/frontend/01/01.06-design-decisions.md)

## Contributing

1. Create feature branch from `main`
2. Follow code style guidelines
3. Write meaningful commit messages
4. Run `npm run check-all` before committing
5. Create pull request with description

## Troubleshooting

### Module Resolution Issues
```bash
# Clear cache and reinstall
npm run clean:all
npm install
```

### TypeScript Errors
```bash
# Check for type errors
npm run type-check

# Restart TS server in VS Code
Cmd+Shift+P -> "TypeScript: Restart TS Server"
```

### Tailwind Not Working
```bash
# Restart dev server
npm run dev

# Check Tailwind config
npx tailwindcss init -p
```

### Build Failures
```bash
# Clean and rebuild
npm run clean
npm run build

# Check for errors
npm run check-all
```

## Support

For questions or issues:
1. Check this documentation
2. Search existing issues on GitHub
3. Ask in team Slack channel
4. Create GitHub issue with details

---

Last updated: 2025-10-27
