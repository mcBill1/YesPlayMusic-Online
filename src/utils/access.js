// 访问网关 API 封装（共享账号版）
// 网关在 gateway/ 目录：访问密码认证 / 网易云 cookie 绑定 / UI 设置服务器同步
// 独立 axios 实例：不走 src/utils/request.js 的拦截器（避免给 /access 加 realIP 等参数）
import axios from 'axios';

const access = axios.create({
  baseURL: '/access',
  withCredentials: true,
  timeout: 15000,
});

// 访问密码登录 → 成功返回 { code: 0 }，失败 401（剩余次数）/ 403（IP 锁定）
export function login(password) {
  return access.post('/login', { password });
}

// 当前 session 状态：{ loggedIn, ncmBound }
export function getStatus() {
  return access.get('/status');
}

// 网易云登录成功后把 cookie 上传服务器统一保存（本地立即清除）
export function bindNetease(cookie) {
  return access.post('/bind', { cookie });
}

// 解绑服务器共享账号（所有浏览器失去网易云登录态）
export function unbindNetease() {
  return access.post('/unbind');
}

// 退出网页登录（仅销毁当前浏览器 session）
export function logoutAccess() {
  return access.post('/logout');
}

// UI 设置服务器同步：读取 / 保存（共享给所有登录浏览器）
export function getSettings() {
  return access.get('/settings');
}

export function saveSettings(settings) {
  return access.post('/settings', { settings });
}
