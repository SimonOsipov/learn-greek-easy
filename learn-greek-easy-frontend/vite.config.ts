import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],

    // Define global constants that are replaced at build time
    define: {
      // Pass commit SHA from environment or Railway's built-in variable
      'import.meta.env.VITE_COMMIT_SHA': JSON.stringify(
        process.env.RAILWAY_GIT_COMMIT_SHA ||
          process.env.GITHUB_SHA ||
          process.env.VITE_COMMIT_SHA ||
          'dev'
      ),
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

    server: {
      // Use custom port if specified in env, otherwise default to 5173
      port: parseInt(env.VITE_PORT || '5173'),

      // Allow access from network (useful for mobile testing)
      host: true,

      // Open browser automatically in development
      open: true,

      // Enable CORS for development
      cors: true,

      // Configure proxy for API calls to avoid CORS issues
      // Note: No path rewriting needed - backend expects /api/v1/* paths
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
          // DO NOT rewrite path - backend expects /api/v1/* prefix
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('proxy error', err);
            });
            proxy.on('proxyReq', (_proxyReq, req, _res) => {
              console.log('Sending Request:', req.method, req.url);
            });
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log('Received Response:', proxyRes.statusCode, req.url);
            });
          },
        },
      },

      // Improve HMR (Hot Module Replacement) for better DX
      hmr: {
        overlay: true,
      },
    },

    preview: {
      // Preview server port (for production build preview)
      port: 4173,
      host: true,
      open: true,
    },

    build: {
      // Output directory
      outDir: 'dist',

      // Generate sourcemaps for production (disable for security if needed)
      sourcemap: true,

      // Minification options (using esbuild for faster builds)
      minify: 'esbuild',

      // Chunk size warnings
      chunkSizeWarningLimit: 1000,

      // Rollup options for code splitting
      rollupOptions: {
        output: {
          // Manual chunks for better caching and code splitting
          manualChunks: {
            // React core - always needed
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],

            // UI components from Radix UI - split by usage patterns
            'ui-core': [
              '@radix-ui/react-slot',
              '@radix-ui/react-tooltip',
              '@radix-ui/react-toast',
            ],
            'ui-forms': [
              '@radix-ui/react-checkbox',
              '@radix-ui/react-label',
              '@radix-ui/react-select',
              '@radix-ui/react-slider',
            ],
            'ui-layout': [
              '@radix-ui/react-avatar',
              '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-navigation-menu',
              '@radix-ui/react-progress',
              '@radix-ui/react-scroll-area',
              '@radix-ui/react-separator',
            ],

            // Form handling - only loaded by pages with forms
            'forms': ['react-hook-form', '@hookform/resolvers', 'zod'],

            // Charts - only loaded by Statistics page
            'charts': ['recharts'],

            // i18n - always needed
            'i18n': ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],

            // Error tracking - always needed
            'sentry': ['@sentry/react'],

            // Utilities
            'utils': ['clsx', 'tailwind-merge', 'class-variance-authority'],
          },

          // Asset file names
          assetFileNames: (assetInfo) => {
            let extType = assetInfo.name?.split('.').at(1);
            if (/png|jpe?g|svg|gif|tiff|bmp|ico|webp|avif/i.test(extType || '')) {
              extType = 'img';
            }
            return `assets/${extType}/[name]-[hash][extname]`;
          },

          // Chunk file names
          chunkFileNames: 'assets/js/[name]-[hash].js',

          // Entry file names
          entryFileNames: 'assets/js/[name]-[hash].js',
        },
      },

      // Report compressed size
      reportCompressedSize: false,

      // CSS code splitting
      cssCodeSplit: true,
    },

    optimizeDeps: {
      // Pre-bundle heavy dependencies
      include: ['react', 'react-dom'],
    },
  };
});
