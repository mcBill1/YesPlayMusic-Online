import router from '@/router';
import { getCookie, clearLoginState } from '@/utils/auth';
import { unbindNetease } from '@/utils/access';
import axios from 'axios';

let baseURL = '';
// Web 和 Electron 跑在不同端口避免同时启动时冲突
if (process.env.IS_ELECTRON) {
  if (process.env.NODE_ENV === 'production') {
    baseURL = process.env.VUE_APP_ELECTRON_API_URL;
  } else {
    baseURL = process.env.VUE_APP_ELECTRON_API_URL_DEV;
  }
} else {
  baseURL = process.env.VUE_APP_NETEASE_API_URL;
}

const service = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 15000,
});

service.interceptors.request.use(function (config) {
  if (!config.params) config.params = {};
  if (baseURL.length) {
    if (
      baseURL[0] !== '/' &&
      !process.env.IS_ELECTRON &&
      getCookie('MUSIC_U') !== null
    ) {
      config.params.cookie = `MUSIC_U=${getCookie('MUSIC_U')};`;
    }
  } else {
    console.error("You must set up the baseURL in the service's config");
  }

  if (!process.env.IS_ELECTRON && !config.url.includes('/login')) {
    config.params.realIP = '211.161.244.70';
  }

  // Force real_ip
  const enableRealIP = JSON.parse(
    localStorage.getItem('settings')
  ).enableRealIP;
  const realIP = JSON.parse(localStorage.getItem('settings')).realIP;
  if (process.env.VUE_APP_REAL_IP) {
    config.params.realIP = process.env.VUE_APP_REAL_IP;
  } else if (enableRealIP) {
    config.params.realIP = realIP;
  }

  const proxy = JSON.parse(localStorage.getItem('settings')).proxyConfig;
  if (['HTTP', 'HTTPS'].includes(proxy.protocol)) {
    config.params.proxy = `${proxy.protocol}://${proxy.server}:${proxy.port}`;
  }

  return config;
});

service.interceptors.response.use(
  response => {
    const res = response.data;
    return res;
  },
  async error => {
    /** @type {import('axios').AxiosResponse | null} */
    let response;
    let data;
    if (error === 'TypeError: baseURL is undefined') {
      response = error;
      data = error;
      console.error("You must set up the baseURL in the service's config");
    } else if (error.response) {
      response = error.response;
      data = response.data;
    }

    if (
      response &&
      typeof data === 'object' &&
      data.code === 301 &&
      data.msg === '需要登录'
    ) {
      console.warn('Netease token expired. Clearing login state.');

      // 共享账号版：只清本地登录标记，绝不调网易云 /api/logout
      // （那会登出服务器共享账号 → 所有浏览器失去登录态 → 反复重绑扫码触发风控）
      clearLoginState();
      // 服务器绑定已失效：自动解绑，避免"自动恢复→301→清→刷新→恢复"循环
      unbindNetease().catch(() => {});

      // 導向登入頁面
      if (process.env.IS_ELECTRON === true) {
        router.push({ name: 'loginAccount' });
      } else {
        router.push({ name: 'login' });
      }
    }
  }
);

export default service;
