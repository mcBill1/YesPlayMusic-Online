<template>
  <div class="access-login">
    <div class="card">
      <img class="logo" src="/img/logos/yesplaymusic.png" alt="YesPlayMusic" />
      <h1>YesPlayMusic</h1>
      <p class="subtitle">服务器共享账号版 · 请输入访问密码</p>
      <form @submit.prevent="doLogin">
        <input
          v-model="password"
          type="password"
          placeholder="访问密码"
          autofocus
          :disabled="loading"
        />
        <button type="submit" :disabled="loading">
          {{ loading ? '验证中…' : '进 入' }}
        </button>
      </form>
      <p v-if="error" class="error">{{ error }}</p>
      <p class="power">
        Powered by
        <a href="https://github.com/mcBill1/YesPlayMusic-Online" target="_blank"
          >YesPlayMusic Online</a
        >
      </p>
    </div>
  </div>
</template>

<script>
import { login } from '@/utils/access';

export default {
  name: 'AccessLogin',
  data() {
    return {
      password: '',
      loading: false,
      error: '',
    };
  },
  methods: {
    doLogin() {
      if (this.loading) return;
      if (!this.password) {
        this.error = '请输入访问密码';
        return;
      }
      this.loading = true;
      this.error = '';
      login(this.password)
        .then(() => {
          // 整页跳转：强制重新加载应用本体（路由守卫会放行）
          window.location.href = '/';
        })
        .catch(err => {
          this.loading = false;
          const data = err?.response?.data;
          if (data?.msg) {
            this.error = data.msg;
          } else {
            this.error = '无法连接服务器，请稍后重试';
          }
        });
    },
  },
};
</script>

<style lang="scss" scoped>
.access-login {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a2238 0%, #2b3a67 55%, #335eea 130%);
  .card {
    width: 340px;
    padding: 48px 40px 36px;
    text-align: center;
    background: #ffffff;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
    .logo {
      width: 72px;
      height: 72px;
      border-radius: 16px;
    }
    h1 {
      margin: 16px 0 4px;
      font-size: 24px;
      font-weight: 700;
      color: #1f2329;
    }
    .subtitle {
      margin: 0 0 28px;
      font-size: 13px;
      color: #8a919f;
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 12px;
      input {
        height: 44px;
        padding: 0 14px;
        font-size: 15px;
        border: 1px solid #dcdfe6;
        border-radius: 8px;
        outline: none;
        color: #1f2329;
        &:focus {
          border-color: #335eea;
        }
      }
      button {
        height: 44px;
        font-size: 15px;
        font-weight: 600;
        color: #ffffff;
        background: #335eea;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: 0.2s;
        &:hover {
          background: #274bcb;
        }
        &:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      }
    }
    .error {
      margin: 14px 0 0;
      font-size: 13px;
      color: #e5484d;
    }
    .power {
      margin: 32px 0 0;
      font-size: 12px;
      color: #b0b6c0;
      a {
        color: #335eea;
        text-decoration: none;
      }
    }
  }
}
</style>
