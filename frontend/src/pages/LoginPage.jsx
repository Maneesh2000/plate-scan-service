import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import TenantLogo from "../components/TenantLogo.jsx";

export default function LoginPage() {
  const { user, tenantInfo, subdomain, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  if (user) {
    navigate("/");
    return null;
  }

  const tenantName =
    tenantInfo?.name ||
    (subdomain
      ? `${subdomain.charAt(0).toUpperCase() + subdomain.slice(1)} Recovery`
      : "PlateScan Recovery");

  const handleLogin = async (userToLogin, passToLogin) => {
    setError("");
    setLoading(true);
    try {
      await login(userToLogin, passToLogin);
      navigate("/");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleLogin(username, password);
  };

  return (
    <div className="cal-login-page">
      <div className="cal-login-card">
        {/* Card Header with tenant logo and tenant name beside it */}
        <div className="cal-card-header">
          <div className="cal-brand-header-row">
            <TenantLogo slug={subdomain} name={tenantName} size={36} />
            <span className="cal-brand-name">{tenantName}</span>
          </div>
          <p className="cal-brand-subtitle">Welcome back! Sign in to continue</p>
        </div>

        {error && <div className="cal-alert-error">{error}</div>}

        {/* 1-Click Agency Account Buttons (styled like Cal.com's Google / Microsoft SSO buttons) */}
        {subdomain === "alpha" && (
          <div className="cal-sso-buttons">
            <button
              type="button"
              className="cal-btn-dark-pill"
              onClick={() => handleLogin("alice", "password123")}
              disabled={loading}
            >
              <span className="cal-sso-icon">👤</span>
              <span>Sign in as Alice (Staff)</span>
            </button>
            <button
              type="button"
              className="cal-btn-light-pill"
              onClick={() => handleLogin("admin_a", "password123")}
              disabled={loading}
            >
              <span className="cal-sso-icon">🛡️</span>
              <span>Sign in as Admin A</span>
            </button>
          </div>
        )}

        {subdomain === "beta" && (
          <div className="cal-sso-buttons">
            <button
              type="button"
              className="cal-btn-dark-pill"
              onClick={() => handleLogin("bob", "password123")}
              disabled={loading}
            >
              <span className="cal-sso-icon">👤</span>
              <span>Sign in as Bob (Staff)</span>
            </button>
          </div>
        )}

        {!subdomain && (
          <div className="cal-sso-buttons">
            <button
              type="button"
              className="cal-btn-dark-pill"
              onClick={() => handleLogin("alice", "password123")}
              disabled={loading}
            >
              <span className="cal-sso-icon">👤</span>
              <span>Sign in as Alice (Alpha)</span>
            </button>
            <button
              type="button"
              className="cal-btn-light-pill"
              onClick={() => handleLogin("bob", "password123")}
              disabled={loading}
            >
              <span className="cal-sso-icon">👤</span>
              <span>Sign in as Bob (Beta)</span>
            </button>
          </div>
        )}

        {/* Cal.com divider with "or" */}
        <div className="cal-divider">
          <span>or</span>
        </div>

        {/* Main Credentials Form */}
        <form onSubmit={handleSubmit} className="cal-form">
          <div className="cal-form-group">
            <label htmlFor="username" className="cal-label">
              Username
            </label>
            <input
              id="username"
              type="text"
              className="cal-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. alice, bob, admin_a"
              required
              autoFocus
            />
          </div>

          <div className="cal-form-group">
            <div className="cal-password-header">
              <label htmlFor="password" className="cal-label">
                Password
              </label>
              <a
                href="#forgot"
                className="cal-forgot-link"
                onClick={(e) => {
                  e.preventDefault();
                  alert("Demo password for all seed accounts is: password123");
                }}
              >
                Forgot?
              </a>
            </div>

            <div className="cal-input-with-icon">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="cal-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                className="cal-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="cal-btn-submit"
            disabled={loading}
          >
            {loading ? "Signing in…" : "Continue"}
          </button>
        </form>

        {/* Cal.com style bottom footer panel inside the card */}
        <div className="cal-card-footer">
          <a
            href={`${window.location.protocol}//localhost:${window.location.port || "3000"}`}
            className="cal-footer-link"
          >
            Agency Directory
          </a>
          <span className="cal-footer-dot">·</span>
          <span className="cal-footer-hint">Default password: password123</span>
        </div>
      </div>
    </div>
  );
}
