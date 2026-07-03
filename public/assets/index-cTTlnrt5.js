const rescueKey = "active-etf:stale-client-rescue-count";

async function clearClientCaches() {
  if ("caches" in window) {
    const names = await window.caches.keys();
    await Promise.all(names.map((name) => window.caches.delete(name)));
  }

  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }
}

function reloadFresh() {
  const url = new URL(window.location.href);
  url.searchParams.set("appVersion", `stale-rescue-${Date.now()}`);
  url.searchParams.set("staleAsset", "index-cTTlnrt5");
  window.location.replace(url.toString());
}

function showManualRefresh() {
  document.body.innerHTML = [
    "<main style=\"font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px;line-height:1.6;color:#24303d;\">",
    "<h1 style=\"font-size:20px;margin:0 0 8px;\">ETF 持倉雷達正在更新</h1>",
    "<p style=\"margin:0 0 16px;\">偵測到舊版快取，請重新整理頁面取得最新版本。</p>",
    "<button type=\"button\" onclick=\"window.location.reload()\" style=\"height:40px;padding:0 14px;border:0;border-radius:8px;background:#07847d;color:#fff;font-weight:700;\">重新整理</button>",
    "</main>"
  ].join("");
}

async function rescueStaleClient() {
  const count = Number(window.sessionStorage.getItem(rescueKey) ?? "0");
  window.sessionStorage.setItem(rescueKey, String(count + 1));

  if (count >= 2) {
    showManualRefresh();
    return;
  }

  try {
    await clearClientCaches();
  } finally {
    reloadFresh();
  }
}

void rescueStaleClient();
