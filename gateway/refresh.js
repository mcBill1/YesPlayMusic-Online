// 网易云登录态自动续期
// 方案A：每日 7:00-8:00 随机时刻调 /login/refresh 主动续期（新 MUSIC_U 有效期 180 天）
// 方案B：被动捕获在 proxy.js（响应 Set-Cookie 带新 MUSIC_U 时同步更新 kv）
// 续期凭据：MUSIC_U + __csrf + MUSIC_R_U（refresh token，MUSIC_U 失效时靠它救）
const http = require('http');
const { kv } = require('./db');

const TARGET = () => process.env.NCM_API_TARGET || 'http://127.0.0.1:3000';

let lastRefreshAt = 0;
let lastResult = { ok: false, reason: 'never' };
// 节流：前端多个浏览器同时 301 时，60s 内只真正调一次 refresh（防高频触发风控）
const MIN_INTERVAL_MS = 60 * 1000;

// 从 Set-Cookie 头提取 MUSIC_U/__csrf/MUSIC_R_U（去掉 Max-Age/Expires/Path 属性噪音）
// 没有新 MUSIC_U 不算续期（返回 null）；响应里 30+ 条 Set-Cookie 大部分是 MUSIC_A_T/MUSIC_R_T 埋点噪音
function extractFreshCookies(setCookieArr) {
  if (!Array.isArray(setCookieArr) || setCookieArr.length === 0) return null;
  const parts = setCookieArr.map(s => s.split(';')[0]);
  const mu = parts.find(p => /^MUSIC_U=/.test(p));
  if (!mu) return null;
  const cs = parts.find(p => /^__csrf=/.test(p));
  const ru = parts.find(p => /^MUSIC_R_U=/.test(p));
  return [mu, cs, ru].filter(Boolean).join(';');
}

// 从 body.cookie 兜底提取（Set-Cookie 缺失时用）
function extractFromBody(cookieStr) {
  if (typeof cookieStr !== 'string') return null;
  const parts = cookieStr.split(';').map(s => s.trim());
  const mu = parts.find(p => /^MUSIC_U=/.test(p));
  if (!mu) return null;
  const cs = parts.find(p => /^__csrf=/.test(p));
  const ru = parts.find(p => /^MUSIC_R_U=/.test(p));
  return [mu, cs, ru].filter(Boolean).join(';');
}

// 执行一次真实 refresh（60s 节流内直接返回上次结果）
function refreshNeteaseCookie() {
  return new Promise(resolve => {
    const now = Date.now();
    if (now - lastRefreshAt < MIN_INTERVAL_MS) return resolve(lastResult);

    const cookie = kv.get('netease_cookie');
    if (!cookie) {
      lastResult = { ok: false, reason: 'no-cookie' };
      lastRefreshAt = now;
      return resolve(lastResult);
    }

    const url = `${TARGET()}/login/refresh?cookie=${encodeURIComponent(cookie)}&timestamp=${now}`;
    const req = http.get(url, res => {
      let body = '';
      res.on('data', c => (body += c));
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          const fresh =
            extractFreshCookies(res.headers['set-cookie']) ||
            (data.code === 200 ? extractFromBody(data.cookie) : null);
          if (data.code === 200 && fresh) {
            kv.set('netease_cookie', fresh);
            lastResult = { ok: true, refreshed: true };
            console.log(`[cookie-refresh] ok @ ${new Date().toISOString()} (new MUSIC_U ${fresh.length} chars)`);
          } else {
            lastResult = {
              ok: false,
              reason: data.code === 301 ? '登录态已失效' : `code=${data.code}`,
            };
            console.warn(`[cookie-refresh] failed: ${lastResult.reason} — 不解绑，等 301 流程处理`);
          }
        } catch (e) {
          lastResult = { ok: false, reason: 'parse-error' };
          console.error('[cookie-refresh] parse error:', e.message);
        }
        lastRefreshAt = Date.now();
        resolve(lastResult);
      });
    });
    req.setTimeout(15000, () => {
      req.destroy();
      lastResult = { ok: false, reason: 'timeout' };
      lastRefreshAt = Date.now();
      resolve(lastResult);
    });
    req.on('error', e => {
      lastResult = { ok: false, reason: e.message };
      lastRefreshAt = Date.now();
      resolve(lastResult);
    });
  });
}

// 下一次 7:00-8:00 之间的随机时刻（服务器时区 Asia/Shanghai）
function nextRefreshTime() {
  const now = new Date();
  const today7 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 0, 0, 0);
  let base = today7.getTime();
  if (now.getTime() >= base + 3600 * 1000) {
    base += 24 * 3600 * 1000; // 已过 8 点 → 明天
  } else if (now.getTime() >= base) {
    base = now.getTime() + 60 * 1000; // 正好在 7-8 点窗口 → 至少 1 分钟后
  }
  return base + Math.floor(Math.random() * 3600 * 1000); // 0 ~ 59:59.999
}

function scheduleDailyRefresh() {
  const t = nextRefreshTime();
  const delay = t - Date.now();
  console.log(
    `[cookie-refresh] 下次自动续期: ${new Date(t).toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
    })} (${Math.round((delay / 3600000) * 10) / 10}h 后)`
  );
  setTimeout(async () => {
    await refreshNeteaseCookie();
    scheduleDailyRefresh();
  }, delay).unref();
}

scheduleDailyRefresh();

module.exports = { refreshNeteaseCookie, extractFreshCookies, extractFromBody };
