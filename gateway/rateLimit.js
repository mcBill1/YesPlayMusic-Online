// IP 限流：失败 MAX_FAILS 次 → 锁定 LOCK_MS（持久化 SQLite，重启不丢）
const { attempts } = require('./db');

const MAX_FAILS = parseInt(process.env.MAX_LOGIN_FAILS || '5', 10);
const LOCK_MS = parseInt(process.env.LOCK_MINUTES || '30', 10) * 60 * 1000;

function recordFail(ip) {
  const row = attempts.get(ip);
  const fails = (row?.fails ?? 0) + 1;
  const lockedUntil = fails >= MAX_FAILS ? Date.now() + LOCK_MS : (row?.locked_until ?? 0);
  attempts.upsert(ip, fails, lockedUntil);
  return fails;
}

function isLocked(ip) {
  const row = attempts.get(ip);
  return !!row && row.locked_until > Date.now();
}

function reset(ip) {
  attempts.del(ip);
}

// 中间件：锁定期内直接 403
function rateLimit(req, res, next) {
  if (isLocked(req.ip)) {
    return res.status(403).json({ code: 403, msg: '登录失败次数过多，IP 已锁定 30 分钟' });
  }
  next();
}

module.exports = { rateLimit, recordFail, isLocked, reset };
