import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api";
import TrailMap from "../components/TrailMap.jsx";

function StatusBadge({ status }) {
  const configs = {
    pending_claim: {
      label: "Pending Claim",
      className: "badge-status-pending",
      dotClass: "dot-pending",
    },
    active: {
      label: "Active",
      className: "badge-status-active",
      dotClass: "dot-active",
    },
    closed: {
      label: "Closed",
      className: "badge-status-closed",
      dotClass: "dot-closed",
    },
  };
  const config = configs[status] || {
    label: status,
    className: "badge-muted",
    dotClass: "dot-muted",
  };

  return (
    <span className={`badge-status ${config.className}`}>
      <span className={`status-dot ${config.dotClass}`}></span>
      {config.label}
    </span>
  );
}

export default function CaseDetailPage() {
  const { caseId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [caseInfo, setCaseInfo] = useState(null);
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [copiedVin, setCopiedVin] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        // Fetch case info from cases endpoint
        const casesData = await api.getCases({ page: 1, pageSize: 100 });
        const found = (casesData.cases || []).find((c) => c.id === caseId);
        if (found) {
          setCaseInfo(found);
        }

        // Fetch scan trail
        const scansData = await api.getCaseScans(caseId);
        setScans(scansData || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [caseId]);

  const handleClaim = async () => {
    if (
      !window.confirm(
        `Are you sure you want to claim this case?\n\nIt will be assigned to your tenant (${user.username}) and marked as Active.`
      )
    )
      return;

    setClaiming(true);
    try {
      const result = await api.claimCase(caseId);
      setCaseInfo(result.case);
      // Refresh scan trail in case access changed
      const scansData = await api.getCaseScans(caseId);
      setScans(scansData || []);
    } catch (err) {
      alert(`Claim failed: ${err.message}`);
    } finally {
      setClaiming(false);
    }
  };

  const handleCopyVin = () => {
    if (caseInfo?.vin) {
      navigator.clipboard.writeText(caseInfo.vin);
      setCopiedVin(true);
      setTimeout(() => setCopiedVin(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="detail-loading-wrapper">
        <div className="spinner"></div>
        <p>Loading vehicle case & location trail…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="detail-container">
        <div className="breadcrumb-bar">
          <Link to="/" className="btn btn-outline btn-sm">
            ← Back to Cases
          </Link>
        </div>
        <div className="alert alert-error">
          <h3>Error Loading Case</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const isOwnClaim = caseInfo?.claimed_tenant_id === user?.tenantId;
  const isPending = caseInfo?.status === "pending_claim";

  return (
    <div className="detail-container">
      {/* Breadcrumb Navigation */}
      <div className="breadcrumb-bar">
        <Link to="/" className="btn btn-outline btn-sm">
          ← Back to Cases
        </Link>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-current">Case Details</span>
        {caseInfo && (
          <>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-vin">{caseInfo.vin}</span>
          </>
        )}
      </div>

      {/* Top Overview Card */}
      <div className="case-overview-card">
        <div className="overview-header">
          <div className="overview-title-section">
            <div className="overview-vin-row">
              <span className="overview-vin-label">VIN:</span>
              <span className="overview-vin-code">{caseInfo?.vin || "—"}</span>
              <button
                className={`btn btn-sm copy-btn ${copiedVin ? "copied" : ""}`}
                onClick={handleCopyVin}
                title="Copy VIN"
              >
                {copiedVin ? "✓ Copied" : "📋 Copy"}
              </button>
              {caseInfo && <StatusBadge status={caseInfo.status} />}
            </div>
            <div className="overview-meta-text">
              Case ID: <code>{caseId}</code> • First registered:{" "}
              {caseInfo ? new Date(caseInfo.created_at).toLocaleString() : "—"}
            </div>
          </div>

          {/* Action CTA */}
          <div className="overview-actions">
            {isPending && (
              <button
                className="btn btn-claim btn-lg"
                onClick={handleClaim}
                disabled={claiming}
              >
                {claiming ? "Claiming Case…" : "⚡ Claim Case for My Agency"}
              </button>
            )}
            {caseInfo?.status === "active" && (
              <div className="claimed-banner">
                {isOwnClaim ? (
                  <span className="banner-text own-banner">
                    ✅ Active recovery assigned to your tenant
                  </span>
                ) : (
                  <span className="banner-text">
                    🔒 Active recovery assigned to tenant {caseInfo.claimed_tenant_id?.slice(0, 8)}…
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="meta-stats-row">
          <div className="meta-stat-item">
            <span className="meta-stat-label">Total Sightings</span>
            <span className="meta-stat-value">{scans.length}</span>
          </div>
          <div className="meta-stat-item">
            <span className="meta-stat-label">Originating Tenant</span>
            <span className="meta-stat-value font-mono">
              {caseInfo?.originating_tenant_id?.slice(0, 8)}…
            </span>
          </div>
          <div className="meta-stat-item">
            <span className="meta-stat-label">Claimed By</span>
            <span className="meta-stat-value font-mono">
              {caseInfo?.claimed_tenant_id
                ? isOwnClaim
                  ? "🏢 Your Agency"
                  : `${caseInfo.claimed_tenant_id.slice(0, 8)}…`
                : "Unclaimed"}
            </span>
          </div>
          <div className="meta-stat-item">
            <span className="meta-stat-label">Assigned Agent</span>
            <span className="meta-stat-value">
              {caseInfo?.assigned_agent_id
                ? caseInfo.assigned_agent_id === user?.userId
                  ? "👤 You"
                  : `${caseInfo.assigned_agent_id.slice(0, 8)}…`
                : "None"}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Interactive Map + Sightings Timeline */}
      <div className="trail-layout-grid">
        {/* Left / Top: Interactive Map */}
        <div className="map-column">
          <TrailMap scans={scans} />
        </div>

        {/* Right / Bottom: Location Trail Timeline */}
        <div className="timeline-column">
          <div className="timeline-card">
            <div className="timeline-header">
              <h3>📍 Location Sighting History</h3>
              <span className="badge badge-info">{scans.length} events</span>
            </div>

            {scans.length === 0 ? (
              <div className="timeline-empty">
                <p className="text-muted">No sightings recorded for this VIN yet.</p>
              </div>
            ) : (
              <div className="timeline-feed">
                {scans.map((scan, index) => {
                  const isLatest = index === scans.length - 1;
                  return (
                    <div
                      key={scan.id}
                      className={`timeline-item ${isLatest ? "timeline-item-latest" : ""}`}
                    >
                      <div className="timeline-badge">
                        <span>#{index + 1}</span>
                      </div>

                      <div className="timeline-content">
                        <div className="timeline-top-row">
                          <div className="timeline-timestamp">
                            <strong>{new Date(scan.scanned_at).toLocaleString()}</strong>
                            {isLatest && (
                              <span className="tag-latest">Most Recent Sighting</span>
                            )}
                          </div>
                          {scan.plate && (
                            <span className="plate-pill">
                              🚗 <code>{scan.plate}</code>
                            </span>
                          )}
                        </div>

                        <div className="timeline-details-grid">
                          <div className="detail-entry">
                            <span className="detail-entry-label">Camera:</span>
                            <code>{scan.camera_id}</code>
                          </div>
                          <div className="detail-entry">
                            <span className="detail-entry-label">Coordinates:</span>
                            <span>
                              {scan.latitude !== null && scan.longitude !== null ? (
                                <a
                                  href={`https://www.google.com/maps?q=${scan.latitude},${scan.longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="coord-link"
                                >
                                  {scan.latitude.toFixed(4)}, {scan.longitude.toFixed(4)} ↗
                                </a>
                              ) : (
                                "—"
                              )}
                            </span>
                          </div>
                        </div>

                        {scan.image_url && (
                          <div className="timeline-image-preview">
                            <button
                              type="button"
                              className="photo-preview-btn"
                              onClick={() => setSelectedPhoto(scan.image_url)}
                            >
                              <img
                                src={scan.image_url}
                                alt={`Sighting ${index + 1}`}
                                className="photo-thumb"
                                onError={(e) => {
                                  e.target.style.display = "none";
                                }}
                              />
                              <span className="photo-label">📷 View camera capture</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Photo Lightbox Modal */}
      {selectedPhoto && (
        <div className="modal-overlay" onClick={() => setSelectedPhoto(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h4>Camera Capture Photo</h4>
              <button
                className="modal-close-btn"
                onClick={() => setSelectedPhoto(null)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <img src={selectedPhoto} alt="Camera capture" className="modal-photo" />
            </div>
            <div className="modal-footer">
              <a
                href={selectedPhoto}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-sm"
              >
                Open in new tab ↗
              </a>
              <button
                className="btn btn-sm"
                onClick={() => setSelectedPhoto(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
