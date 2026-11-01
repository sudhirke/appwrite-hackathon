import { Button } from "@/components/ui/button";
import { ChevronRight, ExternalLink, MapPin, QrCode } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PetScanHistoryMap } from "./PetScanHistoryMap";
import type { AuthUser } from "./lib/auth";
import type { Pet } from "./lib/pets";
import { listPetScans, type TagScan } from "./lib/scans";
import type { QRTag } from "./lib/tags";
import type { VetContact } from "./lib/vets";

type Props = {
  pet: Pet;
  tags: QRTag[];
  owner: AuthUser;
  vet?: VetContact | null;
  onSelectTag: (tag: QRTag) => void;
  liveScans?: TagScan[];
};

function relationId(value: QRTag | Pet | string | null | undefined) {
  return typeof value === "string" ? value : value?.$id;
}

function scanTagId(scan: TagScan) {
  return relationId(scan.tagId);
}

export function PetQrActivity({ pet, tags, owner, vet, onSelectTag, liveScans = [] }: Props) {
  const associatedTags = useMemo(() => tags.filter((tag) => relationId(tag.petId) === pet.$id), [tags, pet.$id]);
  const [scans, setScans] = useState<TagScan[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedTagId, setSelectedTagId] = useState("all");
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError("");
    setScans([]);
    setTotal(0);
    setSelectedTagId("all");
    setSelectedScanId(null);
    listPetScans(pet.$id)
      .then(({ rows, total: count }) => {
        if (!active) return;
        setScans(rows);
        setTotal(count);
        setSelectedScanId(rows.find((scan) => scan.location)?.$id ?? rows[0]?.$id ?? null);
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load QR scan activity."); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [pet.$id]);

  useEffect(() => {
    const matching = liveScans.filter((scan) => relationId(scan.petId) === pet.$id);
    if (!matching.length) return;
    setScans((current) => {
      const merged = [...matching, ...current.filter((scan) => !matching.some((item) => item.$id === scan.$id))]
        .sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());
      setTotal((count) => Math.max(count, merged.length));
      return merged;
    });
  }, [liveScans, pet.$id]);

  const filteredScans = useMemo(() => selectedTagId === "all" ? scans : scans.filter((scan) => scanTagId(scan) === selectedTagId), [scans, selectedTagId]);
  const locatedScans = useMemo(() => filteredScans.filter((scan) => scan.location), [filteredScans]);
  const selectedScan = filteredScans.find((scan) => scan.$id === selectedScanId);

  useEffect(() => {
    if (filteredScans.some((scan) => scan.$id === selectedScanId)) return;
    setSelectedScanId(filteredScans.find((scan) => scan.location)?.$id ?? filteredScans[0]?.$id ?? null);
  }, [filteredScans, selectedScanId]);

  async function loadMore() {
    const cursor = scans.at(-1)?.$id;
    if (!cursor) return;
    setIsLoadingMore(true);
    setError("");
    try {
      const page = await listPetScans(pet.$id, cursor);
      setScans((current) => [...current, ...page.rows.filter((row) => !current.some((item) => item.$id === row.$id))]);
      setTotal(page.total);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load older scans."); }
    finally { setIsLoadingMore(false); }
  }

  const mostRecent = scans[0];
  return (
    <section className="pet-qr-activity">
      <div className="pet-activity-heading"><div><p className="eyebrow">Smart identification</p><h2>QR tags & scan activity</h2><p>Track every tag linked to {pet.name} and review where it was scanned.</p></div></div>
      <div className="pet-activity-stats"><div><strong>{associatedTags.length}</strong><span>QR tags</span></div><div><strong>{total}</strong><span>Total scans</span></div><div><strong>{scans.filter((scan) => scan.location).length}</strong><span>Located scans shown</span></div><div><strong>{mostRecent ? new Date(mostRecent.scannedAt).toLocaleDateString() : "—"}</strong><span>Latest scan</span></div></div>

      {!associatedTags.length ? <div className="pet-activity-empty"><QrCode /><div><h3>No QR tags assigned</h3><p>Assign a QR tag to {pet.name} to begin collecting scan activity.</p></div></div> : <>
        <div className="pet-tag-list">
          {associatedTags.map((tag) => {
            const tagScans = scans.filter((scan) => scanTagId(scan) === tag.$id);
            return <article className={`pet-tag-summary tag-${tag.color}`} key={tag.$id}><span className="pet-tag-icon"><QrCode /></span><div><h3>{tag.label}</h3><p>{tag.location ? `${tag.location[1].toFixed(5)}, ${tag.location[0].toFixed(5)}` : "No tag location"}</p><small>{tagScans.length} loaded {tagScans.length === 1 ? "scan" : "scans"} · {tag.isActive ? "Active" : "Paused"}</small></div><button onClick={() => onSelectTag(tag)} aria-label={`Open ${tag.label}`}><ChevronRight /></button></article>;
          })}
        </div>

        <div className="pet-scan-card pet-info-card">
          <div className="pet-scan-toolbar"><div><h2>Scan history</h2><p>{selectedTagId === "all" ? "All associated tags" : associatedTags.find((tag) => tag.$id === selectedTagId)?.label}</p></div><div className="pet-scan-filters"><button className={selectedTagId === "all" ? "selected" : ""} onClick={() => setSelectedTagId("all")}>All tags</button>{associatedTags.map((tag) => <button key={tag.$id} className={selectedTagId === tag.$id ? "selected" : ""} onClick={() => setSelectedTagId(tag.$id)}>{tag.label}</button>)}</div></div>
          {error && <p className="home-error" role="alert">{error}</p>}
          {isLoading ? <p className="pet-scan-state">Loading scan activity…</p> : filteredScans.length ? <div className="pet-scan-layout">
            <div className="pet-scan-list">{filteredScans.map((scan) => { const tag = associatedTags.find((item) => item.$id === scanTagId(scan)); return <button key={scan.$id} className={selectedScanId === scan.$id ? "selected" : ""} onClick={() => setSelectedScanId(scan.$id)}><span className={`pet-scan-location-state${scan.location ? " located" : ""}`}><MapPin /></span><div><strong>{new Date(scan.scannedAt).toLocaleString()}</strong><small>{tag?.label || "QR tag"} · {scan.location ? `${scan.location[1].toFixed(5)}, ${scan.location[0].toFixed(5)}` : "Location not shared"}</small></div><ChevronRight /></button>; })}{scans.length < total && <Button variant="outline" onClick={loadMore} disabled={isLoadingMore} className="pet-scan-load-more">{isLoadingMore ? "Loading…" : "Load older scans"}</Button>}</div>
            <div className="pet-scan-map-panel">{locatedScans.length ? <PetScanHistoryMap scans={filteredScans} selectedScanId={selectedScanId} pet={pet} owner={owner} vet={vet} tags={associatedTags} onSelectScan={setSelectedScanId} /> : <div className="pet-scan-map-empty"><MapPin /><h3>No shared locations</h3><p>These scans were recorded without location permission.</p></div>}{selectedScan && !selectedScan.location && <p className="pet-scan-location-note">The selected scan did not include a location.</p>}{selectedScan?.location && <div className="pet-scan-map-meta"><span><MapPin /> {selectedScan.location[1].toFixed(6)}, {selectedScan.location[0].toFixed(6)}</span><a href={`https://www.openstreetmap.org/?mlat=${selectedScan.location[1]}&mlon=${selectedScan.location[0]}#map=16/${selectedScan.location[1]}/${selectedScan.location[0]}`} target="_blank" rel="noreferrer">Open map <ExternalLink /></a></div>}</div>
          </div> : <p className="pet-scan-state">No scans have been recorded for this selection yet.</p>}
        </div>
      </>}
    </section>
  );
}
