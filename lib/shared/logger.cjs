/**
 * MCC Logger — 单文件，零依赖
 *
 * 设计原则：
 * - session 隔离：每次 mcc <profile> 生成独立 session，所有子进程写同一文件
 * - 确定性路径：MCC_LOG_DIR / MCC_LOG_SESSION_ID 两个 env 确定路径
 * - 最小 API：init(sessionId, logDir) + logger(component).error/info/debug(msg)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

function env(key, fallback) {
  return process.env[key] ?? fallback;
}

function levelValue(level) {
  return LEVELS[level?.toLowerCase()] ?? LEVELS.info;
}

let _sessionId = '';
let _logDir = '';
let _currentFile = '';
let _currentSize = 0;
let _maxSize = 5 * 1024 * 1024;
let _maxFiles = 3;
let _minLevel = LEVELS.info;

function getLogDir() {
  if (_logDir) return _logDir;
  const logDirEnv = env('MCC_LOG_DIR', '');
  if (logDirEnv) return logDirEnv;
  const mccHome = env('MCC_HOME', path.join(os.homedir(), '.mcc'));
  const profile = env('MCC_CURRENT_PROFILE', 'default');
  return path.join(mccHome, 'logs', profile, _sessionId || 'nosession');
}

function getLogPath() {
  return path.join(getLogDir(), 'mcc.log');
}

function rotate() {
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

function ensureDir() {
  const dir = getLogDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
  return dir;
}

function writeFile(line) {
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
    process.stderr.write(`[logger] write failed: ${err.message}\n`);
  }
}

function timestamp() {
  const now = new Date();
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} ` +
    `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}.${p(now.getMilliseconds(), 3)}`;
}

function format(level, message, component) {
  const sid = _sessionId ? `[${_sessionId}]` : '';
  const comp = component ? `[${component}]` : '';
  return `${timestamp()} ${(level || 'info').toUpperCase().padEnd(5)} ${sid}${comp} ${message}`;
}

function write(level, message, component) {
  if (levelValue(level) > _minLevel) return;
  const line = format(level, message, component);
  process.stderr.write(line + '\n');
  writeFile(line);
}

// --- 导出---

function init(sessionId, logDir) {
  _sessionId = sessionId || '';
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

function initFromEnv() {
  const sid = env('MCC_LOG_SESSION_ID', '');
  const dir = env('MCC_LOG_DIR', '');
  if (sid) init(sid, dir);
}

function isDebugEnabled() {
  return _minLevel >= LEVELS.debug;
}

function makeSessionId() {
  const now = new Date();
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}_` +
    `${p(now.getHours())}-${p(now.getMinutes())}-${p(now.getSeconds())}`;
}

// 统一 API：log.info(component, message) — 两参数风格
const log = {
  error:   (c, m) => write('error', m, c),
  warn:    (c, m) => write('warn',  m, c),
  info:    (c, m) => write('info',  m, c),
  debug:   (c, m) => write('debug', m, c),
  init,
  initFromEnv,
  getSessionId: () => _sessionId,
  getLogDir,
};

// --- 自动从 env 初始化 ---
initFromEnv();

// log 是默认导出（MCP runtime hooks 直接 require 拿这个对象）。
// 顶层属性额外暴露 init / initFromEnv / isDebugEnabled / makeSessionId，
// 让 src/shared/logger.ts 的 named import 可以拿到。
module.exports = log;
module.exports.init = init;
module.exports.initFromEnv = initFromEnv;
module.exports.isDebugEnabled = isDebugEnabled;
module.exports.makeSessionId = makeSessionId;
