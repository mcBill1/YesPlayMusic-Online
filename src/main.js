import Vue from 'vue';
import VueGtag from 'vue-gtag';
import App from './App.vue';
import router from './router';
import store from './store';
import i18n from '@/locale';
import '@/assets/icons';
import '@/utils/filters';
import './registerServiceWorker';
import { dailyTask } from '@/utils/common';
import '@/assets/css/global.scss';
import NProgress from 'nprogress';
import '@/assets/css/nprogress.css';
import { getStatus, getSettings, unbindNetease } from '@/utils/access';

window.resetApp = () => {
  localStorage.clear();
  indexedDB.deleteDatabase('yesplaymusic');
  document.cookie.split(';').forEach(function (c) {
    document.cookie = c
      .replace(/^ +/, '')
      .replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
  });
  return '已重置应用，请刷新页面（按Ctrl/Command + R）';
};
console.log(
  '如出现问题，可尝试在本页输入 %cresetApp()%c 然后按回车重置应用。',
  'background: #eaeffd;color:#335eea;padding: 4px 6px;border-radius:3px;',
  'background:unset;color:unset;'
);

Vue.use(
  VueGtag,
  {
    config: { id: 'G-KMJJCFZDKF' },
  },
  router
);
Vue.config.productionTip = false;

NProgress.configure({ showSpinner: false, trickleSpeed: 100 });
dailyTask();

// 共享账号版：已通过访问密码时，从服务器恢复网易云登录态 + UI 设置（共享给所有浏览器）
getStatus()
  .then(res => {
    if (!res.data?.loggedIn) return null;
    // 服务器有网易云绑定 → 自动恢复登录标记（任何浏览器输密码后直接可用，无需重新扫码）
    // 安全：只读布尔状态，网易云 cookie 永不出服务器（由网关服务端注入）
    if (res.data?.ncmBound && store.state.data.loginMode !== 'account') {
      store.commit('updateData', { key: 'loginMode', value: 'account' });
      store
        .dispatch('fetchUserProfile')
        .then(profile => {
          if (!profile) {
            // 服务器绑定已失效：自动解绑，避免"恢复→被清"循环闪烁
            unbindNetease().catch(() => {});
          }
        })
        .catch(() => {});
    }
    return getSettings();
  })
  .then(res => {
    if (res?.data?.data) {
      Object.entries(res.data.data).forEach(([key, value]) =>
        store.commit('updateSettings', { key, value })
      );
    }
  })
  .catch(() => {});

new Vue({
  i18n,
  store,
  router,
  render: h => h(App),
}).$mount('#app');
