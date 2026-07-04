export const defaultSiteBaseUrl = "https://active-etf.chicoo.co";

const defaultAllowedHosts = [
  "active-etf.chicoo.co",
  "chicoo.co",
  "www.chicoo.co",
  "active-etf.inthewins.com",
  "inthewins.com",
  "www.inthewins.com"
];

const canonicalHostByHost = new Map([
  ["active-etf.chicoo.co", "active-etf.chicoo.co"],
  ["chicoo.co", "active-etf.chicoo.co"],
  ["www.chicoo.co", "active-etf.chicoo.co"],
  ["active-etf.inthewins.com", "active-etf.inthewins.com"],
  ["inthewins.com", "active-etf.inthewins.com"],
  ["www.inthewins.com", "active-etf.inthewins.com"]
]);

function parseHostList(value?: string): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((host) => normalizedHostname(host))
    .filter((host): host is string => Boolean(host));
}

function allowedHostsFromEnv(value?: string): string[] {
  return [...new Set([...defaultAllowedHosts, ...parseHostList(value)])];
}

export function normalizedHostname(hostHeader?: string | null): string | null {
  if (!hostHeader) return null;
  const firstHost = hostHeader.split(",")[0]?.trim().toLowerCase();
  if (!firstHost) return null;
  const withoutProtocol = firstHost.replace(/^https?:\/\//u, "");
  const withoutPath = withoutProtocol.split("/")[0];
  if (!withoutPath) return null;
  if (withoutPath.startsWith("[")) return withoutPath.slice(1, withoutPath.indexOf("]"));
  return withoutPath.split(":")[0] || null;
}

export function siteBaseUrlFromHost(
  hostHeader?: string | null,
  options: {
    allowedHosts?: string[];
    fallbackBaseUrl?: string;
  } = {}
): string {
  const fallbackBaseUrl = (options.fallbackBaseUrl ?? process.env.PUBLIC_BASE_URL ?? defaultSiteBaseUrl).replace(/\/+$/u, "");
  const allowedHosts = options.allowedHosts ?? allowedHostsFromEnv(process.env.PUBLIC_SITE_HOSTS);
  const hostname = normalizedHostname(hostHeader);

  if (!hostname || !allowedHosts.includes(hostname)) return fallbackBaseUrl;
  return `https://${canonicalHostByHost.get(hostname) ?? hostname}`;
}

export function siteBaseUrlFromHostCandidates(
  hostHeaders: Array<string | null | undefined>,
  options: {
    allowedHosts?: string[];
    fallbackBaseUrl?: string;
  } = {}
): string {
  const fallbackBaseUrl = (options.fallbackBaseUrl ?? process.env.PUBLIC_BASE_URL ?? defaultSiteBaseUrl).replace(/\/+$/u, "");
  const allowedHosts = options.allowedHosts ?? allowedHostsFromEnv(process.env.PUBLIC_SITE_HOSTS);

  for (const hostHeader of hostHeaders) {
    const hostname = normalizedHostname(hostHeader);
    if (hostname && allowedHosts.includes(hostname)) return `https://${canonicalHostByHost.get(hostname) ?? hostname}`;
  }

  return fallbackBaseUrl;
}
