import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export default function TrailMap({ scans }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Filter scans with coordinates
    const validScans = (scans || []).filter(
      (s) => typeof s.latitude === "number" && typeof s.longitude === "number"
    );

    if (validScans.length === 0) {
      return;
    }

    // Sort chronologically
    const sorted = [...validScans].sort(
      (a, b) => new Date(a.scanned_at) - new Date(b.scanned_at)
    );

    // Initialize map with CartoDB Positron (clean black and white tiles)
    if (!mapInstanceRef.current) {
      const initialCenter = [sorted[0].latitude, sorted[0].longitude];
      const map = L.map(mapRef.current, {
        center: initialCenter,
        zoom: 12,
        scrollWheelZoom: false,
      });

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        }
      ).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Clear existing marker layers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) {
        map.removeLayer(layer);
      }
    });

    const latLngs = sorted.map((s) => [s.latitude, s.longitude]);

    // Draw route trajectory polyline in solid black
    if (latLngs.length > 1) {
      L.polyline(latLngs, {
        color: "#111827",
        weight: 3,
        opacity: 0.85,
        dashArray: "6, 6",
      }).addTo(map);
    }

    // Add numbered pin markers in monochrome style
    sorted.forEach((scan, index) => {
      const isLatest = index === sorted.length - 1;
      const pinHtml = `
        <div class="cal-map-pin ${isLatest ? "cal-map-pin-latest" : ""}">
          <span>${index + 1}</span>
        </div>
      `;

      const customIcon = L.divIcon({
        className: "custom-div-icon",
        html: pinHtml,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        popupAnchor: [0, -13],
      });

      const popupContent = `
        <div class="cal-popup-card">
          <div class="cal-popup-header">
            <strong>Sighting #${index + 1}</strong>
            ${isLatest ? '<span class="cal-popup-tag">Latest</span>' : ""}
          </div>
          <div class="cal-popup-body">
            <div><strong>Time:</strong> ${new Date(scan.scanned_at).toLocaleString()}</div>
            <div><strong>Plate:</strong> <code>${scan.plate || "—"}</code></div>
            <div><strong>Camera:</strong> <code>${scan.camera_id}</code></div>
            <div><strong>Coords:</strong> ${scan.latitude.toFixed(4)}, ${scan.longitude.toFixed(4)}</div>
            ${
              scan.image_url
                ? `<div class="cal-popup-thumb"><img src="${scan.image_url}" alt="Capture photo" onerror="this.style.display='none'"/></div>`
                : ""
            }
          </div>
        </div>
      `;

      L.marker([scan.latitude, scan.longitude], { icon: customIcon })
        .addTo(map)
        .bindPopup(popupContent);
    });

    // Fit bounds so all points are visible
    if (latLngs.length > 0) {
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [scans]);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const hasCoords = (scans || []).some(
    (s) => typeof s.latitude === "number" && typeof s.longitude === "number"
  );

  if (!hasCoords) {
    return (
      <div className="cal-map-empty">
        <div className="cal-map-empty-icon">🗺️</div>
        <h4>No GPS Coordinates Available</h4>
        <p className="cal-text-muted">Sightings for this VIN do not contain latitude/longitude data.</p>
      </div>
    );
  }

  return (
    <div className="cal-map-wrapper">
      <div className="cal-map-header">
        <div className="cal-map-title">
          <span>Route Trajectory Map</span>
          <span className="cal-badge-pill">
            {scans.length} {scans.length === 1 ? "sighting" : "waypoints"}
          </span>
        </div>
        <div className="cal-map-legend">
          <span className="cal-legend-item">
            <span className="cal-legend-dot dot-normal"></span> Prior
          </span>
          <span className="cal-legend-item">
            <span className="cal-legend-dot dot-latest"></span> Latest
          </span>
        </div>
      </div>
      <div ref={mapRef} className="cal-leaflet-map" />
    </div>
  );
}
