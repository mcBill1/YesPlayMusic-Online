// /access/* 路由：访问密码登录、状态、绑定/解绑、登出
const express = require('express');
const { verifyPassword } = require('./auth');
const { kv } = require('./db');
const { rateLimit, recordFail, isLocked, reset } = require('./rateLimit');

const router = express.Router();

router.post('/login', rateLimit, (req, res) => {
  const password = req.body?.password;
  if (verifyPassword(password)) {
    reset(req.ip);
    req.session.loggedIn = true;
    return res.json({ code: 0, msg: 'ok' });
  }
  const fails = recordFail(req.ip);
  const remain = Math.max(0, (parseInt(process.env.MAX_LOGIN_FAILS || '5', 10)) - fails);
  const msg =
    remain > 0
      ? `访问密码错误，还剩 ${remain} 次机会`
      : '访问密码错误 5 次，IP 已锁定 30 分钟';
  return res.status(401).json({ code: 401, msg });
});

router.get('/status', (req, res) => {
  // 未登录不泄露服务器绑定状态（ncmBound 仅已登录会话可见）
  if (!req.session?.loggedIn) {
    return res.json({ loggedIn: false });
  }
  res.json({
    loggedIn: true,
    ncmBound: kv.get('netease_cookie') !== null,
  });
});

router.post('/bind', (req, res) => {
  if (!req.session?.loggedIn) return res.status(401).json({ code: 401, msg: '未登录' });
  const cookie = req.body?.cookie;
  // 白名单校验：必须包含 MUSIC_U=，长度上限，防脏数据
  if (typeof cookie !== 'string' || !cookie.includes('MUSIC_U=') || cookie.length > 4096) {
    return res.status(400).json({ code: 400, msg: 'cookie 无效' });
  }
  // 只保留 MUSIC_U 与 __csrf（去掉 Max-Age/Expires/Path 等 Set-Cookie 属性噪音）
  const parts = cookie.split(';').map(s => s.trim());
  const clean = parts.filter(p => /^MUSIC_U=/.test(p) || /^__csrf=/.test(p));
  if (clean.length === 0) {
    return res.status(400).json({ code: 400, msg: 'cookie 无效' });
  }
  kv.set('netease_cookie', clean.join(';'));
  res.json({ code: 0, msg: 'ok' });
});

router.post('/unbind', (req, res) => {
  if (!req.session?.loggedIn) return res.status(401).json({ code: 401, msg: '未登录' });
  kv.del('netease_cookie');
  res.json({ code: 0, msg: 'ok' });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ code: 0, msg: 'ok' }));
});

// --- UI 设置服务器同步（共享给所有登录浏览器）---
router.get('/settings', (req, res) => {
  if (!req.session?.loggedIn) return res.status(401).json({ code: 401, msg: '未登录' });
  const raw = kv.get('ui_settings');
  res.json({ code: 0, data: raw ? JSON.parse(raw) : null });
});

router.post('/settings', (req, res) => {
  if (!req.session?.loggedIn) return res.status(401).json({ code: 401, msg: '未登录' });
  const settings = req.body?.settings;
  if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
    return res.status(400).json({ code: 400, msg: '无效设置' });
  }
  kv.set('ui_settings', JSON.stringify(settings));
  res.json({ code: 0, msg: 'ok' });
});

module.exports = router;
