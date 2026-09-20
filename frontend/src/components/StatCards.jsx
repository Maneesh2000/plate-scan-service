import React from "react";

export default function StatCards({ stats, activeFilter, onFilterChange }) {
  const cards = [
    {
      id: "",
      label: "Total Cases",
      value: stats.total,
      subtext: "Visible in tenant scope",
    },
    {
      id: "active",
      label: "Active Recoveries",
      value: stats.active,
      subtext: "In progress & assigned",
    },
    {
      id: "pending_claim",
      label: "Open to Claim",
      value: stats.pending,
      subtext: "Unclaimed across network",
    },
    {
      id: "closed",
      label: "Closed Cases",
      value: stats.closed,
      subtext: "Resolved repos",
    },
  ];

  return (
    <div className="cal-stats-grid">
      {cards.map((c) => {
        const isSelected = activeFilter === c.id;
        return (
          <div
            key={c.id}
            className={`cal-stat-card ${isSelected ? "cal-stat-card-selected" : ""}`}
            onClick={() => onFilterChange(c.id)}
            role="button"
            tabIndex={0}
            title={`Filter by ${c.label}`}
          >
            <div className="cal-stat-top">
              <span className="cal-stat-label">{c.label}</span>
              {isSelected && <span className="cal-stat-active-tag">Active</span>}
            </div>
            <div className="cal-stat-number">{c.value}</div>
            <div className="cal-stat-subtext">{c.subtext}</div>
          </div>
        );
      })}
    </div>
  );
}
