/**
 * K6 Configuration Loader
 *
 * Loads environment-specific configuration for k6 performance tests.
 * Uses k6's open() function for JSON file loading.
 *
 * Environment is controlled via K6_ENV environment variable:
 * - K6_ENV=local (default) - Uses local.json
 * - K6_ENV=preview - Uses preview.json
 *
 * For preview environment, URLs can be overridden via environment variables:
 * - K6_API_BASE_URL - API base URL
 * - K6_FRONTEND_BASE_URL - Frontend base URL
 */

// Determine environment from K6_ENV or default to 'local'
const environment = __ENV.K6_ENV || 'local';

// Load configuration file using k6's open() function
let configData;
try {
  const configPath = `../config/${environment}.json`;
  const rawConfig = open(configPath);
  configData = JSON.parse(rawConfig);
} catch (error) {
  throw new Error(
    `Failed to load configuration for environment '${environment}'. ` +
      `Ensure k6/config/${environment}.json exists. Error: ${error.message}`
  );
}

/**
 * Resolve environment variable placeholders in config values.
 * Handles ${VAR_NAME} syntax in string values.
 *
 * @param {string} value - The value to resolve
 * @returns {string} - Resolved value with env vars substituted
 */
function resolveEnvVar(value) {
  if (typeof value !== 'string') return value;

  const envVarPattern = /\$\{([^}]+)\}/g;
  return value.replace(envVarPattern, (match, varName) => {
    const envValue = __ENV[varName];
    if (!envValue) {
      throw new Error(
        `Environment variable '${varName}' is required for '${environment}' environment but not set.`
      );
    }
    return envValue;
  });
}

// Resolve any environment variable placeholders in baseUrl
const resolvedConfig = {
  ...configData,
  baseUrl: {
    api: resolveEnvVar(configData.baseUrl.api),
    frontend: resolveEnvVar(configData.baseUrl.frontend),
  },
};

/**
 * The loaded and resolved configuration object.
 * @type {Object}
 */
export const config = resolvedConfig;

/**
 * Get the base URL for a specific service type.
 *
 * @param {'api' | 'frontend'} type - The service type
 * @returns {string} The base URL for the specified service
 * @throws {Error} If the type is not 'api' or 'frontend'
 */
export function getBaseUrl(type) {
  if (type !== 'api' && type !== 'frontend') {
    throw new Error(`Invalid base URL type '${type}'. Must be 'api' or 'frontend'.`);
  }
  return config.baseUrl[type];
}

/**
 * Get test user credentials by role.
 *
 * @param {'learner' | 'beginner' | 'advanced' | 'admin' | 'xpBoundary' | 'xpMid' | 'xpMax'} role - The user role
 * @returns {{ email: string, password: string }} User credentials
 * @throws {Error} If the role is not found in configuration
 */
export function getTestUser(role) {
  const user = config.testUsers[role];
  if (!user) {
    const availableRoles = Object.keys(config.testUsers).join(', ');
    throw new Error(
      `Test user role '${role}' not found. Available roles: ${availableRoles}`
    );
  }
  return user;
}

/**
 * Get the configured thresholds for k6 options.
 *
 * @returns {Object} Thresholds configuration
 */
export function getThresholds() {
  return config.thresholds;
}

/**
 * Get a specific scenario configuration by name.
 *
 * @param {'default' | 'smoke' | 'load'} name - The scenario name
 * @returns {Object} Scenario configuration
 * @throws {Error} If the scenario is not found
 */
export function getScenario(name) {
  const scenario = config.scenarios[name];
  if (!scenario) {
    const availableScenarios = Object.keys(config.scenarios).join(', ');
    throw new Error(
      `Scenario '${name}' not found. Available scenarios: ${availableScenarios}`
    );
  }
  return scenario;
}

/**
 * Build a full API URL from a path.
 *
 * @param {string} path - The API path (should start with /)
 * @returns {string} Full API URL
 * @example
 * apiUrl('/api/v1/auth/login') // Returns 'http://localhost:8000/api/v1/auth/login'
 */
export function apiUrl(path) {
  const base = getBaseUrl('api');
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

/**
 * Build a full frontend URL from a path.
 *
 * @param {string} path - The frontend path (should start with /)
 * @returns {string} Full frontend URL
 * @example
 * frontendUrl('/login') // Returns 'http://localhost:5173/login'
 */
export function frontendUrl(path) {
  const base = getBaseUrl('frontend');
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

// Export current environment for reference
export const currentEnvironment = environment;
