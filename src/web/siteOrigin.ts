const defaultSiteOrigin = "https://active-etf.chicoo.co";
const allowedPublicHosts = new Set([
  "active-etf.chicoo.co",
  "chicoo.co",
  "www.chicoo.co",
  "active-etf.inthewins.com",
  "inthewins.com",
  "www.inthewins.com"
]);

const canonicalHostByHost = new Map([
  ["active-etf.chicoo.co", "active-etf.chicoo.co"],
  ["chicoo.co", "active-etf.chicoo.co"],
  ["www.chicoo.co", "active-etf.chicoo.co"],
  ["active-etf.inthewins.com", "active-etf.inthewins.com"],
  ["inthewins.com", "active-etf.inthewins.com"],
  ["www.inthewins.com", "active-etf.inthewins.com"]
]);

export function canonicalOriginForLocation(location: Pick<Location, "hostname" | "origin">): string {
  const hostname = location.hostname.toLowerCase();
  if (!allowedPublicHosts.has(hostname)) return defaultSiteOrigin;
  return `https://${canonicalHostByHost.get(hostname) ?? hostname}`;
}
