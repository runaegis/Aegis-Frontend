const STORAGE_KEY = "aegis_post_auth_redirect";
const MAX_AGE_MS = 30 * 60 * 1000;

function pathOnly(value: string): string {
  return value.split("?")[0]?.split("#")[0] ?? "";
}

export function isSafePostAuthPath(path: string): boolean {
  const clean = pathOnly(path.trim());
  if (!clean.startsWith("/") || clean.startsWith("//") || clean.includes("://")) {
    return false;
  }
  return (
    /^\/memory\/share\/[A-Za-z0-9_-]+\/?$/.test(clean) ||
    /^\/workspaces\/join\/[A-Za-z0-9_-]+\/?$/.test(clean)
  );
}

export function storePostAuthRedirect(path: string): void {
  if (typeof window === "undefined" || !isSafePostAuthPath(path)) return;
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ path: pathOnly(path), savedAt: Date.now() }),
    );
  } catch {
    // sessionStorage may be unavailable
  }
}

export function consumePostAuthRedirect(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { path?: string; savedAt?: number };
    if (
      typeof parsed.path !== "string" ||
      typeof parsed.savedAt !== "number" ||
      Date.now() - parsed.savedAt > MAX_AGE_MS ||
      !isSafePostAuthPath(parsed.path)
    ) {
      return null;
    }
    return pathOnly(parsed.path);
  } catch {
    return null;
  }
}

export function buildMemorySharePath(shareCode: string): string {
  return `/memory/share/${encodeURIComponent(shareCode)}`;
}

export function buildMemoryShareUrl(shareCode: string, origin?: string): string {
  const base =
    origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}${buildMemorySharePath(shareCode)}`;
}

export function buildWorkspaceJoinPath(inviteCode: string): string {
  return `/workspaces/join/${encodeURIComponent(inviteCode)}`;
}

export function buildWorkspaceJoinUrl(inviteCode: string, origin?: string): string {
  const base =
    origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}${buildWorkspaceJoinPath(inviteCode)}`;
}
