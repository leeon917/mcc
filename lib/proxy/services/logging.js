/**
 * Stub for CCS services/logging - provides no-op logger
 */
function createLogger(_name) {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    stage: () => {},
  };
}
module.exports = { createLogger };
