# Task 02: Core Frontend Setup

**Status**: 🚧 In Progress (25% Complete - 2/8 Subtasks)
**Created**: 2025-10-27
**Priority**: High - Critical Path
**Estimated Duration**: 3-4 hours
**Dependencies**: Task 01 (Main Page Design) ✅ Completed

---

## Overview

Initialize and configure the React project foundation with TypeScript, Vite, Tailwind CSS, and Shadcn/ui. This task establishes the complete development environment and project structure required for implementing the Greek Language Learning SaaS frontend.

---

## Objectives

1. **Initialize modern React project** with Vite for optimal development experience
2. **Configure TypeScript** with strict settings for type safety
3. **Set up Tailwind CSS** with custom theme based on Style Guide
4. **Install and configure Shadcn/ui** component library
5. **Create project file structure** following React best practices
6. **Configure linting and formatting** for code consistency
7. **Set up development scripts** for efficient workflow
8. **Create base layout components** to establish app structure
9. **Verify setup** with test component rendering

---

## Subtasks

### 02.01: Initialize React + Vite + TypeScript Project
**Status**: ✅ Completed
**Time Estimate**: 15 minutes
**Actual Time**: ~15 minutes
**Completed**: 2025-10-27

Initialize the project foundation:
- [x] Run Vite project initialization with React TypeScript template
- [x] Clean up default boilerplate files
- [x] Verify project runs successfully
- [x] Configure project metadata in package.json
- [x] Set up Git configuration (.gitignore)

**Commands**:
```bash
# Create new Vite project with React TypeScript template
npm create vite@latest frontend -- --template react-ts

# Navigate to project directory
cd frontend

# Install initial dependencies
npm install

# Test that project runs
npm run dev
```

**Success Criteria**:
- Project created with TypeScript support
- Development server runs on http://localhost:5173
- No TypeScript errors in console
- Clean project structure without boilerplate

---

### 02.02: Configure Tailwind CSS with Custom Theme
**Status**: ✅ Completed
**Time Estimate**: 30 minutes
**Actual Time**: ~40 minutes
**Completed**: 2025-10-27

Install and configure Tailwind CSS with design system from Style Guide:
- [x] Install Tailwind CSS and its peer dependencies (v3.4.18)
- [x] Initialize Tailwind configuration
- [x] Configure content paths for purging
- [x] Set up custom color palette from Style Guide (15 color groups)
- [x] Configure typography scale and spacing (4px grid system)
- [x] Add custom utility classes (gradients, animations, components)
- [x] Update main CSS file with Tailwind directives

**Deliverables**:
- `tailwind.config.js` with complete custom theme
- `postcss.config.js` configuration
- `src/index.css` with Tailwind directives and custom utilities
- Test component verifying all configurations

**Commands**:
```bash
# Install Tailwind CSS and dependencies
npm install -D tailwindcss postcss autoprefixer

# Initialize Tailwind config
npx tailwindcss init -p

# Install Tailwind Forms plugin (for future form styling)
npm install -D @tailwindcss/forms
```

**Configuration (tailwind.config.js)**:
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1440px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "#2563eb",
          foreground: "#ffffff",
          gradient: {
            from: "#667eea",
            to: "#764ba2"
          }
        },
        secondary: {
          DEFAULT: "#f3f4f6",
          foreground: "#374151",
        },
        destructive: {
          DEFAULT: "#ef4444",
          foreground: "#ffffff",
        },
        muted: {
          DEFAULT: "#f3f4f6",
          foreground: "#6b7280",
        },
        accent: {
          DEFAULT: "#fef3c7",
          foreground: "#92400e",
        },
        popover: {
          DEFAULT: "#ffffff",
          foreground: "#1a1a1a",
        },
        card: {
          DEFAULT: "#ffffff",
          foreground: "#1a1a1a",
        },
        // Custom semantic colors from Style Guide
        success: "#10b981",
        warning: "#f97316",
        info: "#3b82f6",
        "text-primary": "#1a1a1a",
        "text-secondary": "#374151",
        "text-muted": "#6b7280",
        "text-subtle": "#9ca3af",
        "bg-page": "#f8f9fa",
        "border-gray": "#e5e7eb",
      },
      borderRadius: {
        lg: "12px",
        md: "8px",
        sm: "4px",
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.6' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.75rem', { lineHeight: '2.25rem' }],
        '3xl': ['2rem', { lineHeight: '2.5rem' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      boxShadow: {
        'sm': '0 1px 3px rgba(0, 0, 0, 0.05)',
        'DEFAULT': '0 4px 6px rgba(0, 0, 0, 0.05)',
        'md': '0 4px 6px rgba(0, 0, 0, 0.1)',
        'lg': '0 4px 8px rgba(102, 126, 234, 0.3)',
        'nav': '0 -2px 10px rgba(0, 0, 0, 0.05)',
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/forms"),
  ],
}
```

**CSS Setup (src/index.css)**:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 0 0% 10%;
    --card: 0 0% 100%;
    --card-foreground: 0 0% 10%;
    --popover: 0 0% 100%;
    --popover-foreground: 0 0% 10%;
    --primary: 221 83% 53%;
    --primary-foreground: 0 0% 100%;
    --secondary: 210 40% 96%;
    --secondary-foreground: 215 16% 47%;
    --muted: 210 40% 96%;
    --muted-foreground: 215 16% 47%;
    --accent: 48 96% 89%;
    --accent-foreground: 36 76% 31%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;
    --border: 214 32% 91%;
    --input: 214 32% 91%;
    --ring: 221 83% 53%;
    --radius: 0.75rem;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-bg-page text-text-primary;
    font-feature-settings: "rlig" 1, "calt" 1;
  }
}

/* Custom gradient utilities */
@layer utilities {
  .bg-gradient-primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .bg-gradient-accent {
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  }
}
```

**Success Criteria**:
- Tailwind CSS installed and configured
- Custom theme matches Style Guide exactly
- CSS compiles without errors
- Utility classes work in components

---

### 02.03: Install and Configure Shadcn/ui
**Status**: ⏸️ Not Started
**Time Estimate**: 45 minutes

Set up Shadcn/ui component library:
- [ ] Initialize Shadcn/ui configuration
- [ ] Install required dependencies
- [ ] Configure component import paths
- [ ] Install initial set of components
- [ ] Verify component styling matches design
- [ ] Set up component customization patterns

**Commands**:
```bash
# Initialize Shadcn/ui (select options as shown below)
npx shadcn-ui@latest init

# When prompted, select:
# - Would you like to use TypeScript? → Yes
# - Which style would you like to use? → Default
# - Which color would you like to use as base color? → Blue
# - Where is your global CSS file? → src/index.css
# - Do you want to use CSS variables for colors? → Yes
# - Are you using a custom tailwind prefix? → No
# - Where is your tailwind.config.js located? → tailwind.config.js
# - Configure the import alias for components? → src/components
# - Configure the import alias for utils? → src/lib/utils

# Install essential components for the dashboard
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add progress
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add avatar
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add navigation-menu
npx shadcn-ui@latest add tabs
npx shadcn-ui@latest add separator
npx shadcn-ui@latest add skeleton

# Components for future features
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add toast
npx shadcn-ui@latest add form
npx shadcn-ui@latest add input
npx shadcn-ui@latest add label
```

**Component Configuration (components.json)**:
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/index.css",
    "baseColor": "blue",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

**Success Criteria**:
- Shadcn/ui initialized successfully
- All required components installed
- Components render with correct styling
- TypeScript types work correctly
- Import aliases configured

---

### 02.04: Set Up Project File Structure
**Status**: ⏸️ Not Started
**Time Estimate**: 20 minutes

Create organized folder structure for scalable development:
- [ ] Create main directory structure
- [ ] Set up component organization folders
- [ ] Create hooks and utilities directories
- [ ] Set up types and interfaces structure
- [ ] Create constants and config folders
- [ ] Add barrel exports for clean imports

**Directory Structure**:
```
src/
├── assets/              # Static assets (images, fonts)
├── components/          # All React components
│   ├── ui/             # Shadcn/ui components (auto-generated)
│   ├── layout/         # Layout components
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── Sidebar.tsx
│   │   └── MobileNav.tsx
│   ├── navigation/     # Navigation components
│   │   ├── NavItem.tsx
│   │   └── UserMenu.tsx
│   ├── display/        # Display/presentational components
│   │   ├── MetricCard.tsx
│   │   ├── DeckCard.tsx
│   │   ├── ProgressBar.tsx
│   │   └── StatsDisplay.tsx
│   └── interactive/    # Interactive components
│       ├── QuickActions.tsx
│       └── LearningTip.tsx
├── hooks/              # Custom React hooks
│   ├── useAuth.ts
│   ├── useProgress.ts
│   └── useDecks.ts
├── lib/                # Utilities and helpers
│   ├── utils.ts       # Shadcn/ui utils (auto-generated)
│   ├── api.ts         # API client
│   └── constants.ts   # App constants
├── pages/              # Page components
│   ├── Dashboard.tsx
│   ├── Login.tsx
│   └── NotFound.tsx
├── styles/             # Global styles
│   └── globals.css    # Additional global styles
├── types/              # TypeScript type definitions
│   ├── user.ts
│   ├── deck.ts
│   ├── card.ts
│   └── index.ts      # Barrel export
├── App.tsx            # Main app component
├── main.tsx          # Entry point
└── vite-env.d.ts     # Vite types
```

**Create Initial Files**:
```bash
# Create directory structure
mkdir -p src/{assets,components/{layout,navigation,display,interactive},hooks,lib,pages,styles,types}

# Create placeholder files
touch src/components/layout/{Header,Footer,Sidebar,MobileNav}.tsx
touch src/components/navigation/{NavItem,UserMenu}.tsx
touch src/components/display/{MetricCard,DeckCard,ProgressBar,StatsDisplay}.tsx
touch src/components/interactive/{QuickActions,LearningTip}.tsx
touch src/hooks/{useAuth,useProgress,useDecks}.ts
touch src/lib/{api,constants}.ts
touch src/pages/{Dashboard,Login,NotFound}.tsx
touch src/types/{user,deck,card,index}.ts
```

**Success Criteria**:
- Complete folder structure created
- All directories have appropriate purpose
- Placeholder files created for major components
- Structure supports future scaling

---

### 02.05: Configure ESLint and Prettier
**Status**: ⏸️ Not Started
**Time Estimate**: 30 minutes

Set up code quality tools:
- [ ] Install ESLint with React/TypeScript plugins
- [ ] Configure ESLint rules for the project
- [ ] Install and configure Prettier
- [ ] Set up format-on-save in VS Code settings
- [ ] Add pre-commit hooks with Husky
- [ ] Create lint and format scripts

**Commands**:
```bash
# Install ESLint and plugins
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
npm install -D eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-react-refresh

# Install Prettier and config
npm install -D prettier eslint-config-prettier eslint-plugin-prettier

# Install Husky for pre-commit hooks (optional but recommended)
npm install -D husky lint-staged
npx husky-init && npm install
```

**ESLint Configuration (.eslintrc.json)**:
```json
{
  "root": true,
  "env": {
    "browser": true,
    "es2020": true
  },
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
    "plugin:react/recommended",
    "prettier"
  ],
  "ignorePatterns": ["dist", ".eslintrc.json", "*.config.js"],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module",
    "ecmaFeatures": {
      "jsx": true
    }
  },
  "plugins": ["react-refresh", "react", "@typescript-eslint", "prettier"],
  "rules": {
    "react-refresh/only-export-components": [
      "warn",
      { "allowConstantExport": true }
    ],
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "prettier/prettier": "error"
  },
  "settings": {
    "react": {
      "version": "detect"
    }
  }
}
```

**Prettier Configuration (.prettierrc)**:
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

**Package.json Scripts**:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "lint:fix": "eslint . --ext ts,tsx --fix",
    "format": "prettier --write \"src/**/*.{ts,tsx,css,md}\"",
    "format:check": "prettier --check \"src/**/*.{ts,tsx,css,md}\"",
    "preview": "vite preview",
    "type-check": "tsc --noEmit"
  }
}
```

**Husky Pre-commit Hook (.husky/pre-commit)**:
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
```

**Lint-staged Configuration (package.json)**:
```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{css,md}": "prettier --write"
  }
}
```

**Success Criteria**:
- ESLint runs without configuration errors
- Prettier formats code consistently
- Pre-commit hooks work (if configured)
- No linting errors in existing code
- Format-on-save works in VS Code

---

### 02.06: Set Up Development Environment and Scripts
**Status**: ⏸️ Not Started
**Time Estimate**: 20 minutes

Configure development environment for optimal workflow:
- [ ] Set up environment variables structure
- [ ] Configure path aliases in TypeScript
- [ ] Update Vite configuration
- [ ] Create development helper scripts
- [ ] Set up VS Code workspace settings
- [ ] Configure debugging setup

**Environment Variables (.env.example)**:
```bash
# API Configuration
VITE_API_URL=http://localhost:8000/api
VITE_API_TIMEOUT=30000

# Authentication
VITE_GOOGLE_CLIENT_ID=your-google-client-id

# Feature Flags
VITE_ENABLE_MOCK_DATA=true
VITE_ENABLE_DEBUG_MODE=false

# App Configuration
VITE_APP_NAME="Learn Greek Easy"
VITE_APP_VERSION=0.1.0
```

**TypeScript Configuration (tsconfig.json)**:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,

    /* Path Aliases */
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/hooks/*": ["./src/hooks/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/pages/*": ["./src/pages/*"],
      "@/types/*": ["./src/types/*"],
      "@/assets/*": ["./src/assets/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

**Vite Configuration (vite.config.ts)**:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    open: true,
    cors: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'terser',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-avatar', '@radix-ui/react-dialog'],
        },
      },
    },
  },
});
```

**VS Code Settings (.vscode/settings.json)**:
```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.git": true
  },
  "emmet.includeLanguages": {
    "javascript": "javascriptreact",
    "typescript": "typescriptreact"
  },
  "tailwindCSS.experimental.classRegex": [
    ["cn\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ]
}
```

**Success Criteria**:
- Environment variables loaded correctly
- Path aliases work in imports
- Vite dev server runs with proxy
- VS Code settings applied
- Development workflow is smooth

---

### 02.07: Create Base Layout Components
**Status**: ⏸️ Not Started
**Time Estimate**: 45 minutes

Implement foundational layout components:
- [ ] Create main App layout wrapper
- [ ] Implement Header component with navigation
- [ ] Build responsive Sidebar for desktop
- [ ] Create MobileNav for bottom navigation
- [ ] Implement layout context for state management
- [ ] Add responsive breakpoint logic

**App Layout Component (src/components/layout/AppLayout.tsx)**:
```typescript
import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';

export const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-bg-page">
      {/* Desktop Header */}
      <Header className="hidden lg:block" />

      <div className="flex">
        {/* Desktop Sidebar - Optional based on design */}
        <Sidebar className="hidden lg:block" />

        {/* Main Content Area */}
        <main className="flex-1 pb-20 lg:pb-0">
          <div className="container mx-auto max-w-[1440px] px-4 py-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav className="lg:hidden" />
    </div>
  );
};
```

**Header Component (src/components/layout/Header.tsx)**:
```typescript
import React from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface HeaderProps {
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({ className = '' }) => {
  return (
    <header className={`sticky top-0 z-50 w-full border-b border-border-gray bg-white ${className}`}>
      <div className="container mx-auto max-w-[1440px] flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-semibold">
            Learn Greek Easy
          </h1>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-6">
          <a href="/" className="text-text-secondary hover:text-primary transition-colors">
            Dashboard
          </a>
          <a href="/decks" className="text-text-secondary hover:text-primary transition-colors">
            Decks
          </a>
          <a href="/statistics" className="text-text-secondary hover:text-primary transition-colors">
            Statistics
          </a>
        </nav>

        {/* User Menu */}
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" className="relative">
            <span className="text-xl">🔔</span>
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-warning"></span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-gradient-primary text-white">
                    JD
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">John Doe</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    john.doe@example.com
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Settings</DropdownMenuItem>
              <DropdownMenuItem>Help & Support</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};
```

**Mobile Navigation Component (src/components/layout/MobileNav.tsx)**:
```typescript
import React from 'react';
import { useLocation, Link } from 'react-router-dom';

interface MobileNavProps {
  className?: string;
}

const navItems = [
  { path: '/', label: 'Home', icon: '🏠' },
  { path: '/review', label: 'Review', icon: '📚' },
  { path: '/decks', label: 'Decks', icon: '📂' },
  { path: '/stats', label: 'Stats', icon: '📊' },
  { path: '/profile', label: 'Profile', icon: '👤' },
];

export const MobileNav: React.FC<MobileNavProps> = ({ className = '' }) => {
  const location = useLocation();

  return (
    <nav className={`fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border-gray ${className}`}>
      <div className="flex justify-around items-center py-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center p-2 transition-colors ${
                isActive ? 'text-primary' : 'text-text-muted'
              }`}
            >
              <span className="text-2xl mb-1">{item.icon}</span>
              <span className="text-xs">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
```

**Success Criteria**:
- Layout components render correctly
- Responsive behavior works (desktop/mobile)
- Navigation highlights active page
- User menu dropdown functions
- Clean component structure

---

### 02.08: Verify Setup with Test Component
**Status**: ⏸️ Not Started
**Time Estimate**: 30 minutes

Create test dashboard to verify all configurations:
- [ ] Create sample Dashboard page component
- [ ] Implement test metric cards
- [ ] Add sample deck card
- [ ] Test Tailwind classes and custom theme
- [ ] Verify Shadcn/ui components render
- [ ] Test responsive layout
- [ ] Ensure TypeScript types work

**Test Dashboard Component (src/pages/Dashboard.tsx)**:
```typescript
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

export const Dashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-text-primary">
            Welcome back, John!
          </h1>
          <p className="text-text-muted mt-1">
            You have 24 cards to review today. Keep up the great work!
          </p>
        </div>
        <Button className="mt-4 md:mt-0 bg-gradient-primary hover:opacity-90 transition-opacity">
          Start Review Session
        </Button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader className="pb-2">
            <CardDescription className="text-text-muted">Due Today</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">24</div>
            <p className="text-xs text-text-subtle">cards to review</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader className="pb-2">
            <CardDescription className="text-text-muted">Streak</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">7</div>
            <p className="text-xs text-text-subtle">days</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader className="pb-2">
            <CardDescription className="text-text-muted">Mastered</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">186</div>
            <p className="text-xs text-text-subtle">words</p>
          </CardContent>
        </Card>
      </div>

      {/* Deck Card Example */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="hover:border-primary transition-colors">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>A1 Essential Words</CardTitle>
                <CardDescription>Basic vocabulary for everyday communication</CardDescription>
              </div>
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                In Progress
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-text-muted">68 of 100 words</span>
                <span className="font-medium">68%</span>
              </div>
              <Progress value={68} className="h-2" />
            </div>

            <div className="flex gap-4 text-sm text-text-muted">
              <span>📚 12 cards due</span>
              <span>✅ 68 mastered</span>
              <span>📝 32 learning</span>
            </div>

            <Button variant="outline" className="w-full">
              Continue Learning
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Test Typography */}
      <Card>
        <CardHeader>
          <CardTitle>Typography Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <h1 className="text-3xl font-bold">Heading 1</h1>
          <h2 className="text-2xl font-semibold">Heading 2</h2>
          <h3 className="text-xl font-medium">Heading 3</h3>
          <p className="text-base">Body text with normal weight</p>
          <p className="text-sm text-text-muted">Small muted text</p>
          <p className="text-xs text-text-subtle">Extra small subtle text</p>
        </CardContent>
      </Card>
    </div>
  );
};
```

**Main App Component (src/App.tsx)**:
```typescript
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Dashboard } from '@/pages/Dashboard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

**Verification Checklist**:
- [ ] Run `npm run dev` - app starts without errors
- [ ] Visit http://localhost:5173 - page loads
- [ ] Check desktop layout - header and content display correctly
- [ ] Resize to mobile - bottom navigation appears
- [ ] Test Tailwind classes - colors match Style Guide
- [ ] Click dropdowns - Shadcn/ui components work
- [ ] Check console - no TypeScript errors
- [ ] Run `npm run build` - production build succeeds
- [ ] Run `npm run lint` - no linting errors
- [ ] Run `npm run type-check` - TypeScript validation passes

**Success Criteria**:
- Test dashboard renders all components
- Custom theme colors display correctly
- Responsive layout works on all screen sizes
- No console errors or warnings
- All scripts run successfully

---

## Technical Requirements

### Core Dependencies
- **React**: ^18.2.0
- **TypeScript**: ^5.2.0
- **Vite**: ^5.0.0
- **Tailwind CSS**: ^3.3.0
- **Shadcn/ui**: Latest (component library)

### Development Dependencies
- **ESLint**: ^8.0.0
- **Prettier**: ^3.0.0
- **@types/react**: ^18.2.0
- **@types/react-dom**: ^18.2.0

### Future Dependencies (Phase 2)
- **React Router**: ^6.20.0 (routing)
- **Zustand**: ^4.4.0 (state management)
- **TanStack Query**: ^5.0.0 (server state)
- **Lucide React**: ^0.290.0 (icons)
- **Axios**: ^1.6.0 (API client)

### Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

---

## Design System Integration

### Color System Implementation
All colors from the Style Guide have been configured in Tailwind:
- Primary gradient for CTAs
- Semantic colors for states (success, warning, info)
- Consistent text color hierarchy
- Background and border colors

### Typography Scale
System font stack configured with proper sizes:
- Desktop headings: 2rem (h1), 1.75rem (h2), 1.125rem (h3)
- Mobile responsive adjustments
- Consistent line heights for readability

### Spacing System
4px grid system implemented:
- Consistent padding/margin using Tailwind spacing
- Component spacing matches mockup exactly
- Responsive adjustments for mobile

### Component Patterns
Shadcn/ui components customized to match design:
- Cards with proper shadows and borders
- Buttons with gradient backgrounds
- Progress bars with smooth animations
- Badges with semantic colors

---

## Installation Commands Summary

Complete setup sequence for executor reference:

```bash
# 1. Initialize Project
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install

# 2. Install Tailwind CSS
npm install -D tailwindcss postcss autoprefixer @tailwindcss/forms
npx tailwindcss init -p

# 3. Install Shadcn/ui
npm install -D tailwindcss-animate
npx shadcn-ui@latest init
# Install components (see list in task 02.03)

# 4. Install Linting Tools
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
npm install -D eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-react-refresh
npm install -D prettier eslint-config-prettier eslint-plugin-prettier

# 5. Install Router (for layout testing)
npm install react-router-dom

# 6. Optional: Install Husky
npm install -D husky lint-staged
npx husky-init && npm install

# 7. Run Development Server
npm run dev
```

---

## Success Criteria

### Project Setup ✓
- [ ] Vite + React + TypeScript project initialized
- [ ] Development server runs without errors
- [ ] Project structure follows best practices
- [ ] Git repository configured properly

### Styling System ✓
- [ ] Tailwind CSS configured with custom theme
- [ ] Colors match Style Guide exactly
- [ ] Typography scale implemented correctly
- [ ] Responsive breakpoints working

### Component Library ✓
- [ ] Shadcn/ui installed and configured
- [ ] All required components available
- [ ] Components styled to match design
- [ ] TypeScript types working

### Code Quality ✓
- [ ] ESLint configured and passing
- [ ] Prettier formatting code consistently
- [ ] TypeScript strict mode enabled
- [ ] No console errors or warnings

### Development Experience ✓
- [ ] Hot reload working smoothly
- [ ] Path aliases configured
- [ ] VS Code integration complete
- [ ] Build process optimized

### Testing ✓
- [ ] Test dashboard renders correctly
- [ ] All Tailwind utilities work
- [ ] Shadcn components functional
- [ ] Responsive layout verified
- [ ] Production build succeeds

---

## Deliverables

1. **Initialized React Project**
   - Complete frontend/ directory with all dependencies
   - Working development environment
   - Clean project structure

2. **Configured Development Environment**
   - Tailwind CSS with custom theme
   - Shadcn/ui component library
   - ESLint and Prettier setup
   - TypeScript configuration

3. **Base File Structure**
   - Organized component directories
   - Type definitions structure
   - Utility and hook patterns
   - Page component structure

4. **Configuration Files**
   - tailwind.config.js with Style Guide theme
   - tsconfig.json with strict settings
   - .eslintrc.json with project rules
   - vite.config.ts with optimizations

5. **Base Layout Components**
   - Header with navigation
   - Mobile bottom navigation
   - Layout wrapper component
   - Test dashboard page

6. **Documentation**
   - README with setup instructions
   - Component usage examples
   - Development workflow guide
   - Environment variable template

---

## Implementation Notes for Executor

### Priority Order
1. **Critical Path** (Must complete first):
   - Initialize Vite project (02.01)
   - Configure Tailwind (02.02)
   - Install Shadcn/ui (02.03)

2. **Core Setup** (Complete second):
   - Create file structure (02.04)
   - Configure ESLint/Prettier (02.05)

3. **Enhancement** (Complete third):
   - Development environment (02.06)
   - Base layout components (02.07)
   - Verification testing (02.08)

### Common Pitfalls to Avoid
1. **Don't skip Tailwind configuration** - Custom theme is critical for matching design
2. **Install Shadcn components individually** - Don't install all at once
3. **Test responsive layout early** - Mobile-first approach is essential
4. **Verify TypeScript paths** - Ensure @ alias works before proceeding
5. **Check Style Guide colors** - Every color must match exactly

### Time Management
- **Total Estimated Time**: 3-4 hours
- **Recommended Approach**: Complete in one session to maintain context
- **Break Points**: After tasks 02.03 and 02.06 if needed

### Quality Checkpoints
After each major section:
1. Run `npm run dev` - verify no errors
2. Check browser console - no warnings
3. Test a Tailwind class - ensure compilation
4. Import a component - verify paths work

### Testing Requirements
Before marking complete:
1. Desktop layout renders correctly
2. Mobile navigation appears < 1024px
3. All Shadcn components render
4. Custom colors display properly
5. Build succeeds for production

---

## Dependencies on Other Tasks

### Prerequisites
- ✅ **Task 01**: Main Page Design (COMPLETED)
  - Provides Style Guide for theme configuration
  - Defines component requirements
  - Establishes design patterns

### Enables
- **Task 03**: Authentication & User Management
- **Task 04**: Deck Management Interface
- **Task 05**: Flashcard Review System
- **All subsequent frontend tasks**

---

## References

### Documentation Links
- [Vite Documentation](https://vitejs.dev/)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Shadcn/ui Components](https://ui.shadcn.com/)
- [ESLint Rules](https://eslint.org/docs/rules/)

### Project Files
- [Style Guide](/Users/samosipov/Downloads/learn-greek-easy/.claude/01-MVP/frontend/Style-Guide.md)
- [Component Identification](/Users/samosipov/Downloads/learn-greek-easy/.claude/01-MVP/frontend/01/01.03-component-identification.md)
- [Design Decisions](/Users/samosipov/Downloads/learn-greek-easy/.claude/01-MVP/frontend/01/01.06-design-decisions.md)

---

## Notes

### Decision Log
- **Vite over Create React App**: Faster builds, better HMR, modern tooling
- **Shadcn/ui over Material-UI**: Better customization, smaller bundle, matches design
- **System fonts over custom**: Better performance, Greek character support
- **Strict TypeScript**: Catch errors early, better IDE support

### Future Considerations
- Add Storybook for component documentation (Phase 2)
- Implement CSS modules if global styles become complex
- Consider adding Playwright for E2E testing
- Evaluate need for state management library

---

**Task Created**: 2025-10-27
**Status**: 🚧 In Progress (25% Complete - 2/8 Subtasks)
**Last Updated**: 2025-10-27
**Next Steps**: Proceed with subtask 02.03 - Install and Configure Shadcn/ui

### Progress Update (2025-10-27)
- ✅ **02.01**: React + Vite + TypeScript project initialized successfully
- ✅ **02.02**: Tailwind CSS v3.4.18 configured with complete custom theme from Style Guide
- ⏳ **02.03**: Ready to install Shadcn/ui component library (NEXT)