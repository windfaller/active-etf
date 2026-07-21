import { ref } from "vue";
import { getJson } from "../apiClient";
import type { StyleProfile } from "../contracts/styleProfile";

export function useStyleProfile() {
  const profile = ref<StyleProfile | null>(null);
  const loading = ref(false);
  const error = ref("");
  let controller: AbortController | null = null;
  async function load(code: string, window: 20 | 60): Promise<void> {
    controller?.abort(); controller = new AbortController(); loading.value = true; error.value = "";
    try { profile.value = await getJson<StyleProfile>(`/api/etf/${encodeURIComponent(code)}/style?window=${window}`, controller.signal); }
    catch (cause) { if (!(cause instanceof DOMException && cause.name === "AbortError")) error.value = cause instanceof Error ? cause.message : "經理人風格讀取失敗。"; }
    finally { loading.value = false; }
  }
  return { profile, loading, error, load, abort: () => controller?.abort() };
}
