<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { ChevronDown, LogIn, LogOut, UserRound } from "@lucide/vue";
import { useAuth } from "../composables/useAuth";

const { user, isAuthenticated, isLoading, error, signIn, signOut } = useAuth();
const isOpen = ref(false);
const root = ref<HTMLElement | null>(null);

const displayName = computed(() => user.value?.name || user.value?.email || "ETF 雷達會員");
const initials = computed(() => {
  const source = displayName.value.trim();
  if (!source) return "會";
  if (/^[\p{Script=Han}]/u.test(source)) return source.slice(0, 1);
  return source.split(/\s+/u).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
});

function toggleMenu(): void {
  isOpen.value = !isOpen.value;
}

function closeOnOutsideClick(event: PointerEvent): void {
  if (root.value && !root.value.contains(event.target as Node)) isOpen.value = false;
}

async function handleSignOut(): Promise<void> {
  await signOut();
  isOpen.value = false;
}

onMounted(() => document.addEventListener("pointerdown", closeOnOutsideClick));
onBeforeUnmount(() => document.removeEventListener("pointerdown", closeOnOutsideClick));
</script>

<template>
  <div ref="root" class="auth-menu">
    <button
      v-if="!isAuthenticated"
      class="auth-sign-in"
      type="button"
      :disabled="isLoading"
      aria-label="登入或免費註冊"
      @click="signIn('header')"
    >
      <LogIn :size="17" />
      <span v-if="isLoading">確認中</span>
      <template v-else><span class="auth-desktop-label">登入 / 註冊</span><span class="auth-mobile-label">登入</span></template>
    </button>

    <template v-else>
      <button
        class="auth-account-button"
        type="button"
        aria-haspopup="menu"
        :aria-expanded="isOpen"
        aria-label="開啟會員選單"
        @click="toggleMenu"
      >
        <span class="auth-avatar" aria-hidden="true">
          <img v-if="user?.picture" :src="user.picture" alt="" referrerpolicy="no-referrer" />
          <span v-else>{{ initials }}</span>
        </span>
        <span class="auth-account-label">{{ displayName }}</span>
        <ChevronDown :size="14" />
      </button>

      <div v-if="isOpen" class="auth-dropdown" role="menu">
        <div class="auth-profile">
          <span class="auth-avatar auth-avatar--large" aria-hidden="true"><UserRound :size="18" /></span>
          <span><small>已登入</small><strong>{{ displayName }}</strong><small v-if="user?.email && user.email !== displayName">{{ user.email }}</small></span>
        </div>
        <button type="button" role="menuitem" :disabled="isLoading" @click="handleSignOut">
          <LogOut :size="16" />登出
        </button>
      </div>
    </template>

    <p v-if="error" class="auth-error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.auth-menu{position:relative}.auth-sign-in,.auth-account-button{display:flex;align-items:center;justify-content:center;gap:6px;min-height:40px;padding:0 10px;border:1px solid #bfd3d4;border-radius:8px;background:#edf7f5;color:#0d6f69;font-size:12px;font-weight:790;white-space:nowrap;cursor:pointer}.auth-sign-in:hover,.auth-account-button:hover{border-color:#78aaa7;background:#e4f3f0}.auth-sign-in:disabled{cursor:wait;opacity:.65}.auth-mobile-label{display:none}.auth-account-button{padding:0 7px 0 5px;background:#fff;color:#345986}.auth-avatar{display:grid;place-items:center;width:30px;height:30px;overflow:hidden;border-radius:50%;background:#0d7770;color:#fff;font-size:11px;font-weight:850}.auth-avatar img{width:100%;height:100%;object-fit:cover}.auth-account-label{max-width:92px;overflow:hidden;text-overflow:ellipsis}.auth-dropdown{position:absolute;top:calc(100% + 8px);right:0;z-index:100;display:grid;gap:8px;width:min(280px,calc(100vw - 24px));padding:10px;border:1px solid #d7e0e4;border-radius:11px;background:#fff;box-shadow:0 14px 36px rgba(19,42,57,.17)}.auth-profile{display:flex;align-items:center;gap:10px;padding:7px 6px 9px;border-bottom:1px solid #edf1f3}.auth-profile>span:last-child{display:grid;min-width:0;gap:2px}.auth-profile strong,.auth-profile small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.auth-profile strong{color:#263b49;font-size:13px}.auth-profile small{color:#75828c;font-size:11px}.auth-avatar--large{width:34px;height:34px;background:#eaf3f2;color:#0d6f69}.auth-dropdown>button{display:flex;align-items:center;gap:8px;min-height:40px;padding:0 10px;border:0;border-radius:8px;background:#f5f8f9;color:#495d6c;font-weight:750;cursor:pointer}.auth-dropdown>button:hover{background:#eaf3f2;color:#0d6f69}.auth-error{position:absolute;top:calc(100% + 8px);right:0;z-index:101;width:240px;margin:0;padding:9px 11px;border:1px solid #efcbc7;border-radius:8px;background:#fff5f4;color:#9b342e;font-size:11px;line-height:1.45;box-shadow:0 10px 24px rgba(19,42,57,.12)}
@media(max-width:760px){.auth-sign-in{width:auto;min-height:44px;padding:0 9px}.auth-sign-in span{font-size:11px}.auth-desktop-label{display:none}.auth-mobile-label{display:inline}.auth-account-button{width:44px;height:44px;padding:0}.auth-account-label,.auth-account-button>svg{display:none}.auth-avatar{width:31px;height:31px}.auth-dropdown{position:fixed;top:68px;right:10px}.auth-error{position:fixed;top:68px;right:10px}}
:global([data-theme="dark"]) .auth-sign-in,:global([data-theme="dark"]) .auth-account-button{border-color:#395767;background:#172a36;color:#c5e5e2}:global([data-theme="dark"]) .auth-dropdown{border-color:#334b59;background:#142630}:global([data-theme="dark"]) .auth-profile{border-color:#304550}:global([data-theme="dark"]) .auth-profile strong{color:#edf5f7}:global([data-theme="dark"]) .auth-profile small{color:#a8b9c2}:global([data-theme="dark"]) .auth-dropdown>button{background:#1a303c;color:#d7e2e7}
</style>
