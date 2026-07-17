import { defineConfig, loadEnv, type Plugin, type HtmlTagDescriptor } from 'vite';
import type { OutputBundle, OutputChunk } from 'rollup';
import react from '@vitejs/plugin-react';
import { imagetools } from 'vite-imagetools';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildLocaleHtml, buildSitemap } from './build/localeHtml';
import type { SeoCopy, SiteRegistry } from './build/localeHtml';

/**
 * Extract the AVIF srcset string for the hero image from the built JS chunks.
 *
 * vite-imagetools emits filenames without width encoding (all derivatives are
 * "cyprus-hero-<hash>.avif"), so we cannot reconstruct the srcset from asset
 * names alone. Instead we read the exact srcset literal that vite-imagetools
 * inlines into the JS bundle — this gives a byte-exact match with the string
 * Hero.tsx assigns to its <source srcSet> attribute, which is the AC3 requirement.
 *
 * Pattern matches: "/assets/img/cyprus-hero-<hash>.avif NNNw, ..."
 * This is distinctive enough (multiple avif entries with width descriptors)
 * that false-positive matches are not a concern.
 *
 * Throws if the bundle exists but no AVIF srcset string is found, keeping
 * LCP regressions loud.
 */
function extractHeroAvifSrcset(bundle: OutputBundle): string {
  // Regex: matches a comma-separated list of 2+ hashed AVIF URLs with width descriptors.
  // Anchored to the assets/img/ path prefix to avoid matching unrelated files.
  const AVIF_SRCSET_RE =
    /(\/assets\/img\/cyprus-hero-[A-Za-z0-9_-]+\.avif \d+w(?:, \/assets\/img\/cyprus-hero-[A-Za-z0-9_-]+\.avif \d+w)+)/;

  for (const entry of Object.values(bundle)) {
    if (entry.type !== 'chunk') continue;
    const chunk = entry as OutputChunk;
    const match = chunk.code.match(AVIF_SRCSET_RE);
    if (match) {
      const srcset = match[1];
      // Assert all expected width variants are present (Hero.tsx requests 640;960;1280;1920).
      // The base regex requires 2+; this guard catches silent partial matches caused by
      // a widths-list mismatch between Hero.tsx and the plugin expectation.
      const entryCount = (srcset.match(/\.avif \d+w/g) ?? []).length;
      if (entryCount !== 4) {
        throw new Error(
          `[perf-06 hero preload] Expected 4 AVIF srcset entries (640w/960w/1280w/1920w) ` +
            `but found ${entryCount}. Update vite.config.ts or Hero.tsx to stay in sync.`
        );
      }
      return srcset;
    }
  }

  throw new Error(
    '[perf-06 hero preload] AVIF srcset for cyprus-hero not found in any JS chunk. ' +
      'Ensure Hero.tsx imports heroAvif with ?w=...&format=avif&as=srcset.'
  );
}

/**
 * Inject a <link rel="preload as="image"> for the LCP hero image at build time.
 *
 * Uses imagesrcset/imagesizes (the responsive preload form) so the browser can
 * select the same candidate it will use for the <picture><source> — no double-fetch.
 * The imagesrcset value is extracted byte-for-byte from the built JS bundle
 * (the heroAvif import string), guaranteeing it matches the rendered <source srcSet>.
 */
const heroPreloadPlugin: Plugin = {
  name: 'hero-preload',
  transformIndexHtml: {
    order: 'post',
    handler(_html, ctx) {
      // In dev mode ctx.bundle is undefined — skip silently.
      if (!ctx.bundle) return;

      const avifSrcset = extractHeroAvifSrcset(ctx.bundle);

      const tags: HtmlTagDescriptor[] = [
        {
          tag: 'link',
          injectTo: 'head',
          attrs: {
            rel: 'preload',
            as: 'image',
            fetchpriority: 'high',
            type: 'image/avif',
            imagesrcset: avifSrcset,
            imagesizes: '100vw',
          },
        },
      ];
      return tags;
    },
  },
};

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.resolve(__dirname, relativePath), 'utf8')) as T;
}

/**
 * Emit a distinct, indexable HTML document per registered locale, plus sitemap.xml (WEDGE-13-02).
 *
 * Uses `generateBundle`, not `transformIndexHtml`, because it must emit an entirely NEW file
 * (dist/ru/index.html) rather than transform the single index.html Vite already builds.
 *
 * `enforce: 'post'` is load-bearing. transformIndexHtml is NOT an earlier stage: Vite runs it
 * INSIDE its core vite:build-html plugin's own generateBundle, and resolvePlugins places that
 * plugin before user post-plugins (generateBundle is a sequential hook). So by the time this
 * hook runs, bundle['index.html'].source already carries heroPreloadPlugin's injected LCP
 * preload link and the real hashed entry script — which is exactly why each locale document is
 * derived from the BUILT string rather than from the source index.html. Reverse the order and
 * the derived documents silently ship without the LCP preload.
 */
const localeHtmlPlugin: Plugin = {
  name: 'locale-html',
  enforce: 'post',
  generateBundle(_options, bundle) {
    const indexHtml = bundle['index.html'];
    if (!indexHtml || indexHtml.type !== 'asset') {
      throw new Error('[wedge-13 locale-html] index.html was not found in the bundle.');
    }

    const registry = readJson<SiteRegistry>('src/i18n/site-locales.json');
    const builtHtml =
      typeof indexHtml.source === 'string'
        ? indexHtml.source
        : Buffer.from(indexHtml.source).toString('utf8');

    for (const entry of registry.locales) {
      const { seo } = readJson<{ seo: SeoCopy }>(`src/i18n/locales/${entry.locale}/landing.json`);
      const html = buildLocaleHtml(builtHtml, entry.locale, registry, seo);

      const dir = entry.path.replace(/^\/+|\/+$/g, '');
      if (dir === '') {
        // Root locale: mutating the existing bundle entry's source propagates to the written
        // dist/index.html exactly once.
        indexHtml.source = html;
      } else {
        // Rollup does NOT sanitize the "/" in an emitted asset's fileName — this lands
        // verbatim at dist/<dir>/index.html.
        this.emitFile({ type: 'asset', fileName: `${dir}/index.html`, source: html });
      }
    }

    this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: buildSitemap(registry) });
  },
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), imagetools({ removeMetadata: true }), heroPreloadPlugin, localeHtmlPlugin],

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
      sourcemap: false,

      // Minification options (using esbuild for faster builds)
      minify: 'esbuild',

      // Chunk size warnings
      chunkSizeWarningLimit: 1000,

      // Rollup options for code splitting
      rollupOptions: {
        output: {
          // Manual chunks for better caching and code splitting
          manualChunks: {
            // React core - always needed.
            // react-is is pinned here (not left to land in the lazy `charts`
            // chunk) so the deferred Sentry init — which pulls react-is via
            // hoist-non-react-statics — does not drag recharts (~105KB gz) onto
            // every page via a static cross-chunk edge. See PERF / App Review.
            'react-vendor': ['react', 'react-dom', 'react-router-dom', 'react-is'],

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

            // Analytics - deferred init, split so it leaves the entry chunk
            'posthog': ['posthog-js', 'posthog-js/react'],

            // Auth client - split so it leaves the entry chunk
            'supabase': ['@supabase/supabase-js'],

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
