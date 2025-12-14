/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary colors
        primary: {
          DEFAULT: '#2563eb',
          foreground: '#ffffff',
        },
        // Gradient colors
        gradient: {
          from: '#667eea',
          to: '#764ba2',
        },
        // Secondary colors
        secondary: {
          DEFAULT: '#f3f4f6',
          foreground: '#374151',
        },
        // Semantic colors
        success: '#10b981',
        warning: '#ea580c',
        info: '#3b82f6',
        danger: '#ef4444',
        // Text colors
        text: {
          primary: '#1a1a1a',
          secondary: '#374151',
          muted: '#6b7280',
          subtle: '#6b7280',
        },
        // Background colors
        bg: {
          page: '#f8f9fa',
          card: '#ffffff',
        },
        // Border colors
        border: {
          DEFAULT: '#e5e7eb',
          gray: '#e5e7eb',
        },
        // Muted colors
        muted: {
          DEFAULT: '#f3f4f6',
          foreground: '#6b7280',
        },
        // Badge colors
        badge: {
          blue: {
            bg: '#dbeafe',
            text: '#1e40af',
          },
          green: {
            bg: '#d1fae5',
            text: '#065f46',
          },
          gray: {
            bg: '#f3f4f6',
            text: '#6b7280',
          },
        },
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
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
          '"Segoe UI Symbol"',
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
      fontWeight: {
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
      },
      lineHeight: {
        tight: '1.1',
        snug: '1.3',
        normal: '1.6',
        relaxed: '1.75',
        loose: '2',
      },
      spacing: {
        '0': '0px',
        '1': '0.25rem',
        '2': '0.5rem',
        '3': '0.75rem',
        '4': '1rem',
        '5': '1.25rem',
        '6': '1.5rem',
        '7': '1.75rem',
        '8': '2rem',
        '9': '2.25rem',
        '10': '2.5rem',
        '11': '2.75rem',
        '12': '3rem',
        '14': '3.5rem',
        '16': '4rem',
        '20': '5rem',
        '24': '6rem',
        '28': '7rem',
        '32': '8rem',
        '36': '9rem',
        '40': '10rem',
        '44': '11rem',
        '48': '12rem',
        '52': '13rem',
        '56': '14rem',
        '60': '15rem',
        '64': '16rem',
        '72': '18rem',
        '80': '20rem',
        '96': '24rem',
      },
      screens: {
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1440px',
      },
      borderRadius: {
        'none': '0px',
        'sm': '4px',
        'DEFAULT': '8px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '20px',
        '3xl': '24px',
        'full': '9999px',
      },
      boxShadow: {
        'sm': '0 1px 3px rgba(0, 0, 0, 0.05)',
        'DEFAULT': '0 4px 6px rgba(0, 0, 0, 0.05)',
        'md': '0 4px 6px rgba(0, 0, 0, 0.1)',
        'lg': '0 4px 8px rgba(102, 126, 234, 0.3)',
        'xl': '0 10px 15px rgba(0, 0, 0, 0.1)',
        '2xl': '0 20px 25px rgba(0, 0, 0, 0.15)',
        'nav': '0 -2px 10px rgba(0, 0, 0, 0.05)',
        'card-hover': '0 4px 6px rgba(0, 0, 0, 0.1)',
        'button-primary': '0 4px 8px rgba(102, 126, 234, 0.3)',
        'none': 'none',
      },
      transitionDuration: {
        '200': '200ms',
        '300': '300ms',
        '500': '500ms',
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-subtle': 'pulseSubtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
      },
      container: {
        center: true,
        padding: '1rem',
        screens: {
          sm: '100%',
          md: '100%',
          lg: '100%',
          xl: '1280px',
          '2xl': '1440px',
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
