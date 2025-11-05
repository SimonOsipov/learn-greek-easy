/**
 * Chart Configuration for Recharts
 * Provides consistent theming, colors, and responsive settings across all charts
 */

/**
 * Chart color palette matching Tailwind/Shadcn theme
 * Uses HSL values for consistency with CSS variables
 */
export const chartColors = {
  // Semantic colors from Shadcn/ui theme
  primary: 'hsl(var(--primary))',
  secondary: 'hsl(var(--secondary))',
  accent: 'hsl(var(--accent))',
  muted: 'hsl(var(--muted))',

  // 8-color palette for multi-series charts
  chart1: '#3b82f6', // blue-500
  chart2: '#10b981', // emerald-500
  chart3: '#f59e0b', // amber-500
  chart4: '#ef4444', // red-500
  chart5: '#8b5cf6', // violet-500
  chart6: '#06b6d4', // cyan-500
  chart7: '#ec4899', // pink-500
  chart8: '#84cc16', // lime-500

  // Grayscale for text and backgrounds
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',
};

/**
 * Chart configuration object
 * Default settings for all charts
 */
export const chartConfig = {
  // Margins for chart SVG
  margin: {
    top: 20,
    right: 30,
    left: 0,
    bottom: 5,
  },

  // Responsive height settings
  responsive: {
    mobile: { height: 250 },
    tablet: { height: 300 },
    desktop: { height: 350 },
  },

  // Grid styling
  grid: {
    stroke: chartColors.gray200,
    strokeDasharray: '3 3',
  },

  // Axis styling
  axis: {
    stroke: chartColors.gray300,
    tick: {
      fill: chartColors.gray600,
      fontSize: 12,
    },
  },

  // Tooltip styling
  tooltip: {
    contentStyle: {
      backgroundColor: 'white',
      border: `1px solid ${chartColors.gray200}`,
      borderRadius: '8px',
      padding: '8px 12px',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    },
    labelStyle: {
      color: chartColors.gray900,
      fontWeight: 600,
      marginBottom: '4px',
    },
  },

  // Legend styling
  legend: {
    wrapperStyle: {
      paddingTop: '20px',
    },
    iconType: 'circle' as const,
  },
};

/**
 * Color schemes for different chart types
 */
export const colorSchemes = {
  // Two-color scheme (comparison)
  binary: [chartColors.chart1, chartColors.chart2],

  // Three-color scheme (good/neutral/bad)
  tertiary: [chartColors.chart2, chartColors.chart3, chartColors.chart4],

  // Full spectrum (8 colors for deck performance)
  spectrum: [
    chartColors.chart1,
    chartColors.chart2,
    chartColors.chart3,
    chartColors.chart4,
    chartColors.chart5,
    chartColors.chart6,
    chartColors.chart7,
    chartColors.chart8,
  ],

  // Performance colors (green to red)
  performance: [
    chartColors.chart2, // green (excellent)
    chartColors.chart3, // amber (good)
    chartColors.chart4, // red (needs work)
  ],

  // Progression colors (learning stages)
  progression: [
    chartColors.chart6, // cyan (new)
    chartColors.chart1, // blue (learning)
    chartColors.chart2, // green (mastered)
  ],
};

/**
 * Get responsive height based on viewport width
 */
export const getResponsiveHeight = (width: number): number => {
  if (width < 768) return chartConfig.responsive.mobile.height;
  if (width < 1024) return chartConfig.responsive.tablet.height;
  return chartConfig.responsive.desktop.height;
};

/**
 * Get contrast text color for background
 */
export const getContrastTextColor = (backgroundColor: string): string => {
  // Simple contrast check - can be enhanced
  return backgroundColor.includes('dark') || backgroundColor.includes('900')
    ? 'white'
    : chartColors.gray900;
};
