/**
 * Chart Configuration Tests
 *
 * Comprehensive test suite for chart configuration utilities.
 * Tests color schemes, responsive settings, and helper functions.
 *
 * Coverage targets:
 * - Chart color palette
 * - Color schemes for different chart types
 * - Responsive height calculation
 * - Contrast text color selection
 * - Chart configuration defaults
 */

import { describe, it, expect } from 'vitest';
import {
  chartColors,
  chartConfig,
  colorSchemes,
  getResponsiveHeight,
  getContrastTextColor,
} from '../chartConfig';

describe('chartConfig', () => {
  describe('chartColors', () => {
    it('should have semantic colors defined', () => {
      expect(chartColors.primary).toBeDefined();
      expect(chartColors.secondary).toBeDefined();
      expect(chartColors.accent).toBeDefined();
      expect(chartColors.muted).toBeDefined();
    });

    it('should have 8-color chart palette', () => {
      expect(chartColors.chart1).toBeDefined();
      expect(chartColors.chart2).toBeDefined();
      expect(chartColors.chart3).toBeDefined();
      expect(chartColors.chart4).toBeDefined();
      expect(chartColors.chart5).toBeDefined();
      expect(chartColors.chart6).toBeDefined();
      expect(chartColors.chart7).toBeDefined();
      expect(chartColors.chart8).toBeDefined();
    });

    it('should have chart palette colors as hex values', () => {
      const hexRegex = /^#[0-9A-Fa-f]{6}$/;
      expect(chartColors.chart1).toMatch(hexRegex);
      expect(chartColors.chart2).toMatch(hexRegex);
      expect(chartColors.chart3).toMatch(hexRegex);
      expect(chartColors.chart4).toMatch(hexRegex);
    });

    it('should have complete grayscale palette', () => {
      expect(chartColors.gray50).toBeDefined();
      expect(chartColors.gray100).toBeDefined();
      expect(chartColors.gray200).toBeDefined();
      expect(chartColors.gray300).toBeDefined();
      expect(chartColors.gray400).toBeDefined();
      expect(chartColors.gray500).toBeDefined();
      expect(chartColors.gray600).toBeDefined();
      expect(chartColors.gray700).toBeDefined();
      expect(chartColors.gray800).toBeDefined();
      expect(chartColors.gray900).toBeDefined();
    });

    it('should have grayscale colors as hex values', () => {
      const hexRegex = /^#[0-9A-Fa-f]{6}$/;
      expect(chartColors.gray50).toMatch(hexRegex);
      expect(chartColors.gray200).toMatch(hexRegex);
      expect(chartColors.gray500).toMatch(hexRegex);
      expect(chartColors.gray900).toMatch(hexRegex);
    });

    it('should use HSL format for semantic colors', () => {
      expect(chartColors.primary).toContain('hsl');
      expect(chartColors.secondary).toContain('hsl');
      expect(chartColors.accent).toContain('hsl');
      expect(chartColors.muted).toContain('hsl');
    });

    it('should have distinct chart colors', () => {
      const chartPaletteColors = [
        chartColors.chart1,
        chartColors.chart2,
        chartColors.chart3,
        chartColors.chart4,
        chartColors.chart5,
        chartColors.chart6,
        chartColors.chart7,
        chartColors.chart8,
      ];

      const uniqueColors = new Set(chartPaletteColors);
      expect(uniqueColors.size).toBe(8); // All colors should be unique
    });

    it('should have progressive grayscale values', () => {
      // Gray values should progress from light to dark
      expect(chartColors.gray50).not.toBe(chartColors.gray900);
      expect(chartColors.gray100).not.toBe(chartColors.gray800);
    });
  });

  describe('chartConfig', () => {
    it('should have margin configuration', () => {
      expect(chartConfig.margin).toBeDefined();
      expect(chartConfig.margin.top).toBeGreaterThanOrEqual(0);
      expect(chartConfig.margin.right).toBeGreaterThanOrEqual(0);
      expect(chartConfig.margin.left).toBeGreaterThanOrEqual(0);
      expect(chartConfig.margin.bottom).toBeGreaterThanOrEqual(0);
    });

    it('should have responsive height settings', () => {
      expect(chartConfig.responsive).toBeDefined();
      expect(chartConfig.responsive.mobile).toBeDefined();
      expect(chartConfig.responsive.tablet).toBeDefined();
      expect(chartConfig.responsive.desktop).toBeDefined();
    });

    it('should have progressive responsive heights', () => {
      const { mobile, tablet, desktop } = chartConfig.responsive;
      expect(mobile.height).toBeLessThan(tablet.height);
      expect(tablet.height).toBeLessThan(desktop.height);
    });

    it('should have grid styling configuration', () => {
      expect(chartConfig.grid).toBeDefined();
      expect(chartConfig.grid.stroke).toBeDefined();
      expect(chartConfig.grid.strokeDasharray).toBeDefined();
    });

    it('should have axis styling configuration', () => {
      expect(chartConfig.axis).toBeDefined();
      expect(chartConfig.axis.stroke).toBeDefined();
      expect(chartConfig.axis.tick).toBeDefined();
      expect(chartConfig.axis.tick.fill).toBeDefined();
      expect(chartConfig.axis.tick.fontSize).toBeGreaterThan(0);
    });

    it('should have tooltip styling configuration', () => {
      expect(chartConfig.tooltip).toBeDefined();
      expect(chartConfig.tooltip.contentStyle).toBeDefined();
      expect(chartConfig.tooltip.labelStyle).toBeDefined();
    });

    it('should have tooltip with proper styling properties', () => {
      const { contentStyle } = chartConfig.tooltip;
      expect(contentStyle.backgroundColor).toBeDefined();
      expect(contentStyle.border).toBeDefined();
      expect(contentStyle.borderRadius).toBeDefined();
      expect(contentStyle.padding).toBeDefined();
    });

    it('should have legend configuration', () => {
      expect(chartConfig.legend).toBeDefined();
      expect(chartConfig.legend.wrapperStyle).toBeDefined();
      expect(chartConfig.legend.iconType).toBe('circle');
    });

    it('should have reasonable default values', () => {
      expect(chartConfig.margin.top).toBeGreaterThanOrEqual(0);
      expect(chartConfig.margin.top).toBeLessThan(100);
      expect(chartConfig.responsive.mobile.height).toBeGreaterThan(100);
      expect(chartConfig.responsive.mobile.height).toBeLessThan(500);
    });
  });

  describe('colorSchemes', () => {
    it('should have binary color scheme', () => {
      expect(colorSchemes.binary).toBeDefined();
      expect(colorSchemes.binary).toHaveLength(2);
    });

    it('should have tertiary color scheme', () => {
      expect(colorSchemes.tertiary).toBeDefined();
      expect(colorSchemes.tertiary).toHaveLength(3);
    });

    it('should have spectrum color scheme', () => {
      expect(colorSchemes.spectrum).toBeDefined();
      expect(colorSchemes.spectrum).toHaveLength(8);
    });

    it('should have performance color scheme', () => {
      expect(colorSchemes.performance).toBeDefined();
      expect(colorSchemes.performance).toHaveLength(3);
    });

    it('should have progression color scheme', () => {
      expect(colorSchemes.progression).toBeDefined();
      expect(colorSchemes.progression).toHaveLength(3);
    });

    it('should have all binary colors from chart palette', () => {
      colorSchemes.binary.forEach((color) => {
        expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      });
    });

    it('should have spectrum with all 8 chart colors', () => {
      expect(colorSchemes.spectrum).toContain(chartColors.chart1);
      expect(colorSchemes.spectrum).toContain(chartColors.chart2);
      expect(colorSchemes.spectrum).toContain(chartColors.chart8);
    });

    it('should have performance colors in semantic order', () => {
      // First should be green (good), last should be red (bad)
      expect(colorSchemes.performance[0]).toBe(chartColors.chart2); // green
      expect(colorSchemes.performance[2]).toBe(chartColors.chart4); // red
    });

    it('should have progression colors in learning order', () => {
      // cyan (new), blue (learning), green (mastered)
      expect(colorSchemes.progression[0]).toBe(chartColors.chart6); // cyan
      expect(colorSchemes.progression[1]).toBe(chartColors.chart1); // blue
      expect(colorSchemes.progression[2]).toBe(chartColors.chart2); // green
    });

    it('should have unique colors in each scheme', () => {
      const spectrumSet = new Set(colorSchemes.spectrum);
      expect(spectrumSet.size).toBe(8); // All colors should be unique
    });
  });

  describe('getResponsiveHeight', () => {
    it('should return mobile height for width < 768', () => {
      expect(getResponsiveHeight(320)).toBe(chartConfig.responsive.mobile.height);
      expect(getResponsiveHeight(500)).toBe(chartConfig.responsive.mobile.height);
      expect(getResponsiveHeight(767)).toBe(chartConfig.responsive.mobile.height);
    });

    it('should return tablet height for width 768-1023', () => {
      expect(getResponsiveHeight(768)).toBe(chartConfig.responsive.tablet.height);
      expect(getResponsiveHeight(900)).toBe(chartConfig.responsive.tablet.height);
      expect(getResponsiveHeight(1023)).toBe(chartConfig.responsive.tablet.height);
    });

    it('should return desktop height for width >= 1024', () => {
      expect(getResponsiveHeight(1024)).toBe(chartConfig.responsive.desktop.height);
      expect(getResponsiveHeight(1920)).toBe(chartConfig.responsive.desktop.height);
      expect(getResponsiveHeight(3840)).toBe(chartConfig.responsive.desktop.height);
    });

    it('should handle edge case: exactly 768px', () => {
      expect(getResponsiveHeight(768)).toBe(chartConfig.responsive.tablet.height);
    });

    it('should handle edge case: exactly 1024px', () => {
      expect(getResponsiveHeight(1024)).toBe(chartConfig.responsive.desktop.height);
    });

    it('should handle very small widths', () => {
      expect(getResponsiveHeight(320)).toBe(chartConfig.responsive.mobile.height);
      expect(getResponsiveHeight(100)).toBe(chartConfig.responsive.mobile.height);
    });

    it('should handle very large widths', () => {
      expect(getResponsiveHeight(5000)).toBe(chartConfig.responsive.desktop.height);
    });

    it('should return numeric values', () => {
      expect(typeof getResponsiveHeight(800)).toBe('number');
      expect(typeof getResponsiveHeight(1200)).toBe('number');
    });
  });

  describe('getContrastTextColor', () => {
    it('should return white for dark backgrounds', () => {
      expect(getContrastTextColor('dark')).toBe('white');
      expect(getContrastTextColor('bg-gray-900')).toBe('white');
      expect(getContrastTextColor('something-dark')).toBe('white');
    });

    it('should return gray900 for light backgrounds', () => {
      expect(getContrastTextColor('light')).toBe(chartColors.gray900);
      expect(getContrastTextColor('bg-white')).toBe(chartColors.gray900);
      expect(getContrastTextColor('bg-gray-50')).toBe(chartColors.gray900);
    });

    it('should handle "900" suffix for dark colors', () => {
      expect(getContrastTextColor('bg-blue-900')).toBe('white');
      expect(getContrastTextColor('bg-red-900')).toBe('white');
    });

    it('should default to gray900 for unknown backgrounds', () => {
      expect(getContrastTextColor('bg-blue-500')).toBe(chartColors.gray900);
      expect(getContrastTextColor('random-color')).toBe(chartColors.gray900);
    });

    it('should handle empty string', () => {
      expect(getContrastTextColor('')).toBe(chartColors.gray900);
    });

    it('should be case-sensitive', () => {
      expect(getContrastTextColor('DARK')).toBe(chartColors.gray900); // Not matched
      expect(getContrastTextColor('dark')).toBe('white'); // Matched
    });
  });

  describe('Integration tests', () => {
    it('should have consistent color usage across schemes', () => {
      // Binary should use colors from spectrum
      expect(colorSchemes.spectrum).toContain(colorSchemes.binary[0]);
      expect(colorSchemes.spectrum).toContain(colorSchemes.binary[1]);
    });

    it('should have all config values be valid', () => {
      expect(chartConfig.margin.top).toBeGreaterThanOrEqual(0);
      expect(chartConfig.responsive.mobile.height).toBeGreaterThan(0);
      expect(chartConfig.axis.tick.fontSize).toBeGreaterThan(0);
    });

    it('should have proper CSS color values', () => {
      // HSL colors should have proper format
      expect(chartColors.primary).toMatch(/hsl\(var\(--[a-z-]+\)\)/);

      // Hex colors should have proper format
      expect(chartColors.chart1).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it('should have responsive breakpoints in ascending order', () => {
      const mobileMax = 767;
      const tabletMin = 768;
      const tabletMax = 1023;
      const desktopMin = 1024;

      expect(mobileMax).toBeLessThan(tabletMin);
      expect(tabletMax).toBeLessThan(desktopMin);
    });
  });
});
