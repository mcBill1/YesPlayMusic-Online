// SQLite 数据层：kv / sessions / login_attempts，全部参数化查询
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'gateway.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  sess TEXT NOT NULL,
  expire INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS login_attempts (
  ip TEXT PRIMARY KEY,
  fails INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0
);
`);

// --- kv（绑定状态）---
const kvGet = db.prepare('SELECT value FROM kv WHERE key = ?');
const kvSet = db.prepare(
  'INSERT INTO kv(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
);
const kvDel = db.prepare('DELETE FROM kv WHERE key = ?');
const kv = {
  get: key => (kvGet.get(key) || {}).value ?? null,
  set: (key, value) => kvSet.run(key, value),
  del: key => kvDel.run(key),
};

// --- express-session store（自实现；继承 Store 基类获得 createSession/generate）---
const { Store } = require('express-session');
const sessGet = db.prepare('SELECT sess FROM sessions WHERE sid = ?');
const sessSet = db.prepare(
  'INSERT INTO sessions(sid, sess, expire) VALUES(?, ?, ?) ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expire = excluded.expire'
);
const sessDel = db.prepare('DELETE FROM sessions WHERE sid = ?');
const sessClean = db.prepare('DELETE FROM sessions WHERE expire < ?');

class SqliteStore extends Store {
  get(sid, cb) {
    const row = sessGet.get(sid);
    cb(null, row ? JSON.parse(row.sess) : null);
  }
  set(sid, sess, cb) {
    const expires = sess.cookie?.expires
      ? new Date(sess.cookie.expires).getTime()
      : Date.now() + 24 * 3600 * 1000;
    sessSet.run(sid, JSON.stringify(sess), expires);
    cb(null);
  }
  destroy(sid, cb) {
    sessDel.run(sid);
    cb(null);
  }
}
const sessionStore = new SqliteStore();

// 每小时清理过期 session 与解锁记录
setInterval(() => {
  const now = Date.now();
  sessClean.run(now);
  db.prepare('DELETE FROM login_attempts WHERE locked_until < ? AND locked_until > 0').run(now);
}, 3600 * 1000).unref();

// --- login_attempts（IP 限流）---
const attGet = db.prepare('SELECT fails, locked_until FROM login_attempts WHERE ip = ?');
const attUpsert = db.prepare(
  'INSERT INTO login_attempts(ip, fails, locked_until) VALUES(?, ?, ?) ON CONFLICT(ip) DO UPDATE SET fails = excluded.fails, locked_until = excluded.locked_until'
);
const attDel = db.prepare('DELETE FROM login_attempts WHERE ip = ?');
const attempts = {
  get: ip => attGet.get(ip) || null,
  upsert: (ip, fails, lockedUntil) => attUpsert.run(ip, fails, lockedUntil),
  del: ip => attDel.run(ip),
};

module.exports = { db, kv, sessionStore, attempts };
