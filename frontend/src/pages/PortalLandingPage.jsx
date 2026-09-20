import React from "react";
import TenantLogo from "../components/TenantLogo.jsx";

export default function PortalLandingPage() {
  const port = window.location.port ? `:${window.location.port}` : "";
  const alphaUrl = `${window.location.protocol}//alpha.localhost${port}`;
  const betaUrl = `${window.location.protocol}//beta.localhost${port}`;

  return (
    <div className="cal-landing-page">
      {/* Top Cal.com Minimalist Header */}
      <header className="cal-top-nav">
        <div className="cal-top-nav-inner">
          <div className="cal-nav-brand">
            <TenantLogo slug="" size={28} />
            <span>PlateScan.com</span>
          </div>
          <div className="cal-nav-links">
            <span className="cal-nav-pill">Enterprise v1.0</span>
          </div>
        </div>
      </header>

      {/* Main Hero Container */}
      <main className="cal-hero-section">
        <div className="cal-hero-pill-announcement">
          <span>Multi-Tenant Recovery Platform</span>
        </div>

        <h1 className="cal-hero-title">
          The better way to manage vehicle recovery
        </h1>

        <p className="cal-hero-subtitle">
          Real-time license plate & VIN ingestion, camera attribution, and
          cross-tenant repossession claiming on dedicated agency subdomains.
        </p>

        {/* Agency Selection Cards */}
        <div className="cal-agency-grid">
          {/* Alpha Recovery Card */}
          <div className="cal-agency-card">
            <div className="cal-agency-card-header">
              <TenantLogo slug="alpha" name="Alpha Recovery" size={44} />
              <div className="cal-agency-badge">Agency A</div>
            </div>
            <h2 className="cal-agency-title">Alpha Recovery</h2>
            <p className="cal-agency-text">
              Assigned truck camera <code>cam_1001</code>. Access active cases, historical sighting trails, and agency dispatch.
            </p>
            <div className="cal-subdomain-pill">
              <code>http://alpha.localhost{port}</code>
            </div>
            <a href={alphaUrl} className="cal-btn-black">
              Enter Alpha Portal →
            </a>
          </div>

          {/* Beta Recovery Card */}
          <div className="cal-agency-card">
            <div className="cal-agency-card-header">
              <TenantLogo slug="beta" name="Beta Recovery" size={44} />
              <div className="cal-agency-badge">Agency B</div>
            </div>
            <h2 className="cal-agency-title">Beta Recovery</h2>
            <p className="cal-agency-text">
              Assigned truck camera <code>cam_2050</code>. Ingest inbound plate sightings and claim available pending recovery cases.
            </p>
            <div className="cal-subdomain-pill">
              <code>http://beta.localhost{port}</code>
            </div>
            <a href={betaUrl} className="cal-btn-black">
              Enter Beta Portal →
            </a>
          </div>
        </div>

        <div className="cal-landing-footer-note">
          <span>
            Browsers automatically route all <code>*.localhost</code> subdomains to your local server without any DNS configuration (RFC 6761).
          </span>
        </div>
      </main>
    </div>
  );
}
