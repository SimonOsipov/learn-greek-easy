#!/usr/bin/env node
/**
 * Visual Test Results Parser Script
 *
 * This script parses Chromatic outputs and generates a markdown comment
 * for PR reviews with visual test results and Chromatic build link.
 *
 * Usage:
 *   node scripts/parse-visual-test-results.cjs
 *
 * Environment variables:
 *   CHROMATIC_BUILD_URL - URL to Chromatic build (required)
 *   CHROMATIC_CHANGE_COUNT - Number of visual changes detected
 *   CHROMATIC_ERROR_COUNT - Number of errors in visual tests
 *   CHROMATIC_STORYBOOK_URL - URL to Storybook preview
 *   GITHUB_SERVER_URL - GitHub server URL (e.g., https://github.com)
 *   GITHUB_REPOSITORY - Repository name (e.g., owner/repo)
 *   GITHUB_RUN_ID - Workflow run ID for artifact link
 *
 * Output files:
 *   visual-test-comment.md - Markdown formatted PR comment
 *
 * Exit codes:
 *   0 - Always exits 0 (errors generate error markdown)
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// Configuration
// ============================================================================

const OUTPUT_FILE = path.join(process.cwd(), 'visual-test-comment.md');

// Chromatic outputs from environment variables
const CHROMATIC_BUILD_URL = process.env.CHROMATIC_BUILD_URL || '';
const CHROMATIC_CHANGE_COUNT = parseInt(process.env.CHROMATIC_CHANGE_COUNT || '0', 10);
const CHROMATIC_ERROR_COUNT = parseInt(process.env.CHROMATIC_ERROR_COUNT || '0', 10);
const CHROMATIC_STORYBOOK_URL = process.env.CHROMATIC_STORYBOOK_URL || '';

// Environment variables for artifact link
const GITHUB_SERVER_URL = process.env.GITHUB_SERVER_URL || 'https://github.com';
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY || '';
const GITHUB_RUN_ID = process.env.GITHUB_RUN_ID || '';

// ============================================================================
// Main Function
// ============================================================================

function main() {
  console.log('='.repeat(60));
  console.log('VISUAL TEST RESULTS PARSER');
  console.log('='.repeat(60));
  console.log('');
  console.log(`Chromatic Build URL: ${CHROMATIC_BUILD_URL || '(not provided)'}`);
  console.log(`Change Count: ${CHROMATIC_CHANGE_COUNT}`);
  console.log(`Error Count: ${CHROMATIC_ERROR_COUNT}`);
  console.log(`Storybook URL: ${CHROMATIC_STORYBOOK_URL || '(not provided)'}`);

  try {
    // Generate markdown
    const markdown = generateMarkdown();

    // Write output
    fs.writeFileSync(OUTPUT_FILE, markdown);
    console.log('');
    console.log(`Markdown comment written to: ${OUTPUT_FILE}`);
    console.log('');
    console.log('Parsing completed successfully!');
  } catch (error) {
    console.error(`Error: ${error.message}`);

    // Write error markdown (always exit 0)
    const errorMarkdown = generateErrorMarkdown(error.message);
    fs.writeFileSync(OUTPUT_FILE, errorMarkdown);
    console.log(`Error markdown written to: ${OUTPUT_FILE}`);
  }

  // Always exit 0 - let the CI job handle the comment posting
  process.exit(0);
}

// ============================================================================
// Status Functions
// ============================================================================

/**
 * Determine the overall status based on change and error counts.
 *
 * @returns {'passed'|'pending_review'|'failed'} Status
 */
function determineStatus() {
  if (CHROMATIC_ERROR_COUNT > 0) {
    return 'failed';
  }
  if (CHROMATIC_CHANGE_COUNT > 0) {
    return 'pending_review';
  }
  return 'passed';
}

/**
 * Get the status icon for display.
 *
 * @param {'passed'|'pending_review'|'failed'} status - Status string
 * @returns {string} Unicode icon
 */
function getStatusIcon(status) {
  switch (status) {
    case 'passed':
      return '\u2705'; // green check
    case 'pending_review':
      return '\uD83D\uDFE1'; // yellow circle
    case 'failed':
      return '\u274C'; // red x
    default:
      return '\u2753'; // question mark
  }
}

/**
 * Get a human-readable status message.
 *
 * @param {'passed'|'pending_review'|'failed'} status - Status string
 * @returns {string} Status message
 */
function getStatusMessage(status) {
  switch (status) {
    case 'passed':
      return 'No visual changes detected';
    case 'pending_review':
      return `${CHROMATIC_CHANGE_COUNT} visual change(s) need review`;
    case 'failed':
      return `${CHROMATIC_ERROR_COUNT} error(s) in visual tests`;
    default:
      return 'Unknown status';
  }
}

// ============================================================================
// Markdown Generation
// ============================================================================

/**
 * Generate the complete markdown comment.
 *
 * @returns {string} Markdown content
 */
function generateMarkdown() {
  const status = determineStatus();
  const statusIcon = getStatusIcon(status);
  const statusMessage = getStatusMessage(status);

  let md = `## Visual Test Report\n\n`;

  // Status header
  md += `${statusIcon} **${statusMessage}**\n\n`;

  // Summary table
  md += `### Summary\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Status | ${getStatusLabel(status)} |\n`;
  md += `| Visual Changes | ${CHROMATIC_CHANGE_COUNT} |\n`;

  if (CHROMATIC_ERROR_COUNT > 0) {
    md += `| Errors | ${CHROMATIC_ERROR_COUNT} |\n`;
  }

  md += `\n`;

  // Links section
  md += generateLinksSection();

  // Action required callout for pending reviews
  if (status === 'pending_review') {
    md += generateActionRequiredSection();
  }

  // Artifact link
  md += generateArtifactLink();

  // Footer
  md += generateFooter();

  return md;
}

/**
 * Get a formatted status label.
 *
 * @param {'passed'|'pending_review'|'failed'} status - Status string
 * @returns {string} Formatted label
 */
function getStatusLabel(status) {
  switch (status) {
    case 'passed':
      return '\u2705 Passed';
    case 'pending_review':
      return '\uD83D\uDFE1 Pending Review';
    case 'failed':
      return '\u274C Failed';
    default:
      return 'Unknown';
  }
}

/**
 * Generate the links section.
 *
 * @returns {string} Markdown content
 */
function generateLinksSection() {
  let md = `### Links\n\n`;

  if (CHROMATIC_BUILD_URL) {
    md += `- [View Chromatic Build](${CHROMATIC_BUILD_URL})\n`;
  } else {
    md += `- Chromatic Build: Not available\n`;
  }

  if (CHROMATIC_STORYBOOK_URL) {
    md += `- [View Storybook Preview](${CHROMATIC_STORYBOOK_URL})\n`;
  }

  md += `\n`;
  return md;
}

/**
 * Generate the action required section for pending reviews.
 *
 * @returns {string} Markdown content
 */
function generateActionRequiredSection() {
  let md = `> **Action Required**\n`;
  md += `>\n`;
  md += `> Visual changes have been detected. Please review the changes in Chromatic and approve or reject them.\n`;

  if (CHROMATIC_BUILD_URL) {
    md += `>\n`;
    md += `> [Review Changes in Chromatic](${CHROMATIC_BUILD_URL})\n`;
  }

  md += `\n`;
  return md;
}

/**
 * Generate the artifact link section.
 *
 * @returns {string} Markdown content
 */
function generateArtifactLink() {
  if (!GITHUB_REPOSITORY || !GITHUB_RUN_ID) {
    return '';
  }

  const artifactUrl = `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`;
  return `### Artifacts\n\n[View Visual Test Artifacts](${artifactUrl})\n\n`;
}

/**
 * Generate the footer section.
 *
 * @returns {string} Markdown content
 */
function generateFooter() {
  return `---\n*Generated by Chromatic visual testing*\n`;
}

/**
 * Generate error markdown when parsing fails.
 *
 * @param {string} errorMessage - The error message
 * @returns {string} Markdown content
 */
function generateErrorMarkdown(errorMessage) {
  let md = `## Visual Test Report\n\n`;
  md += `\u26A0\uFE0F **Visual test results are not available.**\n\n`;
  md += `**Error:** ${errorMessage}\n\n`;
  md += `Please check the workflow logs for more details.\n\n`;

  if (GITHUB_REPOSITORY && GITHUB_RUN_ID) {
    const logsUrl = `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`;
    md += `[View Workflow Logs](${logsUrl})\n\n`;
  }

  md += generateFooter();
  return md;
}

// ============================================================================
// Run
// ============================================================================

main();
