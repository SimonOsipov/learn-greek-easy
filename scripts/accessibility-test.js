#!/usr/bin/env node
/**
 * Accessibility Test Script for PR Preview Environments
 *
 * This script runs axe-core accessibility tests against a deployed frontend
 * and generates JSON and markdown reports.
 *
 * Usage:
 *   FRONTEND_URL=https://example.com node scripts/accessibility-test.js
 *
 * Exit codes:
 *   0 - No critical or serious violations (passed)
 *   1 - Critical or serious violations found (failed)
 *
 * WCAG Compliance:
 *   - WCAG 2.0 Level A (wcag2a)
 *   - WCAG 2.0 Level AA (wcag2aa)
 *   - WCAG 2.1 Level A (wcag21a)
 *   - WCAG 2.1 Level AA (wcag21aa)
 */

const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('fs');
const path = require('path');

// ============================================================================
// Configuration
// ============================================================================

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Pages to test (public pages only - no authentication required)
const PAGES = [
  { name: 'Home', path: '/' },
  { name: 'Login', path: '/login' },
  { name: 'Register', path: '/register' },
];

// WCAG 2.1 AA compliance tags
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

// Rules to disable (best-practice rules that are not WCAG AA requirements)
// These match the existing accessibility.spec.ts configuration
const DISABLED_RULES = ['landmark-one-main', 'page-has-heading-one', 'region'];

// ============================================================================
// Main Function
// ============================================================================

async function runAccessibilityTests() {
  console.log('='.repeat(60));
  console.log('ACCESSIBILITY TESTS (axe-core)');
  console.log('='.repeat(60));
  console.log('');
  console.log(`Frontend URL: ${FRONTEND_URL}`);
  console.log(`WCAG Tags: ${WCAG_TAGS.join(', ')}`);
  console.log(`Disabled Rules: ${DISABLED_RULES.join(', ')}`);
  console.log(`Pages to test: ${PAGES.map((p) => p.name).join(', ')}`);
  console.log('');

  const browser = await chromium.launch();
  const results = {
    timestamp: new Date().toISOString(),
    frontend_url: FRONTEND_URL,
    wcag_tags: WCAG_TAGS,
    disabled_rules: DISABLED_RULES,
    pages: [],
    summary: {
      total_violations: 0,
      critical: 0,
      serious: 0,
      moderate: 0,
      minor: 0,
      total_passes: 0,
      total_incomplete: 0,
    },
  };

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    for (const pageConfig of PAGES) {
      const url = `${FRONTEND_URL}${pageConfig.path}`;
      console.log(`\nTesting: ${pageConfig.name} (${url})`);
      console.log('-'.repeat(50));

      try {
        // Navigate to the page
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

        // Wait for dynamic content to load
        await page.waitForTimeout(1000);

        // Run axe-core analysis
        const axeBuilder = new AxeBuilder({ page }).withTags(WCAG_TAGS);

        // Disable specific rules
        for (const rule of DISABLED_RULES) {
          axeBuilder.disableRules([rule]);
        }

        const accessibilityResults = await axeBuilder.analyze();

        // Process violations
        const pageResult = {
          name: pageConfig.name,
          path: pageConfig.path,
          url: url,
          violations: accessibilityResults.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            description: v.description,
            help: v.help,
            helpUrl: v.helpUrl,
            nodes_count: v.nodes.length,
            elements: v.nodes.slice(0, 5).map((n) => ({
              html: n.html.substring(0, 300),
              target: n.target,
              failureSummary: n.failureSummary,
            })),
          })),
          passes: accessibilityResults.passes.length,
          incomplete: accessibilityResults.incomplete.length,
        };

        results.pages.push(pageResult);

        // Update summary counts
        results.summary.total_passes += pageResult.passes;
        results.summary.total_incomplete += pageResult.incomplete;

        for (const violation of accessibilityResults.violations) {
          results.summary.total_violations++;
          if (violation.impact) {
            results.summary[violation.impact] =
              (results.summary[violation.impact] || 0) + 1;
          }
        }

        // Log results for this page
        if (accessibilityResults.violations.length > 0) {
          console.log(
            `  Found ${accessibilityResults.violations.length} violation(s):`
          );
          for (const v of accessibilityResults.violations) {
            const impactUpper = (v.impact || 'unknown').toUpperCase();
            console.log(`    - [${impactUpper}] ${v.id}: ${v.help}`);
          }
        } else {
          console.log('  No violations found!');
        }
        console.log(`  Passes: ${pageResult.passes}, Incomplete: ${pageResult.incomplete}`);
      } catch (pageError) {
        console.error(`  ERROR: Failed to test ${pageConfig.name}: ${pageError.message}`);
        results.pages.push({
          name: pageConfig.name,
          path: pageConfig.path,
          url: url,
          error: pageError.message,
          violations: [],
          passes: 0,
          incomplete: 0,
        });
      }
    }

    await context.close();
  } finally {
    await browser.close();
  }

  // Write reports
  writeJsonReport(results);
  writeMarkdownReport(results);

  // Print summary and determine exit code
  const hasBlockingViolations =
    results.summary.critical > 0 || results.summary.serious > 0;

  console.log('');
  console.log('='.repeat(60));
  console.log('ACCESSIBILITY SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total violations: ${results.summary.total_violations}`);
  console.log(`  Critical: ${results.summary.critical}`);
  console.log(`  Serious:  ${results.summary.serious}`);
  console.log(`  Moderate: ${results.summary.moderate}`);
  console.log(`  Minor:    ${results.summary.minor}`);
  console.log('');
  console.log(`Total passes: ${results.summary.total_passes}`);
  console.log(`Total incomplete: ${results.summary.total_incomplete}`);
  console.log('='.repeat(60));

  if (hasBlockingViolations) {
    console.log('');
    console.log('FAILED: Critical or serious accessibility violations found!');
    console.log(
      'These violations must be fixed before the PR can be merged.'
    );
    process.exit(1);
  } else if (results.summary.total_violations > 0) {
    console.log('');
    console.log(
      'WARNING: Moderate or minor accessibility violations found.'
    );
    console.log(
      'Consider fixing these issues, but they will not block the PR.'
    );
    process.exit(0);
  } else {
    console.log('');
    console.log('PASSED: No accessibility violations found!');
    process.exit(0);
  }
}

// ============================================================================
// Report Generation
// ============================================================================

function writeJsonReport(results) {
  const reportPath = path.join(process.cwd(), 'accessibility-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\nJSON report written to: ${reportPath}`);
}

function writeMarkdownReport(results) {
  const reportPath = path.join(process.cwd(), 'accessibility-report.md');

  let markdown = `# Accessibility Report\n\n`;
  markdown += `**Generated**: ${results.timestamp}\n`;
  markdown += `**URL**: ${results.frontend_url}\n`;
  markdown += `**WCAG Tags**: ${results.wcag_tags.join(', ')}\n\n`;

  // Summary table
  markdown += `## Summary\n\n`;
  markdown += `| Severity | Count |\n`;
  markdown += `|----------|-------|\n`;
  markdown += `| Critical | ${results.summary.critical} |\n`;
  markdown += `| Serious | ${results.summary.serious} |\n`;
  markdown += `| Moderate | ${results.summary.moderate} |\n`;
  markdown += `| Minor | ${results.summary.minor} |\n`;
  markdown += `| **Total** | **${results.summary.total_violations}** |\n\n`;

  // Blocking status
  const hasBlockingViolations =
    results.summary.critical > 0 || results.summary.serious > 0;
  if (hasBlockingViolations) {
    markdown += `> **Status**: FAILED - Critical or serious violations found\n\n`;
  } else if (results.summary.total_violations > 0) {
    markdown += `> **Status**: WARNING - Moderate or minor violations found\n\n`;
  } else {
    markdown += `> **Status**: PASSED - No violations found\n\n`;
  }

  // Per-page details
  for (const page of results.pages) {
    markdown += `## ${page.name}\n\n`;
    markdown += `**URL**: ${page.url}\n\n`;

    if (page.error) {
      markdown += `**Error**: ${page.error}\n\n`;
      continue;
    }

    if (page.violations.length === 0) {
      markdown += `No violations found.\n\n`;
      markdown += `- Passes: ${page.passes}\n`;
      markdown += `- Incomplete: ${page.incomplete}\n\n`;
    } else {
      markdown += `Found ${page.violations.length} violation(s):\n\n`;

      for (const v of page.violations) {
        const impactBadge = getImpactBadge(v.impact);
        markdown += `### ${v.id} ${impactBadge}\n\n`;
        markdown += `${v.description}\n\n`;
        markdown += `**Help**: [${v.help}](${v.helpUrl})\n\n`;
        markdown += `**Affected elements**: ${v.nodes_count}\n\n`;

        if (v.elements && v.elements.length > 0) {
          markdown += `<details>\n`;
          markdown += `<summary>Show affected elements</summary>\n\n`;
          for (const el of v.elements) {
            markdown += `\`\`\`html\n${el.html}\n\`\`\`\n`;
            if (el.failureSummary) {
              markdown += `${el.failureSummary}\n\n`;
            }
          }
          markdown += `</details>\n\n`;
        }
      }

      markdown += `- Passes: ${page.passes}\n`;
      markdown += `- Incomplete: ${page.incomplete}\n\n`;
    }
  }

  // Footer
  markdown += `---\n\n`;
  markdown += `*Generated by axe-core accessibility testing*\n`;

  fs.writeFileSync(reportPath, markdown);
  console.log(`Markdown report written to: ${reportPath}`);
}

function getImpactBadge(impact) {
  switch (impact) {
    case 'critical':
      return '`CRITICAL`';
    case 'serious':
      return '`SERIOUS`';
    case 'moderate':
      return '`MODERATE`';
    case 'minor':
      return '`MINOR`';
    default:
      return '`UNKNOWN`';
  }
}

// ============================================================================
// Run
// ============================================================================

runAccessibilityTests().catch((error) => {
  console.error('Fatal error running accessibility tests:', error);
  process.exit(1);
});
