// /api/* 转发到网易云 API server，自动注入服务器保存的网易云 cookie
const { createProxyMiddleware } = require('http-proxy-middleware');
const http = require('http');
const { kv } = require('./db');


// 所有 /api 请求必须先通过访问密码 session
function requireSession(req, res, next) {
  if (req.session?.loggedIn) return next();
  return res.status(401).json({ code: 401, msg: '需要登录' });
}

// keepAlive 关闭：避免复用 API server 关闭的死连接导致 ECONNRESET 502
const noKeepAliveAgent = new http.Agent({ keepAlive: false, maxSockets: 32 });

const proxy = createProxyMiddleware({
  // 动态 target：用 router 每次请求解析，避免模块加载时缓存 env
  target: 'http://127.0.0.1:3000',
  router: () => process.env.NCM_API_TARGET || 'http://127.0.0.1:3000',
  changeOrigin: true,
  agent: noKeepAliveAgent,
  selfHandleResponse: true, // 手动管理响应（proxyRes 里统一处理）
  pathRewrite: { '^/api': '' },
  on: {
    error(err, req, res) {
      console.error('[proxy] error:', err.message);
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ code: 502, msg: 'API 服务不可用' }));
    },
    proxyReq(proxyReq, req) {
      // 注入网易云 cookie 到 query 参数（沿用原前端 config.params.cookie 约定）
      // 登录类接口不注入（避免旧 cookie 干扰登录）
      const cookie = kv.get('netease_cookie');
      const isLoginRoute = /\/login(\/|$|\?)/.test(req.url);
      if (cookie && !isLoginRoute && !req.url.includes('cookie=')) {
        const sep = req.url.includes('?') ? '&' : '?';
        proxyReq.path += sep + 'cookie=' + encodeURIComponent(cookie);
      }
    },
    proxyRes(proxyRes, req, res) {
      // HTTPS 页面下 http 的网易云 CDN 资源会被浏览器 mixed content 拦截，
      // 统一把 JSON 响应里的 http://*.music.126.net 升级为 https://
      const ctype = proxyRes.headers['content-type'] || '';
      if (!ctype.includes('application/json')) {
        // 非 JSON（图片/音频/流）：原样透传
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        return proxyRes.pipe(res);
      }
      const chunks = [];
      proxyRes.on('data', c => chunks.push(c));
      proxyRes.on('end', () => {
        let body = Buffer.concat(chunks).toString('utf8');
        body = body.replace(
          /http:\/\/([a-z0-9]+\.)?music\.126\.net/g,
          'https://$1music.126.net'
        );
        const headers = {
          ...proxyRes.headers,
          'content-length': String(Buffer.byteLength(body)),
        };
        res.writeHead(proxyRes.statusCode, headers);
        res.end(body);
      });
    },
  },
});

module.exports = { requireSession, proxy };
