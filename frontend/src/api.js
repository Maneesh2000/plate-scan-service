/**
 * Thin wrapper around fetch for API calls.
 * Automatically attaches the JWT token from localStorage.
 */

import { getSubdomain } from "./utils/subdomain.js";

const API_BASE = "/api/v1";

function authHeaders() {
  const subdomain = getSubdomain();
  // Check both standard "token" and subdomain-specific key
  const token =
    localStorage.getItem("token") ||
    (subdomain ? localStorage.getItem(`token_${subdomain}`) : null);

  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(method, path, body = null, customHeaders = {}) {
  const opts = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...customHeaders,
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, opts);
  const data = await res.json();

  if (!res.ok) {
    // If unauthorized, clear tokens so user can re-authenticate cleanly
    if (res.status === 401 && !path.includes("/auth/login")) {
      const subdomain = getSubdomain();
      localStorage.removeItem("token");
      if (subdomain) localStorage.removeItem(`token_${subdomain}`);
      window.dispatchEvent(new Event("auth_unauthorized"));
    }

    const msg = data.detail || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export const api = {
  resolveTenant: (slug) => request("GET", `/tenants/resolve/${slug}`),

  login: (username, password, tenantSlug = null) => {
    const headers = tenantSlug ? { "X-Tenant-Slug": tenantSlug } : {};
    return request(
      "POST",
      "/auth/login",
      { username, password, tenant_slug: tenantSlug },
      headers
    );
  },

  getCases: (params = {}) => {
    let qs = "";
    if (typeof params === "string") {
      qs = params ? `?status=${encodeURIComponent(params)}` : "";
    } else if (params && typeof params === "object") {
      const searchParams = new URLSearchParams();
      if (params.status) searchParams.append("status", params.status);
      if (params.page) searchParams.append("page", params.page);
      if (params.pageSize) searchParams.append("page_size", params.pageSize);
      if (params.search) searchParams.append("search", params.search);
      const str = searchParams.toString();
      if (str) qs = `?${str}`;
    }
    return request("GET", `/cases${qs}`);
  },

  claimCase: (caseId) => request("POST", `/cases/${caseId}/claim`),

  getCaseScans: (caseId) => request("GET", `/cases/${caseId}/scans`),
};
