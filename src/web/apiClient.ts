export const apiBase = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? "http://127.0.0.1:7072" : "");

export async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, { signal });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ?? `${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}
