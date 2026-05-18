/**
 * Stub for CCS config/config-loader-facade
 * Provides getCcsDir pointing to ~/.mcc instead of ~/.ccs
 */
const path = require('path');
const os = require('os');

function getCcsDir() {
  return process.env.MCC_HOME || path.join(os.homedir(), '.mcc');
}

function loadConfigSafe() {
  return { profiles: {} };
}

function loadSettings(_settingsPath) {
  return { env: {} };
}

function loadOrCreateUnifiedConfig() {
  return {};
}

module.exports = { getCcsDir, loadConfigSafe, loadSettings, loadOrCreateUnifiedConfig };
