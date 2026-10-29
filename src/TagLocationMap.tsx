import L, { type LeafletMouseEvent, type Map as LeafletMap, type Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

type TagLocationMapProps = {
  label: string;
  location?: [number, number] | null;
  onLocationChange: (latitude: number, longitude: number) => Promise<void>;
};

const DEFAULT_CENTER: L.LatLngExpression = [20.5937, 78.9629];

export function TagLocationMap({ label, location, onLocationChange }: TagLocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onLocationChangeRef = useRef(onLocationChange);
  onLocationChangeRef.current = onLocationChange;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialPosition: L.LatLngExpression = location ? [location[1], location[0]] : DEFAULT_CENTER;
    const map = L.map(containerRef.current, { zoomControl: true }).setView(initialPosition, location ? 16 : 4);
    mapRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    const pinIcon = L.divIcon({
      className: "tag-map-pin-wrapper",
      html: '<span class="tag-map-pin" aria-hidden="true"></span>',
      iconAnchor: [18, 36],
      iconSize: [36, 36],
    });

    const saveMarker = (latitude: number, longitude: number) => {
      if (!markerRef.current) {
        markerRef.current = L.marker([latitude, longitude], { draggable: true, icon: pinIcon, title: `${label} location` }).addTo(map);
        markerRef.current.on("dragend", () => {
          const position = markerRef.current!.getLatLng();
          void onLocationChangeRef.current(position.lat, position.lng);
        });
      } else {
        markerRef.current.setLatLng([latitude, longitude]);
      }
      void onLocationChangeRef.current(latitude, longitude);
    };

    if (location) {
      markerRef.current = L.marker(initialPosition, { draggable: true, icon: pinIcon, title: `${label} location` }).addTo(map);
      markerRef.current.on("dragend", () => {
        const position = markerRef.current!.getLatLng();
        void onLocationChangeRef.current(position.lat, position.lng);
      });
    }

    const handleMapClick = (event: LeafletMouseEvent) => saveMarker(event.latlng.lat, event.latlng.lng);
    map.on("click", handleMapClick);

    return () => {
      map.off("click", handleMapClick);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!location || !mapRef.current) return;
    const position = L.latLng(location[1], location[0]);
    markerRef.current?.setLatLng(position);
    if (!mapRef.current.getBounds().contains(position)) mapRef.current.panTo(position);
  }, [location]);

  return <div ref={containerRef} className="tag-map" role="application" aria-label={`${label} location map. Click the map or drag the pin to save a new location.`} />;
}
