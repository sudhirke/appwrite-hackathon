import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

export function CompactScanMap({ location, label }: { location: [number, number]; label: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const position: L.LatLngExpression = [location[1], location[0]];
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: true, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false }).setView(position, 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    const icon = L.divIcon({ className: "scan-map-pin-shell", html: '<span class="scan-map-pin"></span>', iconSize: [30, 38], iconAnchor: [15, 34] });
    L.marker(position, { icon, title: label }).addTo(map);
    return () => { map.remove(); };
  }, [location, label]);

  return <div ref={containerRef} className="notification-map" aria-label={`${label} scan location`} />;
}
