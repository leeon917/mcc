/**
 * MCC Logger (TypeScript thin shell)
 *
 * Single source of truth lives in lib/shared/logger.cjs — it must stay CJS
 * because MCP runtime hooks (also CJS) require it directly from
 * ~/.mcc/shared/logger.cjs after installer copies it over.
 *
 * This file exists only to give src/ TypeScript code typed access to that impl.
 * Runtime resolution: dist/shared/logger.js → ../../lib/shared/logger.cjs
 * (the same relative path works both in dev and after npm publish, since
 *  package.json `files` ships both dist/ and lib/).
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const impl = require('../../lib/shared/logger.cjs');

export interface Logger {
  error: (component: string, message: string) => void;
  warn:  (component: string, message: string) => void;
  info:  (component: string, message: string) => void;
  debug: (component: string, message: string) => void;
  init: (sessionId: string, logDir?: string) => string;
  initFromEnv: () => void;
  getSessionId: () => string;
  getLogDir: () => string;
}

export const log: Logger = impl;
export const init: (sessionId: string, logDir?: string) => string = impl.init;
export const initFromEnv: () => void = impl.initFromEnv;
export const isDebugEnabled: () => boolean = impl.isDebugEnabled;
export const makeSessionId: () => string = impl.makeSessionId;
