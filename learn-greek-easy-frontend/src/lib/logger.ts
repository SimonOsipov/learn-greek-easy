import log from 'loglevel';

// Store original factory before modification
const originalFactory = log.methodFactory;

// Add timestamp prefix via methodFactory
log.methodFactory = function (
  methodName: string,
  logLevel: log.LogLevelNumbers,
  loggerName: string | symbol
) {
  const rawMethod = originalFactory(methodName, logLevel, loggerName);
  return function (...args: unknown[]) {
    const timestamp = new Date().toISOString();
    rawMethod(`[${timestamp}]`, ...args);
  };
};

// Set log level based on environment
// Using setDefaultLevel instead of setLevel for better UX:
// - setDefaultLevel only applies if no level was previously persisted
// - This respects any user/developer overrides from localStorage
if (import.meta.env.PROD) {
  log.setDefaultLevel('warn'); // Only warnings and errors in production
} else {
  log.setDefaultLevel('debug'); // Full debugging in development
}

// Apply the methodFactory changes
// Must call rebuild() after modifying methodFactory
log.rebuild();

export default log;

// Named exports for convenience
export const { trace, debug, info, warn, error } = log;
