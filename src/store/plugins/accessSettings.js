// 共享账号版：UI 设置服务器同步插件
// settings 变化 → 防抖 800ms 后 POST /access/settings，共享给所有登录浏览器
import { saveSettings } from '@/utils/access';

let timer = null;

export function getAccessSettingsPlugin() {
  return store => {
    store.subscribe((mutation, state) => {
      if (mutation.type !== 'updateSettings') return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        saveSettings(state.settings).catch(() => {});
      }, 800);
    });
  };
}
