<template>
  <div>
    <nav :class="{ 'has-custom-titlebar': hasCustomTitlebar }">
      <Win32Titlebar v-if="enableWin32Titlebar" />
      <LinuxTitlebar v-if="enableLinuxTitlebar" />
      <div class="navigation-buttons">
        <button-icon @click.native="go('back')"
          ><svg-icon icon-class="arrow-left"
        /></button-icon>
        <button-icon @click.native="go('forward')"
          ><svg-icon icon-class="arrow-right"
        /></button-icon>
      </div>
      <div class="navigation-links">
        <router-link to="/" :class="{ active: $route.name === 'home' }">{{
          $t('nav.home')
        }}</router-link>
        <router-link
          to="/explore"
          :class="{ active: $route.name === 'explore' }"
          >{{ $t('nav.explore') }}</router-link
        >
        <router-link
          to="/library"
          :class="{ active: $route.name === 'library' }"
          >{{ $t('nav.library') }}</router-link
        >
      </div>
      <div class="right-part">
        <div class="search-box">
          <div class="container" :class="{ active: inputFocus }">
            <svg-icon icon-class="search" />
            <div class="input">
              <input
                ref="searchInput"
                v-model="keywords"
                type="search"
                :placeholder="inputFocus ? '' : $t('nav.search')"
                @keydown.enter="doSearch"
                @focus="inputFocus = true"
                @blur="inputFocus = false"
              />
            </div>
          </div>
        </div>
        <img
          class="avatar"
          :src="avatarUrl"
          @click="showUserProfileMenu"
          loading="lazy"
        />
      </div>
    </nav>

    <ContextMenu ref="userProfileMenu">
      <div class="item" @click="toSettings">
        <svg-icon icon-class="settings" />
        {{ $t('library.userProfileMenu.settings') }}
      </div>
      <div class="item" @click="logoutSession">
        <svg-icon icon-class="logout" />
        {{ $t('library.userProfileMenu.logout') }}
      </div>
      <div v-if="!ncmBound" class="item" @click="toNeteaseLogin">
        <svg-icon icon-class="login" />
        登录网易云账号
      </div>
      <div v-else class="item" @click="logoutNetease">
        <svg-icon icon-class="logout" />
        退出网易云账号
      </div>
      <hr />
      <div class="item" @click="toGitHub">
        <svg-icon icon-class="github" />
        {{ $t('nav.github') }}
      </div>
    </ContextMenu>
  </div>
</template>

<script>
import { mapState } from 'vuex';
import { isLooseLoggedIn, clearLocalCookies } from '@/utils/auth';
import { unbindNetease, logoutAccess, getStatus } from '@/utils/access';

// import icons for win32 title bar
// icons by https://github.com/microsoft/vscode-codicons
import 'vscode-codicons/dist/codicon.css';

import Win32Titlebar from '@/components/Win32Titlebar.vue';
import LinuxTitlebar from '@/components/LinuxTitlebar.vue';
import ContextMenu from '@/components/ContextMenu.vue';
import ButtonIcon from '@/components/ButtonIcon.vue';

export default {
  name: 'Navbar',
  components: {
    Win32Titlebar,
    LinuxTitlebar,
    ButtonIcon,
    ContextMenu,
  },
  data() {
    return {
      inputFocus: false,
      langs: ['zh-CN', 'zh-TW', 'en', 'tr'],
      keywords: '',
      enableWin32Titlebar: false,
      enableLinuxTitlebar: false,
      ncmBound: false, // 网易云共享账号绑定状态（来自网关 /access/status）
    };
  },
  computed: {
    ...mapState(['settings', 'data']),
    isLooseLoggedIn() {
      return isLooseLoggedIn();
    },
    avatarUrl() {
      return this.data?.user?.avatarUrl && this.isLooseLoggedIn
        ? `${this.data?.user?.avatarUrl}?param=512y512`
        : 'https://s4.music.126.net/style/web2/img/default/default_avatar.jpg?param=60y60';
    },
    hasCustomTitlebar() {
      return this.enableWin32Titlebar || this.enableLinuxTitlebar;
    },
  },
  created() {
    if (process.platform === 'win32') {
      this.enableWin32Titlebar = true;
    } else if (
      process.platform === 'linux' &&
      this.settings.linuxEnableCustomTitlebar
    ) {
      this.enableLinuxTitlebar = true;
    }
    this.refreshStatus();
  },
  watch: {
    // 登录/解绑/路由变化后刷新网易云绑定状态
    $route() {
      this.refreshStatus();
    },
  },
  methods: {
    go(where) {
      if (where === 'back') this.$router.go(-1);
      else this.$router.go(1);
    },
    doSearch() {
      if (!this.keywords) return;
      if (
        this.$route.name === 'search' &&
        this.$route.params.keywords === this.keywords
      ) {
        return;
      }
      this.$router.push({
        name: 'search',
        params: { keywords: this.keywords },
      });
    },
    showUserProfileMenu(e) {
      this.$refs.userProfileMenu.openMenu(e);
    },
    // 从网关刷新网易云绑定状态（B 状态）
    refreshStatus() {
      getStatus()
        .then(res => {
          this.ncmBound = !!res.data?.ncmBound;
        })
        .catch(() => {});
    },
    // 未绑定网易云：跳转网易云登录界面
    toNeteaseLogin() {
      this.$router.push({ name: 'loginAccount' });
    },
    // 退出网页登录：仅销毁当前浏览器 gateway session，不影响服务器共享的网易云账号
    async logoutSession() {
      if (!confirm('确定要退出网页登录吗？')) return;
      try {
        await logoutAccess();
      } catch (e) {
        // session 可能已失效，忽略错误继续清理
      }
      // 清除浏览器本地可能残留的网易云 cookie（凭证只存服务器，本地不留）
      // 注意：不动服务器绑定；不清 loginMode/user —— 网易云登录态（B）保留
      clearLocalCookies();
      window.location.href = '/access/login';
    },
    // 退出网易云账号：解绑服务器共享账号，所有浏览器失效，二次确认
    logoutNetease() {
      if (!this.ncmBound) {
        return; // 未绑定网易云，按钮不显示/不可点
      }
      if (
        !confirm(
          '退出网易云账号将解除服务器绑定的账号，所有浏览器都将失去网易云登录态。确定？'
        )
      )
        return;
      unbindNetease()
        .then(() => {
          // 仅解绑网易云 cookie，不销毁 gateway session（网页登录不受影响）
          this.ncmBound = false;
          this.$store.commit('updateData', { key: 'user', value: {} });
          this.$store.commit('updateData', { key: 'loginMode', value: null });
          this.$store.commit('updateData', {
            key: 'likedSongPlaylistID',
            value: undefined,
          });
          this.$router.push({ name: 'loginAccount' });
        })
        .catch(err => alert(err?.response?.data?.msg || '解绑失败'));
    },
    toSettings() {
      this.$router.push({ name: 'settings' });
    },
    toGitHub() {
      window.open('https://github.com/mcBill1/YesPlayMusic-Online');
    },
    toLogin() {
      if (process.env.IS_ELECTRON === true) {
        this.$router.push({ name: 'loginAccount' });
      } else {
        this.$router.push({ name: 'login' });
      }
    },
  },
};
</script>

<style lang="scss" scoped>
// 未绑定网易云时"退出网易云账号"置灰（ContextMenu 内部元素，需穿透）
::v-deep .item.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

nav {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 64px;
  padding: {
    right: 10vw;
    left: 10vw;
  }
  backdrop-filter: saturate(180%) blur(20px);

  background-color: var(--color-navbar-bg);
  z-index: 100;
  -webkit-app-region: drag;
}

@media (max-width: 1336px) {
  nav {
    padding: 0 max(5vw, 90px);
  }
}

@supports (-moz-appearance: none) {
  nav {
    background-color: var(--color-body-bg);
  }
}

nav.has-custom-titlebar {
  padding-top: 20px;
  -webkit-app-region: no-drag;
}

.navigation-buttons {
  flex: 1;
  display: flex;
  align-items: center;
  .svg-icon {
    height: 24px;
    width: 24px;
  }
  button {
    -webkit-app-region: no-drag;
  }
}
@media (max-width: 970px) {
  .navigation-buttons {
    flex: unset;
  }
}

.navigation-links {
  flex: 1;
  display: flex;
  justify-content: center;
  text-transform: uppercase;
  user-select: none;
  a {
    -webkit-app-region: no-drag;
    font-size: 18px;
    font-weight: 700;
    text-decoration: none;
    border-radius: 6px;
    padding: 6px 10px;
    color: var(--color-text);
    transition: 0.2s;
    -webkit-user-drag: none;
    margin: {
      right: 12px;
      left: 12px;
    }
    &:hover {
      background: var(--color-secondary-bg-for-transparent);
    }
    &:active {
      transform: scale(0.92);
      transition: 0.2s;
    }
  }
  a.active {
    color: var(--color-primary);
  }
}

.search {
  .svg-icon {
    height: 18px;
    width: 18px;
  }
}

.search-box {
  display: flex;
  justify-content: flex-end;
  -webkit-app-region: no-drag;

  .container {
    display: flex;
    align-items: center;
    height: 32px;
    background: var(--color-secondary-bg-for-transparent);
    border-radius: 8px;
    width: 200px;
  }

  .svg-icon {
    height: 15px;
    width: 15px;
    color: var(--color-text);
    opacity: 0.28;
    margin: {
      left: 8px;
      right: 4px;
    }
  }

  input {
    font-size: 16px;
    border: none;
    background: transparent;
    width: 96%;
    font-weight: 600;
    margin-top: -1px;
    color: var(--color-text);
  }

  .active {
    background: var(--color-primary-bg-for-transparent);
    input,
    .svg-icon {
      opacity: 1;
      color: var(--color-primary);
    }
  }
}

[data-theme='dark'] {
  .search-box {
    .active {
      input,
      .svg-icon {
        color: var(--color-text);
      }
    }
  }
}

.right-part {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  .avatar {
    user-select: none;
    height: 30px;
    margin-left: 12px;
    vertical-align: -7px;
    border-radius: 50%;
    cursor: pointer;
    -webkit-app-region: no-drag;
    -webkit-user-drag: none;
    &:hover {
      filter: brightness(80%);
    }
  }
  .search-button {
    display: none;
    -webkit-app-region: no-drag;
  }
}
</style>
