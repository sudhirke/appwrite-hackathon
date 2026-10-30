import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { AuthUser } from "./lib/auth";
import type { Pet } from "./lib/pets";
import type { VetContact } from "./lib/vets";

type Props = {
  location: [number, number];
  pet?: Pet;
  owner: AuthUser;
  vet?: VetContact | null;
};

function infoCard(pet: Pet | undefined, owner: AuthUser, vet?: VetContact | null) {
  const card = document.createElement("article");
  card.className = "scan-map-info";
  const title = document.createElement("strong");
  title.textContent = pet?.name || "QR tag scanned";
  const ownerLine = document.createElement("span");
  ownerLine.textContent = `Owner: ${owner.name || owner.email}`;
  card.append(title, ownerLine);
  if (vet) {
    const vetLine = document.createElement("span");
    vetLine.textContent = `Vet: ${vet.name}${vet.clinic ? ` · ${vet.clinic}` : ""} · ${vet.phone}`;
    card.append(vetLine);
  }
  return card;
}

export function ScanLocationMap({ location, pet, owner, vet }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const position: L.LatLngExpression = [location[1], location[0]];
    const map = L.map(containerRef.current, { zoomControl: true }).setView(position, 16);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    const icon = L.divIcon({ className: "scan-map-pin-shell", html: '<span class="scan-map-pin"></span>', iconSize: [34, 42], iconAnchor: [17, 38] });
    L.marker(position, { icon }).addTo(map).bindTooltip(infoCard(pet, owner, vet), { permanent: true, direction: "top", offset: [0, -34], opacity: 1, className: "scan-map-tooltip" });
    return () => { map.remove(); };
  }, [location, pet, owner, vet]);

  return <div ref={containerRef} className="scan-location-map" aria-label="Selected scan location" />;
}
