import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { AuthUser } from "./lib/auth";
import type { Pet } from "./lib/pets";
import type { TagScan } from "./lib/scans";
import type { QRTag } from "./lib/tags";
import type { VetContact } from "./lib/vets";

type Props = {
  scans: TagScan[];
  selectedScanId: string | null;
  pet: Pet;
  owner: AuthUser;
  vet?: VetContact | null;
  tags: QRTag[];
  onSelectScan: (scanId: string) => void;
};

function scanTagId(scan: TagScan) {
  return typeof scan.tagId === "string" ? scan.tagId : scan.tagId?.$id;
}

function infoCard(scan: TagScan, pet: Pet, owner: AuthUser, vet: VetContact | null | undefined, tag?: QRTag) {
  const card = document.createElement("article");
  card.className = "pet-scan-map-info";
  const title = document.createElement("strong");
  title.textContent = pet.name;
  const tagLine = document.createElement("span");
  tagLine.textContent = `Tag: ${tag?.label || "QR tag"}`;
  const time = document.createElement("span");
  time.textContent = `Scanned: ${new Date(scan.scannedAt).toLocaleString()}`;
  const ownerLine = document.createElement("span");
  ownerLine.textContent = `Owner: ${owner.name || owner.email}`;
  card.append(title, tagLine, time, ownerLine);
  if (vet) {
    const vetLine = document.createElement("span");
    vetLine.textContent = `Vet: ${vet.name}${vet.clinic ? ` · ${vet.clinic}` : ""} · ${vet.phone}`;
    card.append(vetLine);
  }
  return card;
}

export function PetScanHistoryMap({ scans, selectedScanId, pet, owner, vet, tags, onSelectScan }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef(onSelectScan);
  selectRef.current = onSelectScan;

  useEffect(() => {
    if (!containerRef.current) return;
    const located = scans.filter((scan): scan is TagScan & { location: [number, number] } => Boolean(scan.location));
    const map = L.map(containerRef.current, { zoomControl: true }).setView([20.5937, 78.9629], 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    const bounds: L.LatLngExpression[] = [];
    let selectedPosition: L.LatLngExpression | undefined;

    for (const scan of located) {
      const position: L.LatLngExpression = [scan.location[1], scan.location[0]];
      const selected = scan.$id === selectedScanId;
      bounds.push(position);
      if (selected) selectedPosition = position;
      const icon = L.divIcon({
        className: "pet-scan-pin-shell",
        html: `<span class="pet-scan-pin${selected ? " selected" : ""}"></span>`,
        iconSize: [32, 40],
        iconAnchor: [16, 36],
      });
      const tagId = scanTagId(scan);
      const tag = tags.find((item) => item.$id === tagId) ?? (typeof scan.tagId === "object" && scan.tagId ? scan.tagId : undefined);
      const marker = L.marker(position, { icon, title: `${pet.name} scan` }).addTo(map);
      marker.bindTooltip(infoCard(scan, pet, owner, vet, tag), { direction: "top", offset: [0, -30], opacity: 1, className: "pet-scan-map-tooltip" });
      marker.on("click", () => selectRef.current(scan.$id));
      if (selected) marker.openTooltip();
    }

    if (selectedPosition) map.setView(selectedPosition, 16);
    else if (bounds.length === 1) map.setView(bounds[0]!, 15);
    else if (bounds.length > 1) map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 15 });
    return () => { map.remove(); };
  }, [scans, selectedScanId, pet, owner, vet, tags]);

  return <div ref={containerRef} className="pet-scan-history-map" aria-label={`${pet.name} QR scan locations`} />;
}
