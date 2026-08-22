// 网关装配：安全头 + session + /access 路由 + /api 代理 + 静态托管
require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const { sessionStore } = require('./db');
const accessRoutes = require('./routes');
const { requireSession, proxy } = require('./proxy');

const app = express();
app.set('trust proxy', 1); // 反代后取 X-Forwarded-For 真实 IP
app.disable('x-powered-by');

// --- 安全头（XSS / 点击劫持 / MIME 嗅探）---
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data: blob: https: http://*.music.126.net; media-src 'self' blob: https: http://*.music.126.net; style-src 'self' 'unsafe-inline'; connect-src 'self' https:; font-src 'self' data:; script-src 'self' https://www.googletagmanager.com https://static.cloudflareinsights.com; worker-src 'self' blob: data:; object-src 'none'; frame-ancestors 'none'"
  );
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.use(express.json({ limit: '100kb' }));

const ttlMs = parseInt(process.env.SESSION_TTL_HOURS || '24', 10) * 3600 * 1000;
app.use(
  session({
    // ponytail: 未配置 secret 时用随机值 → 重启后所有 session 失效，需重输访问密码（可接受）
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.COOKIE_SECURE === 'true', // HTTPS 反代下置 true
      maxAge: ttlMs,
    },
  })
);

// 请求日志：记录 /access 与 /api 的状态码（排障用，写入 gateway.log）
app.use((req, res, next) => {
  if (req.path.startsWith('/access') || req.path.startsWith('/api')) {
    res.on('finish', () => {
      console.log(
        `[req] ${new Date().toISOString()} ${req.method} ${req.path} -> ${res.statusCode} session=${!!req.session?.loggedIn}`
      );
    });
  }
  next();
});

app.use('/access', accessRoutes);
app.use('/api', requireSession, proxy);

// --- 静态托管前端 dist ---
const dist = path.join(__dirname, '..', 'dist');
if (require('fs').existsSync(dist)) {
  // 静态资源（js/css/img）：不自动服务 index.html（入口需过 session 检查）
  app.use(express.static(dist, { index: false }));
  // 登录页 SPA 路由：始终返回 index.html（未登录可访问；已登录则回主页）
  app.get('/access/login', (req, res) => {
    if (req.session?.loggedIn) return res.redirect('/');
    res.sendFile(path.join(dist, 'index.html'));
  });
  // 其余 SPA 页面：未授权一律 302 到登录页（应用 HTML 不返回 → 应用本体不加载）
  // 仅排除 /api 与 GET API 路由（status/settings）；未知 /access/* 也回退（SPA catch-all → 主页）
  app.get(/^\/(?!api|access\/(status|settings)).*/, (req, res) => {
    if (!req.session?.loggedIn) return res.redirect('/access/login');
    res.sendFile(path.join(dist, 'index.html'));
  });
}

// 统一错误处理：不回显输入
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ code: 500, msg: '服务器内部错误' });
});

module.exports = app;

if (require.main === module) {
  const port = parseInt(process.env.GATEWAY_PORT || '8080', 10);
  // 监听地址：默认 0.0.0.0（IPv4）；设 :: 可双栈监听 IPv4+IPv6
  const host = process.env.GATEWAY_HOST || '0.0.0.0';
  app.listen(port, host, () =>
    console.log(`[gateway] listening on http://${host === '0.0.0.0' ? '0.0.0.0' : '[' + host + ']'}:${port}`)
  );
}
