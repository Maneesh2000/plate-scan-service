/**
 * Extracts the tenant subdomain from the current hostname.
 * E.g.:
 * - "alpha.localhost" -> "alpha"
 * - "beta.localhost"  -> "beta"
 * - "localhost"       -> null (root domain)
 * - "127.0.0.1"       -> null
 */
export function getSubdomain() {
  const hostname = window.location.hostname;

  // IP addresses have no subdomains
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
    return null;
  }

  const parts = hostname.split(".");
  if (parts.length > 1) {
    const sub = parts[0].toLowerCase();
    if (sub !== "www" && sub !== "localhost") {
      return sub;
    }
  }
  return null;
}

