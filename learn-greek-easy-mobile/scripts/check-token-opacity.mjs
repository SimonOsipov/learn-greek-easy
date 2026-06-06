/**
 * check-token-opacity.mjs — STUB (not yet implemented)
 *
 * Real implementation added by executor (NWOPA-04).
 * This file exists so the ATDD tests can import it and fail on assertions
 * (not on missing-module errors) before the executor fills in the logic.
 */

/**
 * @param {string} _configText  Raw text of tailwind.config.js
 * @returns {string[]}          List of var-backed token names
 */
export function parseDenylist(_configText) {
  // Stub: returns empty — tests that expect tokens will fail (RED).
  return [];
}

/**
 * @param {string[]} _denylist  Token names to flag
 * @param {string}   _fileText  Source file text to scan
 * @returns {Array<{line:number, col:number, snippet:string, token:string}>}
 */
export function scanContent(_denylist, _fileText) {
  // Stub: returns empty — tests that expect matches will fail (RED).
  return [];
}

// CLI entry-point (not tested here — covered by executor + CI)
if (import.meta.url === `file://${process.argv[1]}`) {
  // Real implementation added by executor.
  process.exit(0);
}
