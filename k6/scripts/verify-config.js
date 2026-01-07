/**
 * K6 Configuration Verification Script
 *
 * This script verifies that the k6 configuration and selectors
 * are properly set up and can be loaded without errors.
 *
 * Run with: k6 run k6/scripts/verify-config.js
 */

import { config, currentEnvironment, getBaseUrl, getTestUser, getThresholds, getScenario, apiUrl, frontendUrl } from '../lib/config.js';
import { testId, auth, navigation, dashboard, decks, culture, admin, landing, apiEndpoints } from '../lib/selectors.js';

export const options = {
  vus: 1,
  iterations: 1,
};

export default function () {
  console.log('='.repeat(60));
  console.log('K6 Configuration Verification');
  console.log('='.repeat(60));

  // Environment info
  console.log('\n[Environment]');
  console.log(`  Current: ${currentEnvironment}`);

  // Base URLs
  console.log('\n[Base URLs]');
  console.log(`  API:      ${getBaseUrl('api')}`);
  console.log(`  Frontend: ${getBaseUrl('frontend')}`);

  // URL helpers
  console.log('\n[URL Helpers]');
  console.log(`  apiUrl('/api/v1/auth/login'):  ${apiUrl('/api/v1/auth/login')}`);
  console.log(`  frontendUrl('/dashboard'):     ${frontendUrl('/dashboard')}`);

  // Test users
  console.log('\n[Test Users]');
  const userRoles = ['learner', 'beginner', 'advanced', 'admin', 'xpBoundary', 'xpMid', 'xpMax'];
  userRoles.forEach((role) => {
    const user = getTestUser(role);
    console.log(`  ${role}: ${user.email}`);
  });
  console.log(`  Total test users: ${userRoles.length}`);

  // Thresholds
  console.log('\n[Thresholds]');
  const thresholds = getThresholds();
  Object.entries(thresholds).forEach(([metric, values]) => {
    console.log(`  ${metric}: ${JSON.stringify(values)}`);
  });

  // Scenarios
  console.log('\n[Scenarios]');
  ['default', 'smoke', 'load'].forEach((name) => {
    const scenario = getScenario(name);
    console.log(`  ${name}: ${scenario.vus} VUs for ${scenario.duration}`);
  });

  // Selectors verification
  console.log('\n[Selectors]');
  console.log('  Verifying selector modules...');

  // Check key selectors exist
  const selectorChecks = [
    { name: 'auth.loginCard', value: auth.loginCard },
    { name: 'auth.loginForm', value: auth.loginForm },
    { name: 'auth.emailInput', value: auth.emailInput },
    { name: 'auth.passwordInput', value: auth.passwordInput },
    { name: 'dashboard.dashboard', value: dashboard.dashboard },
    { name: 'decks.deckCard', value: decks.deckCard },
    { name: 'culture.mcq.component', value: culture.mcq.component },
    { name: 'admin.adminPage', value: admin.adminPage },
    { name: 'landing.landingPage', value: landing.landingPage },
    { name: 'landing.hero.section', value: landing.hero.section },
  ];

  let allSelectorsOk = true;
  selectorChecks.forEach(({ name, value }) => {
    if (value) {
      console.log(`    [OK] ${name} = "${value}"`);
    } else {
      console.log(`    [FAIL] ${name} is undefined`);
      allSelectorsOk = false;
    }
  });

  // Test testId helper
  const testSelector = testId('login-card');
  console.log(`\n  testId('login-card') = "${testSelector}"`);
  if (testSelector === '[data-testid="login-card"]') {
    console.log('    [OK] testId helper works correctly');
  } else {
    console.log('    [FAIL] testId helper output unexpected');
    allSelectorsOk = false;
  }

  // API endpoints verification
  console.log('\n[API Endpoints]');
  const endpointChecks = [
    { name: 'auth.login', value: apiEndpoints.auth.login },
    { name: 'auth.me', value: apiEndpoints.auth.me },
    { name: 'decks.list', value: apiEndpoints.decks.list },
    { name: 'culture.decks', value: apiEndpoints.culture.decks },
    { name: 'admin.stats', value: apiEndpoints.admin.stats },
  ];

  endpointChecks.forEach(({ name, value }) => {
    console.log(`  ${name}: ${value}`);
  });

  // Dynamic endpoint functions
  console.log('\n  Dynamic endpoints:');
  console.log(`    decks.detail(123): ${apiEndpoints.decks.detail(123)}`);
  console.log(`    culture.questions(456): ${apiEndpoints.culture.questions(456)}`);

  // Summary
  console.log('\n' + '='.repeat(60));
  if (allSelectorsOk) {
    console.log('Configuration verification: PASSED');
  } else {
    console.log('Configuration verification: FAILED');
    console.log('Some selectors are missing or misconfigured.');
  }
  console.log('='.repeat(60));
}
