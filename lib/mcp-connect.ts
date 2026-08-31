import type { WorkspaceMcpConfigSnippet } from "@/lib/api";

const KEY_QUERY_ALIASES = ["api_key", "x_api_key", "agent_key", "x_agent_key"];

function hasKeyQuery(url: URL): boolean {
  return KEY_QUERY_ALIASES.some((name) => url.searchParams.has(name));
}

/**
 * Prefer the backend snippet URL when it already carries the workspace key.
 * Otherwise attach `api_key` as a query param (URL-encoded). Do not put the
 * raw key in a path — reserved characters break path-form URLs.
 */
export function withApiKeyQuery(baseUrl: string, agentKey: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    if (!hasKeyQuery(url)) {
      url.searchParams.set("api_key", agentKey);
    }
    return url.toString();
  } catch {
    if (KEY_QUERY_ALIASES.some((name) => new RegExp(`[?&]${name}=`).test(trimmed))) {
      return trimmed;
    }
    const joiner = trimmed.includes("?") ? "&" : "?";
    return `${trimmed}${joiner}api_key=${encodeURIComponent(agentKey)}`;
  }
}

function toSseUrl(mcpUrl: string): string {
  try {
    const url = new URL(mcpUrl);
    if (url.pathname.endsWith("/sse") || url.pathname.includes("/sse/")) {
      return url.toString();
    }
    if (url.pathname.endsWith("/mcp")) {
      url.pathname = `${url.pathname.slice(0, -4)}/sse`;
    } else {
      url.pathname = url.pathname.replace(/\/mcp(?=\/|$)/, "/sse");
    }
    return url.toString();
  } catch {
    return mcpUrl.replace(/\/mcp(\?|$)/, "/sse$1");
  }
}

/** Cursor / Streamable HTTP: `mcp_config_snippet.aegis.url` */
export function getMcpCursorUrl(
  snippet: WorkspaceMcpConfigSnippet,
  agentKey: string,
): string {
  return withApiKeyQuery(snippet.aegis.url, agentKey);
}

/** Claude custom connector: `mcp_config_snippet.aegis.sse_url` (URL must end in /sse) */
export function getMcpClaudeUrl(
  snippet: WorkspaceMcpConfigSnippet,
  agentKey: string,
): string {
  const sse = snippet.aegis.sse_url?.trim();
  return withApiKeyQuery(sse || toSseUrl(snippet.aegis.url), agentKey);
}
