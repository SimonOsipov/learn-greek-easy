#!/usr/bin/env node
/**
 * Lighthouse Results Parser Script
 *
 * This script parses Lighthouse CI results from desktop and mobile runs
 * and generates summary JSON and markdown files for PR comments.
 *
 * Usage:
 *   node scripts/parse-lighthouse-results.cjs
 *
 * Expected file structure:
 *   lighthouse-reports/
 *     desktop/
 *       lhr-*.json
 *     mobile/
 *       lhr-*.json
 *
 * Environment variables:
 *   LIGHTHOUSE_REPORT_URL - URL to full Lighthouse report (optional)
 *
 * Output files:
 *   lighthouse-summary.json - Structured summary data
 *   lighthouse-comment.md - Markdown formatted PR comment
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// Configuration
// ============================================================================

const REPORT_DIR = path.join(process.cwd(), 'lighthouse-reports');
const DESKTOP_DIR = path.join(REPORT_DIR, 'desktop');
const MOBILE_DIR = path.join(REPORT_DIR, 'mobile');
const REPORT_URL = process.env.LIGHTHOUSE_REPORT_URL || '';

// Thresholds for status icons
const THRESHOLDS = {
  performance: { desktop: 80, mobile: 70 },
  accessibility: { desktop: 90, mobile: 90 },
  'best-practices': { desktop: 80, mobile: 80 },
  seo: { desktop: 80, mobile: 80 },
};

// Core Web Vitals thresholds (good/needs-improvement boundaries)
const CWV_THRESHOLDS = {
  lcp: { good: 2500, poor: 4000 }, // milliseconds
  cls: { good: 0.1, poor: 0.25 },
  tbt: { good: 200, poor: 600 }, // milliseconds
  fcp: { good: 1800, poor: 3000 }, // milliseconds
};

// ============================================================================
// Main Function
// ============================================================================

async function main() {
  console.log('='.repeat(60));
  console.log('LIGHTHOUSE RESULTS PARSER');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Check if report directories exist
    if (!fs.existsSync(REPORT_DIR)) {
      throw new Error(`Report directory not found: ${REPORT_DIR}`);
    }

    const desktopResults = parseDirectory(DESKTOP_DIR, 'desktop');
    const mobileResults = parseDirectory(MOBILE_DIR, 'mobile');

    if (desktopResults.length === 0 && mobileResults.length === 0) {
      throw new Error('No Lighthouse report files found');
    }

    // Generate summary
    const summary = generateSummary(desktopResults, mobileResults);

    // Write summary JSON
    const summaryPath = path.join(process.cwd(), 'lighthouse-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`Summary JSON written to: ${summaryPath}`);

    // Generate and write markdown comment
    const markdown = generateMarkdown(summary);
    const markdownPath = path.join(process.cwd(), 'lighthouse-comment.md');
    fs.writeFileSync(markdownPath, markdown);
    console.log(`Markdown comment written to: ${markdownPath}`);

    console.log('');
    console.log('Parsing completed successfully!');
  } catch (error) {
    console.error(`Error: ${error.message}`);

    // Write error markdown
    const errorMarkdown = generateErrorMarkdown(error.message);
    const markdownPath = path.join(process.cwd(), 'lighthouse-comment.md');
    fs.writeFileSync(markdownPath, errorMarkdown);
    console.log(`Error markdown written to: ${markdownPath}`);

    // Also write empty summary
    const summaryPath = path.join(process.cwd(), 'lighthouse-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify({ error: error.message }, null, 2));

    process.exit(1);
  }
}

// ============================================================================
// Parsing Functions
// ============================================================================

function parseDirectory(dirPath, device) {
  const results = [];

  if (!fs.existsSync(dirPath)) {
    console.log(`Warning: ${device} directory not found: ${dirPath}`);
    return results;
  }

  const files = fs.readdirSync(dirPath).filter((f) => f.startsWith('lhr-') && f.endsWith('.json'));

  console.log(`Found ${files.length} ${device} report(s)`);

  for (const file of files) {
    try {
      const filePath = path.join(dirPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lhr = JSON.parse(content);

      const result = extractResults(lhr, device);
      results.push(result);

      console.log(`  - ${result.pageName}: Performance ${result.categories.performance}%`);
    } catch (err) {
      console.error(`  - Error parsing ${file}: ${err.message}`);
    }
  }

  return results;
}

function extractResults(lhr, device) {
  // Extract page name from URL
  const url = lhr.finalUrl || lhr.requestedUrl || 'unknown';
  const pageName = getPageName(url);

  // Extract category scores (convert to percentage)
  const categories = {
    performance: Math.round((lhr.categories?.performance?.score || 0) * 100),
    accessibility: Math.round((lhr.categories?.accessibility?.score || 0) * 100),
    'best-practices': Math.round((lhr.categories?.['best-practices']?.score || 0) * 100),
    seo: Math.round((lhr.categories?.seo?.score || 0) * 100),
  };

  // Extract Core Web Vitals
  const audits = lhr.audits || {};
  const cwv = {
    lcp: audits['largest-contentful-paint']?.numericValue || null,
    cls: audits['cumulative-layout-shift']?.numericValue || null,
    tbt: audits['total-blocking-time']?.numericValue || null,
    fcp: audits['first-contentful-paint']?.numericValue || null,
  };

  // Extract failing audits (score < 0.5)
  const failingAudits = [];
  for (const [id, audit] of Object.entries(audits)) {
    if (audit.score !== null && audit.score < 0.5 && audit.scoreDisplayMode === 'numeric') {
      failingAudits.push({
        id,
        title: audit.title,
        description: audit.description?.split('.')[0] || '', // First sentence only
        score: Math.round(audit.score * 100),
        displayValue: audit.displayValue || '',
      });
    }
  }

  return {
    device,
    url,
    pageName,
    categories,
    cwv,
    failingAudits,
  };
}

function getPageName(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    if (pathname === '/' || pathname === '') {
      return 'Home';
    }

    // Capitalize first letter and remove leading slash
    const name = pathname.slice(1).split('/')[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return 'Unknown';
  }
}

// ============================================================================
// Summary Generation
// ============================================================================

function generateSummary(desktopResults, mobileResults) {
  // Calculate averages
  const desktopAvg = calculateAverages(desktopResults);
  const mobileAvg = calculateAverages(mobileResults);

  // Aggregate Core Web Vitals (use averages)
  const desktopCwv = aggregateCwv(desktopResults);
  const mobileCwv = aggregateCwv(mobileResults);

  // Collect all failing audits (deduplicated by id)
  const failingAuditsMap = new Map();
  [...desktopResults, ...mobileResults].forEach((r) => {
    r.failingAudits.forEach((a) => {
      if (!failingAuditsMap.has(a.id)) {
        failingAuditsMap.set(a.id, { ...a, devices: [r.device] });
      } else {
        const existing = failingAuditsMap.get(a.id);
        if (!existing.devices.includes(r.device)) {
          existing.devices.push(r.device);
        }
      }
    });
  });

  return {
    timestamp: new Date().toISOString(),
    reportUrl: REPORT_URL,
    desktop: {
      averages: desktopAvg,
      cwv: desktopCwv,
      pages: desktopResults.map((r) => ({
        name: r.pageName,
        url: r.url,
        categories: r.categories,
      })),
    },
    mobile: {
      averages: mobileAvg,
      cwv: mobileCwv,
      pages: mobileResults.map((r) => ({
        name: r.pageName,
        url: r.url,
        categories: r.categories,
      })),
    },
    failingAudits: Array.from(failingAuditsMap.values()),
  };
}

function calculateAverages(results) {
  if (results.length === 0) {
    return { performance: 0, accessibility: 0, 'best-practices': 0, seo: 0 };
  }

  const sum = { performance: 0, accessibility: 0, 'best-practices': 0, seo: 0 };

  for (const r of results) {
    sum.performance += r.categories.performance;
    sum.accessibility += r.categories.accessibility;
    sum['best-practices'] += r.categories['best-practices'];
    sum.seo += r.categories.seo;
  }

  return {
    performance: Math.round(sum.performance / results.length),
    accessibility: Math.round(sum.accessibility / results.length),
    'best-practices': Math.round(sum['best-practices'] / results.length),
    seo: Math.round(sum.seo / results.length),
  };
}

function aggregateCwv(results) {
  if (results.length === 0) {
    return { lcp: null, cls: null, tbt: null, fcp: null };
  }

  const values = { lcp: [], cls: [], tbt: [], fcp: [] };

  for (const r of results) {
    if (r.cwv.lcp !== null) values.lcp.push(r.cwv.lcp);
    if (r.cwv.cls !== null) values.cls.push(r.cwv.cls);
    if (r.cwv.tbt !== null) values.tbt.push(r.cwv.tbt);
    if (r.cwv.fcp !== null) values.fcp.push(r.cwv.fcp);
  }

  return {
    lcp: values.lcp.length > 0 ? Math.round(average(values.lcp)) : null,
    cls: values.cls.length > 0 ? roundToDecimals(average(values.cls), 3) : null,
    tbt: values.tbt.length > 0 ? Math.round(average(values.tbt)) : null,
    fcp: values.fcp.length > 0 ? Math.round(average(values.fcp)) : null,
  };
}

function average(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function roundToDecimals(num, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

// ============================================================================
// Markdown Generation
// ============================================================================

function generateMarkdown(summary) {
  let md = `## Lighthouse Performance Report\n\n`;

  // Core Web Vitals Table
  md += `### Core Web Vitals\n\n`;
  md += `| Metric | Desktop | Mobile | Threshold |\n`;
  md += `|--------|---------|--------|----------|\n`;
  md += generateCwvRow('LCP', summary.desktop.cwv.lcp, summary.mobile.cwv.lcp, 'lcp', 'ms');
  md += generateCwvRow('FCP', summary.desktop.cwv.fcp, summary.mobile.cwv.fcp, 'fcp', 'ms');
  md += generateCwvRow('TBT', summary.desktop.cwv.tbt, summary.mobile.cwv.tbt, 'tbt', 'ms');
  md += generateCwvRow('CLS', summary.desktop.cwv.cls, summary.mobile.cwv.cls, 'cls', '');
  md += `\n`;

  // Category Scores Table
  md += `### Category Scores\n\n`;
  md += `| Category | Desktop | Mobile |\n`;
  md += `|----------|---------|--------|\n`;
  md += generateCategoryRow('Performance', summary.desktop.averages.performance, summary.mobile.averages.performance, 'performance');
  md += generateCategoryRow('Accessibility', summary.desktop.averages.accessibility, summary.mobile.averages.accessibility, 'accessibility');
  md += generateCategoryRow('Best Practices', summary.desktop.averages['best-practices'], summary.mobile.averages['best-practices'], 'best-practices');
  md += generateCategoryRow('SEO', summary.desktop.averages.seo, summary.mobile.averages.seo, 'seo');
  md += `\n`;

  // Per-page scores (collapsible)
  if (summary.desktop.pages.length > 0 || summary.mobile.pages.length > 0) {
    md += `<details>\n`;
    md += `<summary><strong>Per-Page Scores</strong></summary>\n\n`;

    if (summary.desktop.pages.length > 0) {
      md += `#### Desktop\n\n`;
      md += `| Page | Performance | Accessibility | Best Practices | SEO |\n`;
      md += `|------|-------------|---------------|----------------|-----|\n`;
      for (const page of summary.desktop.pages) {
        md += `| ${page.name} | ${getScoreIcon(page.categories.performance, 'performance', 'desktop')} ${page.categories.performance} | ${getScoreIcon(page.categories.accessibility, 'accessibility', 'desktop')} ${page.categories.accessibility} | ${getScoreIcon(page.categories['best-practices'], 'best-practices', 'desktop')} ${page.categories['best-practices']} | ${getScoreIcon(page.categories.seo, 'seo', 'desktop')} ${page.categories.seo} |\n`;
      }
      md += `\n`;
    }

    if (summary.mobile.pages.length > 0) {
      md += `#### Mobile\n\n`;
      md += `| Page | Performance | Accessibility | Best Practices | SEO |\n`;
      md += `|------|-------------|---------------|----------------|-----|\n`;
      for (const page of summary.mobile.pages) {
        md += `| ${page.name} | ${getScoreIcon(page.categories.performance, 'performance', 'mobile')} ${page.categories.performance} | ${getScoreIcon(page.categories.accessibility, 'accessibility', 'mobile')} ${page.categories.accessibility} | ${getScoreIcon(page.categories['best-practices'], 'best-practices', 'mobile')} ${page.categories['best-practices']} | ${getScoreIcon(page.categories.seo, 'seo', 'mobile')} ${page.categories.seo} |\n`;
      }
      md += `\n`;
    }

    md += `</details>\n\n`;
  }

  // Failing audits (collapsible)
  if (summary.failingAudits.length > 0) {
    md += `<details>\n`;
    md += `<summary><strong>Failing Audits (${summary.failingAudits.length})</strong></summary>\n\n`;
    md += `| Audit | Score | Device(s) | Issue |\n`;
    md += `|-------|-------|-----------|-------|\n`;
    for (const audit of summary.failingAudits) {
      const devices = audit.devices.join(', ');
      const description = truncate(audit.description, 60);
      md += `| ${audit.title} | ${audit.score}% | ${devices} | ${description} |\n`;
    }
    md += `\n</details>\n\n`;
  }

  // Report link
  if (summary.reportUrl) {
    md += `[View Full Report](${summary.reportUrl})\n\n`;
  }

  // Footer
  md += `---\n`;
  md += `*Generated by Lighthouse CI*\n`;

  return md;
}

function generateCwvRow(label, desktopValue, mobileValue, metric, unit) {
  const threshold = CWV_THRESHOLDS[metric];
  const thresholdLabel = metric === 'cls' ? `< ${threshold.good}` : `< ${threshold.good}${unit}`;

  const desktopDisplay = formatCwvValue(desktopValue, metric, unit);
  const mobileDisplay = formatCwvValue(mobileValue, metric, unit);

  const desktopIcon = getCwvIcon(desktopValue, metric);
  const mobileIcon = getCwvIcon(mobileValue, metric);

  return `| ${label} | ${desktopIcon} ${desktopDisplay} | ${mobileIcon} ${mobileDisplay} | ${thresholdLabel} |\n`;
}

function formatCwvValue(value, metric, unit) {
  if (value === null) return 'N/A';

  if (metric === 'cls') {
    return value.toFixed(3);
  }

  // Convert to seconds if >= 1000ms
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}s`;
  }

  return `${Math.round(value)}${unit}`;
}

function getCwvIcon(value, metric) {
  if (value === null) return '';

  const threshold = CWV_THRESHOLDS[metric];

  if (value <= threshold.good) {
    return '\u2705'; // green check
  } else if (value <= threshold.poor) {
    return '\u26A0\uFE0F'; // warning
  } else {
    return '\u274C'; // red x
  }
}

function generateCategoryRow(label, desktopScore, mobileScore, category) {
  const desktopIcon = getScoreIcon(desktopScore, category, 'desktop');
  const mobileIcon = getScoreIcon(mobileScore, category, 'mobile');

  return `| ${label} | ${desktopIcon} ${desktopScore} | ${mobileIcon} ${mobileScore} |\n`;
}

function getScoreIcon(score, category, device) {
  const threshold = THRESHOLDS[category][device];

  if (score >= threshold) {
    return '\u2705'; // green check
  } else if (score >= threshold - 10) {
    return '\u26A0\uFE0F'; // warning (within 10 points of threshold)
  } else {
    return '\u274C'; // red x
  }
}

function truncate(str, maxLength) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

function generateErrorMarkdown(errorMessage) {
  return `## Lighthouse Performance Report

:warning: **Lighthouse results are not available.**

**Error:** ${errorMessage}

Please check the workflow logs for more details.

---
*Generated by Lighthouse CI*
`;
}

// ============================================================================
// Run
// ============================================================================

main();
