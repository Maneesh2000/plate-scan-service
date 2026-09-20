import { createContext, useContext, useState, useEffect } from "react";
import { api } from "../api";
import { getSubdomain } from "../utils/subdomain";

const AuthContext = createContext(null);

function decodeToken(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tenantInfo, setTenantInfo] = useState(null);

  const subdomain = getSubdomain();
  const tokenKey = subdomain ? `token_${subdomain}` : "token";
  const userKey = subdomain ? `user_${subdomain}` : "username";

  // Resolve tenant details if on a subdomain
  useEffect(() => {
    async function loadTenant() {
      if (subdomain) {
        try {
          const tenant = await api.resolveTenant(subdomain);
          setTenantInfo(tenant);
        } catch {
          setTenantInfo({
            name: `${subdomain.charAt(0).toUpperCase() + subdomain.slice(1)} Recovery`,
            slug: subdomain,
          });
        }
      }
    }
    loadTenant();
  }, [subdomain]);

  // Restore session from localStorage on mount
  useEffect(() => {
    const token =
      localStorage.getItem("token") || localStorage.getItem(tokenKey);
    if (token) {
      const payload = decodeToken(token);
      if (payload && payload.exp * 1000 > Date.now()) {
        setUser({
          token,
          userId: payload.sub,
          tenantId: payload.tenant_id,
          role: payload.role,
          username:
            localStorage.getItem("username") ||
            localStorage.getItem(userKey) ||
            "user",
          subdomain,
        });
      } else {
        localStorage.removeItem("token");
        localStorage.removeItem(tokenKey);
        localStorage.removeItem("username");
        localStorage.removeItem(userKey);
      }
    }
    setLoading(false);
  }, [tokenKey, userKey, subdomain]);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem(tokenKey);
    localStorage.removeItem("username");
    localStorage.removeItem(userKey);
    setUser(null);
  };

  // Listen for 401 unauthorized events to automatically reset invalid sessions
  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
    };
    window.addEventListener("auth_unauthorized", handleUnauthorized);
    return () =>
      window.removeEventListener("auth_unauthorized", handleUnauthorized);
  }, [tokenKey, userKey]);

  const login = async (username, password) => {
    const data = await api.login(username, password, subdomain);
    const token = data.access_token;

    // Save under both standard and subdomain keys
    localStorage.setItem("token", token);
    localStorage.setItem(tokenKey, token);
    localStorage.setItem("username", username);
    localStorage.setItem(userKey, username);

    const payload = decodeToken(token);
    setUser({
      token,
      userId: payload.sub,
      tenantId: payload.tenant_id,
      role: payload.role,
      username,
      subdomain,
    });
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, tenantInfo, subdomain, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
