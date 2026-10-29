import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { AuthUser } from "./lib/auth";
import type { Pet } from "./lib/pets";
import type { QRTag } from "./lib/tags";

type TagsOverviewMapProps = {
  tags: QRTag[];
  pets: Pet[];
  owner: AuthUser;
  onSelectTag: (tag: QRTag) => void;
};

function markerContent(pet?: Pet) {
  const root = document.createElement("div");
  root.className = `overview-map-pin${pet?.status === "missing" ? " missing" : ""}`;
  const center = document.createElement("span");
  center.textContent = pet?.status === "missing" ? "!" : "";
  root.append(center);
  if (pet?.status === "missing") {
    const flag = document.createElement("b");
    flag.className = "overview-missing-flag";
    flag.textContent = "⚑";
    flag.title = "Missing pet";
    root.append(flag);
  }
  return root;
}

function tooltipContent(tag: QRTag, pet: Pet | undefined, owner: AuthUser) {
  const card = document.createElement("article");
  card.className = "overview-map-card";

  const header = document.createElement("div");
  header.className = "overview-map-card-header";
  if (pet?.photoUrl) {
    const image = document.createElement("img");
    image.src = pet.photoUrl;
    image.alt = "";
    header.append(image);
  } else {
    const avatar = document.createElement("span");
    avatar.textContent = "🐾";
    header.append(avatar);
  }
  const heading = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = pet?.name || tag.label;
  const subtitle = document.createElement("small");
  subtitle.textContent = pet ? [pet.breed, pet.color].filter(Boolean).join(" · ") || tag.label : "Unassigned QR tag";
  heading.append(title, subtitle);
  header.append(heading);
  card.append(header);

  if (pet?.status === "missing") {
    const alert = document.createElement("p");
    alert.className = "overview-map-alert";
    const lastSeen = pet.lastSeenAt ? ` Last seen ${new Date(pet.lastSeenAt).toLocaleString()}.` : "";
    alert.textContent = `⚑ Missing pet.${lastSeen}`;
    card.append(alert);
  }

  const ownerLine = document.createElement("p");
  ownerLine.className = "overview-map-owner";
  const ownerName = document.createElement("strong");
  ownerName.textContent = owner.name || "Pet owner";
  const ownerEmail = document.createElement("span");
  ownerEmail.textContent = owner.email;
  ownerLine.append("Owner: ", ownerName, ownerEmail);
  card.append(ownerLine);
  return card;
}

export function TagsOverviewMap({ tags, pets, owner, onSelectTag }: TagsOverviewMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef(onSelectTag);
  selectRef.current = onSelectTag;

  useEffect(() => {
    if (!containerRef.current) return;
    const locatedTags = tags.filter((tag): tag is QRTag & { location: [number, number] } => Boolean(tag.location));
    const map = L.map(containerRef.current).setView([20.5937, 78.9629], 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    const bounds: L.LatLngExpression[] = [];
    for (const tag of locatedTags) {
      const petId = typeof tag.petId === "string" ? tag.petId : tag.petId?.$id;
      const pet = pets.find((item) => item.$id === petId) ?? (tag.petId && typeof tag.petId === "object" ? tag.petId : undefined);
      const position: L.LatLngExpression = [tag.location[1], tag.location[0]];
      bounds.push(position);
      const icon = L.divIcon({ className: "overview-map-pin-shell", html: markerContent(pet), iconSize: [34, 42], iconAnchor: [17, 38] });
      const marker = L.marker(position, { icon, title: pet?.name || tag.label }).addTo(map);
      marker.bindTooltip(tooltipContent(tag, pet, owner), { direction: "top", offset: [0, -52], opacity: 1, className: "overview-map-tooltip" });
      marker.on("mouseover", () => marker.openTooltip());
      marker.on("mouseout", () => marker.closeTooltip());
      marker.on("click", () => selectRef.current(tag));
    }
    if (bounds.length === 1) map.setView(bounds[0]!, 15);
    else if (bounds.length > 1) map.fitBounds(L.latLngBounds(bounds), { padding: [55, 55], maxZoom: 15 });

    return () => { map.remove(); };
  }, [tags, pets, owner]);

  return <div ref={containerRef} className="overview-map" aria-label="Map of QR tag locations" />;
}
