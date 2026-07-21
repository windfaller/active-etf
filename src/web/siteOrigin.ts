import { SITE_ORIGIN } from "./seo/routeMetadata.js";

export function canonicalOriginForLocation(location: Pick<Location, "hostname" | "origin">): string {
  void location;
  return SITE_ORIGIN;
}
