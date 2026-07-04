const defaultSiteOrigin = "https://active-etf.chicoo.co";
const allowedPublicHosts = new Set(["active-etf.chicoo.co", "chicoo.co", "www.chicoo.co", "inthewins.com", "www.inthewins.com"]);

export function canonicalOriginForLocation(location: Pick<Location, "hostname" | "origin">): string {
  const hostname = location.hostname.toLowerCase();
  if (!allowedPublicHosts.has(hostname)) return defaultSiteOrigin;
  return location.origin.replace(/\/+$/u, "");
}
