import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api";
import StatCards from "../components/StatCards.jsx";
import Pagination from "../components/Pagination.jsx";

const TABS = [
  { id: "", label: "All Cases" },
  { id: "active", label: "Active" },
  { id: "pending_claim", label: "Pending Claim" },
  { id: "closed", label: "Closed" },
];

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

function timeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

export default function CasesPage() {
  const { user } = useAuth();
  const [cases, setCases] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [claimingId, setClaimingId] = useState(null);
  const [copiedVin, setCopiedVin] = useState(null);

  // Overall KPI stats
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    pending: 0,
    closed: 0,
  });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // Reset to page 1 on search change
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch KPI counts across all categories
  const fetchStats = useCallback(async () => {
    try {
      const data = await api.getCases({ page: 1, pageSize: 100 });
      const allCases = data.cases || [];
      const totalCount = data.total;
      let activeCount = 0;
      let pendingCount = 0;
      let closedCount = 0;

      allCases.forEach((c) => {
        if (c.status === "active") activeCount++;
        else if (c.status === "pending_claim") pendingCount++;
        else if (c.status === "closed") closedCount++;
      });

      setStats({
        total: totalCount,
        active: activeCount,
        pending: pendingCount,
        closed: closedCount,
      });
    } catch {
      // Ignore background stats failure
    }
  }, []);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.getCases({
        page,
        pageSize,
        status: statusFilter || undefined,
        search: debouncedSearch || undefined,
      });
      setCases(data.cases || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, debouncedSearch]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleFilterChange = (newStatus) => {
    setStatusFilter(newStatus);
    setPage(1);
  };

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    setPage(1);
  };

  const handleClaim = async (caseId, vin) => {
    const confirmMsg = `Are you sure you want to claim case for VIN: ${vin}?\n\nThis will assign the case to your tenant (${user.username}) and set status to Active.`;
    if (!window.confirm(confirmMsg)) return;

    setClaimingId(caseId);
    try {
      await api.claimCase(caseId);
      await Promise.all([fetchCases(), fetchStats()]);
    } catch (err) {
      alert(`Claim failed: ${err.message}`);
    } finally {
      setClaimingId(null);
    }
  };

  const handleCopyVin = (vin, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(vin);
    setCopiedVin(vin);
    setTimeout(() => setCopiedVin(null), 1800);
  };

  const isOwnCase = (c) =>
    c.originating_tenant_id === user?.tenantId ||
    c.claimed_tenant_id === user?.tenantId;

  return (
    <div className="cases-page">
      {/* KPI Cards */}
      <StatCards
        stats={stats}
        activeFilter={statusFilter}
        onFilterChange={handleFilterChange}
      />

      {/* Main Section Card */}
      <div className="table-card">
        {/* Header & Controls Toolbar */}
        <div className="table-toolbar">
          {/* Filter Pills / Tabs */}
          <div className="filter-tabs">
            {TABS.map((tab) => {
              const count =
                tab.id === ""
                  ? stats.total
                  : tab.id === "active"
                  ? stats.active
                  : tab.id === "pending_claim"
                  ? stats.pending
                  : stats.closed;
              return (
                <button
                  key={tab.id}
                  className={`tab-btn ${statusFilter === tab.id ? "tab-btn-active" : ""}`}
                  onClick={() => handleFilterChange(tab.id)}
                >
                  <span>{tab.label}</span>
                  {count > 0 && <span className="tab-badge">{count}</span>}
                </button>
              );
            })}
          </div>

          {/* Search & Actions */}
          <div className="toolbar-actions">
            <div className="search-input-wrapper">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                className="search-input"
                placeholder="Search VIN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  className="search-clear-btn"
                  onClick={() => setSearchQuery("")}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              className="btn btn-outline btn-refresh"
              onClick={() => {
                fetchCases();
                fetchStats();
              }}
              title="Refresh cases"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {/* Table / List */}
        {loading ? (
          <div className="skeleton-table">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton-row">
                <div className="skeleton-cell w-30"></div>
                <div className="skeleton-cell w-20"></div>
                <div className="skeleton-cell w-20"></div>
                <div className="skeleton-cell w-15"></div>
                <div className="skeleton-cell w-15"></div>
              </div>
            ))}
          </div>
        ) : cases.length === 0 ? (
          <div className="table-empty-state">
            <div className="empty-state-icon">🔎</div>
            <h3>No cases found</h3>
            <p className="text-muted">
              {debouncedSearch
                ? `No recovery cases match the query "${debouncedSearch}".`
                : statusFilter
                ? `No cases currently in "${statusFilter}" status.`
                : "No cases are available right now."}
            </p>
            {(debouncedSearch || statusFilter) && (
              <button
                className="btn btn-outline btn-sm"
                style={{ marginTop: "1rem" }}
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("");
                  setPage(1);
                }}
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Vehicle Identification (VIN)</th>
                  <th>Case Status</th>
                  <th>Tenant Scope</th>
                  <th>Created</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => {
                  const own = isOwnCase(c);
                  return (
                    <tr key={c.id} className="case-row">
                      {/* VIN Column */}
                      <td>
                        <div className="vin-cell">
                          <Link to={`/cases/${c.id}`} className="vin-code">
                            {c.vin}
                          </Link>
                          <button
                            className={`copy-vin-btn ${copiedVin === c.vin ? "copied" : ""}`}
                            onClick={(e) => handleCopyVin(c.vin, e)}
                            title="Copy VIN to clipboard"
                          >
                            {copiedVin === c.vin ? "✓ Copied" : "📋 Copy"}
                          </button>
                        </div>
                      </td>

                      {/* Status Column */}
                      <td>
                        <StatusBadge status={c.status} />
                      </td>

                      {/* Tenant Scope Column */}
                      <td>
                        {own ? (
                          <span className="tenant-chip tenant-chip-own" title="Belongs to your tenant">
                            🏢 Your Tenant
                          </span>
                        ) : (
                          <span className="tenant-chip tenant-chip-external" title="Open case from external tenant camera">
                            🌐 Other Tenant
                          </span>
                        )}
                      </td>

                      {/* Created Column */}
                      <td>
                        <div className="date-cell">
                          <span className="date-relative">{timeAgo(c.created_at)}</span>
                          <span className="date-absolute">
                            {new Date(c.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </td>

                      {/* Actions Column */}
                      <td className="text-right">
                        <div className="row-actions">
                          {c.status === "pending_claim" && (
                            <button
                              className="btn btn-sm btn-claim"
                              onClick={() => handleClaim(c.id, c.vin)}
                              disabled={claimingId === c.id}
                              title="Claim this case for your recovery agency"
                            >
                              {claimingId === c.id ? "Claiming…" : "⚡ Claim Case"}
                            </button>
                          )}
                          <Link
                            to={`/cases/${c.id}`}
                            className="btn btn-sm btn-outline view-details-btn"
                          >
                            Details →
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
          onPageChange={(p) => setPage(p)}
          onPageSizeChange={handlePageSizeChange}
        />
      </div>
    </div>
  );
}
