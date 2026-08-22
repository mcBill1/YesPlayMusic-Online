import Cookies from 'js-cookie';
import { logout } from '@/api/auth';
import store from '@/store';

export function setCookies(string) {
  const cookies = string.split(';;');
  cookies.map(cookie => {
    document.cookie = cookie;
    const cookieKeyValue = cookie.split(';')[0].split('=');
    localStorage.setItem(`cookie-${cookieKeyValue[0]}`, cookieKeyValue[1]);
  });
}

export function getCookie(key) {
  return Cookies.get(key) ?? localStorage.getItem(`cookie-${key}`);
}

export function removeCookie(key) {
  Cookies.remove(key);
  localStorage.removeItem(`cookie-${key}`);
}

// MUSIC_U 只有在账户登录的情况下才有
export function isLoggedIn() {
  return getCookie('MUSIC_U') !== undefined;
}

// 账号登录（共享账号版：网易云登录态只存服务器，本地凭 loginMode 判断）
export function isAccountLoggedIn() {
  return store.state.data.loginMode === 'account';
}

// 用户名搜索（用户数据为只读）
export function isUsernameLoggedIn() {
  return store.state.data.loginMode === 'username';
}

// 账户登录或者用户名搜索都判断为登录，宽松检查
export function isLooseLoggedIn() {
  return isAccountLoggedIn() || isUsernameLoggedIn();
}

export function doLogout() {
  logout();
  removeCookie('MUSIC_U');
  removeCookie('__csrf');
  // 更新状态仓库中的用户信息
  store.commit('updateData', { key: 'user', value: {} });
  // 更新状态仓库中的登录状态
  store.commit('updateData', { key: 'loginMode', value: null });
  // 更新状态仓库中的喜欢列表
  store.commit('updateData', { key: 'likedSongPlaylistID', value: undefined });
}

// 共享账号版：仅清本地登录标记，不调网易云 API logout
// （/api/logout 会登出服务器共享账号，导致所有浏览器失去登录态、用户反复重绑触发风控）
export function clearLoginState() {
  store.commit('updateData', { key: 'user', value: {} });
  store.commit('updateData', { key: 'loginMode', value: null });
  store.commit('updateData', { key: 'likedSongPlaylistID', value: undefined });
}

// 共享账号版：清除本地所有网易云 cookie（登录态只存服务器，本地不留凭证）
export function clearLocalCookies() {
  Object.keys(localStorage)
    .filter(key => key.startsWith('cookie-'))
    .forEach(key => localStorage.removeItem(key));
  removeCookie('MUSIC_U');
  removeCookie('__csrf');
}
