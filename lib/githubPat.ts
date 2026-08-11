/**
 * Client-side GitHub Personal Access Token (classic PAT) health check.
 *
 * Talks directly to the public GitHub REST API (`api.github.com`, which is
 * CORS-enabled for browsers) rather than going through the Aegis backend, so
 * the dashboard can surface whether the PAT Aegis has on file is still good
 * without a round-trip.
 *
 * GitHub returns `401 Bad credentials` for both revoked and expired tokens, so
 * a hard distinction between "expired" and "invalid" is only possible for a
 * PAT that still authenticates: a successful `GET /user` exposes the
 * `github-authentication-token-expiration` header which we use to flag PATs
 * that are valid now but expiring soon.
 */

export type GithubPatState =
  | "valid"
  | "expiring_soon"
  | "expired"
  | "invalid"
  | "no_token"
  | "rate_limited"
  | "network_error";

export interface GithubPatStatus {
  state: GithubPatState;
  /** GitHub login the PAT authenticated as (only on success). */
  login?: string;
  /** OAuth scopes granted to a classic PAT (from `x-oauth-scopes`). */
  scopes?: string[];
  /** Parsed expiration date, when the PAT has one configured. */
  expiresAt?: Date | null;
  /** Whole days until expiry (negative if already past). */
  daysUntilExpiry?: number | null;
  /** Human-readable detail, primarily for error/invalid states. */
  message?: string;
  /** Moment the check completed. */
  checkedAt: Date;
}

/** PATs within this window are flagged as "expiring soon". */
const EXPIRY_WARNING_DAYS = 7;

function parseScopes(header: string | null): string[] {
  if (!header) return [];
  return header
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseExpiration(header: string | null): Date | null {
  if (!header || !header.trim()) return null;
  // Header looks like "2026-06-12 07:00:00 UTC" or "2026-06-12 07:00:00 +0000".
  const direct = new Date(header);
  if (!Number.isNaN(direct.getTime())) return direct;
  const normalized = header.replace(" UTC", "Z").replace(" ", "T");
  const fallback = new Date(normalized);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Probe a classic GitHub PAT against `GET https://api.github.com/user`.
 * Never throws. Every failure mode is mapped to a {@link GithubPatStatus}.
 */
export async function checkGithubPat(
  pat: string | undefined | null,
): Promise<GithubPatStatus> {
  const checkedAt = new Date();

  if (!pat || !pat.trim()) {
    return {
      state: "no_token",
      message: "No GitHub PAT is on file for this account.",
      checkedAt,
    };
  }

  let res: Response;
  try {
    res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${pat.trim()}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
  } catch {
    return {
      state: "network_error",
      message: "Could not reach GitHub to verify the PAT.",
      checkedAt,
    };
  }

  // 401 → bad credentials: revoked, expired, or simply wrong.
  if (res.status === 401) {
    return {
      state: "invalid",
      message: "GitHub rejected the PAT because it is expired, revoked, or invalid.",
      checkedAt,
    };
  }

  // 403 with no remaining rate limit means temporarily blocked, not a PAT issue.
  if (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0") {
    return {
      state: "rate_limited",
      message: "GitHub rate limit hit. Try again in a little while.",
      checkedAt,
    };
  }

  if (!res.ok) {
    return {
      state: "invalid",
      message: `GitHub returned an unexpected status (${res.status}).`,
      checkedAt,
    };
  }

  let login: string | undefined;
  try {
    const body = (await res.json()) as { login?: string };
    login = body?.login;
  } catch {
    /* body is optional for our purposes */
  }

  const scopes = parseScopes(res.headers.get("x-oauth-scopes"));
  const expiresAt = parseExpiration(
    res.headers.get("github-authentication-token-expiration"),
  );

  if (expiresAt) {
    const days = daysBetween(checkedAt, expiresAt);
    if (days < 0) {
      return {
        state: "expired",
        login,
        scopes,
        expiresAt,
        daysUntilExpiry: days,
        message: "This PAT's expiration date has already passed.",
        checkedAt,
      };
    }
    if (days <= EXPIRY_WARNING_DAYS) {
      return {
        state: "expiring_soon",
        login,
        scopes,
        expiresAt,
        daysUntilExpiry: days,
        message: `This PAT expires in ${days} day${days === 1 ? "" : "s"}.`,
        checkedAt,
      };
    }
    return {
      state: "valid",
      login,
      scopes,
      expiresAt,
      daysUntilExpiry: days,
      checkedAt,
    };
  }

  return {
    state: "valid",
    login,
    scopes,
    expiresAt: null,
    daysUntilExpiry: null,
    checkedAt,
  };
}
