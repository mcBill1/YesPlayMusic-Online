# YesPlayMusic-Online 网关（共享账号版）

访问密码认证 + 网易云 cookie 服务端保存 + UI 设置服务器同步。所有请求先过网关：
未通过访问密码 → 302 到独立登录页（应用本体不返回）；`/api/*` 一律 401。

## 架构

```
浏览器 → 网关(:10005, gateway/server.js) → 网易云 API(:3000, @neteaseapireborn/api)
              │
              ├─ /access/*   登录/状态/绑定/解绑/设置（SQLite 持久化）
              ├─ /api/*      需 session，代理到 :3000 并注入服务器保存的网易云 cookie
              └─ 静态托管    前端 dist/（入口需 session）
```

## 配置（gateway/.env）

| 变量 | 说明 | 默认 |
|------|------|------|
| `ACCESS_PASSWORD_HASH` | 访问密码 scrypt 哈希（**必填**，未配置一律拒绝登录） | 无 |
| `SESSION_SECRET` | session 签名密钥（不配则每次重启随机 → 全部重新登录） | 随机 |
| `GATEWAY_PORT` | 网关端口 | 8080 |
| `GATEWAY_HOST` | 监听地址，`::` 双栈 IPv4+IPv6 | 0.0.0.0 |
| `NCM_API_TARGET` | 网易云 API 地址 | http://127.0.0.1:3000 |
| `COOKIE_SECURE` | HTTPS 反代下置 `true` | false |
| `SESSION_TTL_HOURS` | 网页登录有效期 | 24 |
| `MAX_LOGIN_FAILS` | 密码错误锁定阈值 | 5 |
| `LOCK_MINUTES` | IP 锁定分钟数 | 30 |
| `DB_PATH` | SQLite 文件路径 | gateway/data/gateway.db |

## 设置访问密码

```bash
cd gateway
# 1. 生成哈希（把「你的密码」换成要设置的密码）
node -e "const c=require('crypto');console.log(c.scryptSync('你的密码','yesplaymusic',64).toString('hex'))"
# 2. 创建 .env 并填入输出
cat > .env <<EOF
ACCESS_PASSWORD_HASH=上一步输出的哈希
SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
GATEWAY_PORT=10005
GATEWAY_HOST=::
COOKIE_SECURE=true
EOF
```

改密码：重新生成哈希覆盖 `.env` 里的 `ACCESS_PASSWORD_HASH`，然后 `./start.sh restart`。

## 运行

```bash
./start.sh start    # 启动 API(:3000) + 网关(:10005)
./start.sh stop
./start.sh status
```

## 数据

- `gateway/data/gateway.db`：kv（网易云 cookie、UI 设置）、sessions、login_attempts
- 解绑/退出：网页右上角头像菜单 → 「退出网易云账号」（所有浏览器失效）或「退出网页登录」（仅当前浏览器）
