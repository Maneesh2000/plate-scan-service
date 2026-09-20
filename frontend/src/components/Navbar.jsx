import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import TenantLogo from "./TenantLogo.jsx";

const TENANT_NAMES = {
  "a0000000-0000-0000-0000-000000000001": "Alpha Recovery",
  "b0000000-0000-0000-0000-000000000002": "Beta Recovery",
};

export default function Navbar() {
  const { user, tenantInfo, subdomain, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const tenantDisplay =
    tenantInfo?.name ||
    TENANT_NAMES[user?.tenantId] ||
    (subdomain
      ? `${subdomain.charAt(0).toUpperCase() + subdomain.slice(1)} Recovery`
      : "PlateScan");

  return (
    <nav className="cal-navbar">
      <div className="cal-navbar-inner">
        <div className="cal-nav-left">
          <Link to="/" className="cal-nav-logo">
            <TenantLogo slug={subdomain} name={tenantDisplay} size={28} />
            <span className="cal-nav-tenant-name">{tenantDisplay}</span>
          </Link>
          {subdomain && (
            <div className="cal-tenant-badge">
              <span className="cal-tenant-dot"></span>
              <span>{subdomain}.localhost</span>
            </div>
          )}
        </div>

        <div className="cal-nav-right">
          <div className="cal-user-pill">
            <span className="cal-user-avatar">
              {user?.username?.charAt(0).toUpperCase()}
            </span>
            <span className="cal-user-name">{user?.username}</span>
            <span className="cal-user-role">({user?.role})</span>
          </div>

          <button
            className="cal-btn-signout"
            onClick={handleLogout}
            title="Sign out of this agency portal"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}
