/**
 * MCC Logger (TypeScript)
 *
 * lib/shared/logger.cjs 的 TS 版本，编译到 dist/shared/logger.js
 * 逻辑完全一致，只是加了类型。
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const LEVELS: Record<string, number> = { error: 0, warn: 1, info: 2, debug: 3 };

function env(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function levelValue(level: string): number {
  return LEVELS[level?.toLowerCase()] ?? LEVELS.info;
}

let _sessionId = '';
let _logDir = '';
let _currentFile = '';
let _currentSize = 0;
let _maxSize = 5 * 1024 * 1024;
let _maxFiles = 3;
let _minLevel = LEVELS.info;

function getLogDir(): string {
  if (_logDir) return _logDir;
  const logDirEnv = env('MCC_LOG_DIR', '');
  if (logDirEnv) return logDirEnv;
  const mccHome = env('MCC_HOME', path.join(os.homedir(), '.mcc'));
  const profile = env('MCC_CURRENT_PROFILE', 'default');
  return path.join(mccHome, 'logs', profile, _sessionId || 'nosession');
}

function getLogPath(): string {
  return path.join(getLogDir(), 'mcc.log');
}

function rotate(): void {
  const logPath = getLogPath();
  if (!fs.existsSync(logPath)) return;
  try { fs.unlinkSync(`${logPath}.${_maxFiles}`); } catch {}
  for (let i = _maxFiles - 1; i >= 1; i--) {
    const from = `${logPath}.${i}`;
    const to = `${logPath}.${i + 1}`;
    try { if (fs.existsSync(from)) fs.renameSync(from, to); } catch {}
  }
  try { fs.renameSync(logPath, `${logPath}.1`); } catch {}
  _currentSize = 0;
  _currentFile = '';
}

function ensureDir(): string {
  const dir = getLogDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
  return dir;
}

function writeFile(line: string): void {
  if (!_sessionId) return;
  ensureDir();
  const logPath = getLogPath();
  const lineBytes = Buffer.byteLength(line, 'utf8') + 1;
  if (_currentFile !== logPath || _currentSize + lineBytes > _maxSize) {
    rotate();
  }
  try {
    fs.appendFileSync(logPath, line + '\n', { mode: 0o644 });
    _currentFile = logPath;
    _currentSize += lineBytes;
  } catch (err) {
    process.stderr.write(`[logger] write failed: ${(err as Error).message}\n`);
  }
}

function timestamp(): string {
  const now = new Date();
  const p = (n: number, l = 2) => String(n).padStart(l, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} ` +
    `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}.${p(now.getMilliseconds(), 3)}`;
}

function format(level: string, message: string, component: string): string {
  const sid = _sessionId ? `[${_sessionId}]` : '';
  const comp = component ? `[${component}]` : '';
  return `${timestamp()} ${(level || 'info').toUpperCase().padEnd(5)} ${sid}${comp} ${message}`;
}

function write(level: string, component: string, message: string): void {
  if (levelValue(level) > _minLevel) return;
  const line = format(level, message, component);
  process.stderr.write(line + '\n');
  writeFile(line);
}

export function init(sessionId: string, logDir?: string): string {
  _sessionId = sessionId;
  _logDir = logDir || '';
  _currentFile = '';
  _currentSize = 0;
  _minLevel = levelValue(env('MCC_LOG_LEVEL', 'info'));
  _maxSize = parseInt(env('MCC_LOG_MAX_SIZE', ''), 10) || 5 * 1024 * 1024;
  _maxFiles = parseInt(env('MCC_LOG_MAX_FILES', ''), 10) || 3;
  const dir = ensureDir();
  try { fs.writeFileSync(path.join(dir, '.session'), `${sessionId}\n${Date.now()}\n`, { mode: 0o644 }); } catch {}
  return dir;
}

export function initFromEnv(): void {
  const sid = env('MCC_LOG_SESSION_ID', '');
  const dir = env('MCC_LOG_DIR', '');
  if (sid) init(sid, dir);
}

// --- 统一 API：log.info(component, message) ---
const log = {
  error:   (c: string, m: string) => write('error', m, c),
  warn:    (c: string, m: string) => write('warn',  m, c),
  info:    (c: string, m: string) => write('info',  m, c),
  debug:   (c: string, m: string) => write('debug', m, c),
  init,
  initFromEnv,
  getSessionId: () => _sessionId,
  getLogDir,
};
export { log };

export function isDebugEnabled(): boolean {
  return _minLevel >= LEVELS.debug;
}

export function makeSessionId(): string {
  const now = new Date();
  const p = (n: number, l = 2) => String(n).padStart(l, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}_${p(now.getHours())}-${p(now.getMinutes())}-${p(now.getSeconds())}`;
}
