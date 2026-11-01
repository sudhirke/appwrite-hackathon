import { Bell, CheckCheck, ChevronRight, MapPin, X } from "lucide-react";
import type { Pet } from "./lib/pets";
import type { TagScan } from "./lib/scans";
import type { QRTag } from "./lib/tags";
import { CompactScanMap } from "./CompactScanMap";

type Props = {
  scans: TagScan[];
  unreadIds: Set<string>;
  isOpen: boolean;
  liveScan: TagScan | null;
  connectionState: "connecting" | "connected" | "disconnected" | "error";
  pets: Pet[];
  tags: QRTag[];
  onClose: () => void;
  onDismissLive: () => void;
  onMarkAllRead: () => void;
  onOpenPet: (pet: Pet) => void;
  onOpenTag: (tag: QRTag) => void;
};

function relationId(value: Pet | QRTag | string | null | undefined) {
  return typeof value === "string" ? value : value?.$id;
}

export function NotificationCenter({ scans, unreadIds, isOpen, liveScan, connectionState, pets, tags, onClose, onDismissLive, onMarkAllRead, onOpenPet, onOpenTag }: Props) {
  const resolvePet = (scan: TagScan) => pets.find((pet) => pet.$id === relationId(scan.petId)) ?? (typeof scan.petId === "object" ? scan.petId : undefined);
  const resolveTag = (scan: TagScan) => tags.find((tag) => tag.$id === relationId(scan.tagId)) ?? (typeof scan.tagId === "object" ? scan.tagId : undefined);
  const livePet = liveScan ? resolvePet(liveScan) : undefined;
  const liveTag = liveScan ? resolveTag(liveScan) : undefined;

  return <>
    {isOpen && <button className="notification-backdrop" onClick={onClose} aria-label="Close notifications" />}
    <aside className={`notification-panel${isOpen ? " open" : ""}`} aria-hidden={!isOpen} aria-label="Notifications">
      <header><div><p className="eyebrow">Live activity</p><h2>Notifications</h2></div><button className="notification-close" onClick={onClose} aria-label="Close notifications"><X /></button></header>
      <div className="notification-actions"><span className={`realtime-state ${connectionState}`}>{connectionState === "connected" ? "Live" : connectionState === "connecting" ? "Connecting…" : "Reconnecting…"}</span><button onClick={onMarkAllRead}><CheckCheck /> Mark all read</button></div>
      <div className="notification-list">
        {scans.length ? scans.map((scan) => {
          const pet = resolvePet(scan); const tag = resolveTag(scan);
          return <article key={scan.$id} className={unreadIds.has(scan.$id) ? "unread" : ""}>
            <span className="notification-location"><MapPin /></span><div><strong>{pet?.status === "missing" || scan.petStatusAtScan === "missing" ? `Possible sighting of ${pet?.name || "your missing pet"}` : `${pet?.name || "A pet"}’s tag was scanned`}</strong><small>{tag?.label || "QR tag"} · {new Date(scan.scannedAt).toLocaleString()}</small><p>{scan.location ? `${scan.location[1].toFixed(5)}, ${scan.location[0].toFixed(5)}` : "Location was not shared"}</p><div className="notification-links">{pet && <button onClick={() => onOpenPet(pet)}>View pet <ChevronRight /></button>}{tag && <button onClick={() => onOpenTag(tag)}>View tag <ChevronRight /></button>}</div></div>
          </article>;
        }) : <div className="notification-empty"><Bell /><p>No QR scans yet.</p></div>}
      </div>
    </aside>
    {liveScan && <section className="live-scan-alert" role="alert" aria-live="assertive">
      <header><div><p className="eyebrow">Missing pet alert</p><h2>Possible sighting of {livePet?.name || "your pet"}</h2></div><button onClick={onDismissLive} aria-label="Dismiss alert"><X /></button></header>
      <p>{liveTag?.label || "A QR tag"} was scanned {liveScan.location ? "at this location" : "without sharing a location"}.</p>
      {liveScan.location && <><CompactScanMap location={liveScan.location} label={livePet?.name || "Missing pet"} /><a href={`https://www.openstreetmap.org/?mlat=${liveScan.location[1]}&mlon=${liveScan.location[0]}#map=16/${liveScan.location[1]}/${liveScan.location[0]}`} target="_blank" rel="noreferrer"><MapPin /> Open larger map</a></>}
      <div className="live-scan-actions">{livePet && <button onClick={() => onOpenPet(livePet)}>View pet</button>}{liveTag && <button onClick={() => onOpenTag(liveTag)}>View QR tag</button>}</div>
    </section>}
  </>;
}
