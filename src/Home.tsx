import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Bell, Bone, CalendarDays, ChevronRight, ExternalLink, Heart, LogOut, Map as MapIcon, MapPin, PawPrint, Pencil, Phone, Plus, QrCode, ShoppingBag, Sparkles, Stethoscope, Trash2, Upload, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import type { AuthUser } from "./lib/auth";
import { createPet, deletePet, listPets, updatePet, updatePetVetContact, uploadPetPhoto, type NewPet, type Pet } from "./lib/pets";
import { createVetContact, deleteVetContact, listVetContacts, type VetContact } from "./lib/vets";
import { QRCodeImage } from "./QRCodeImage";
import { ScanLocationMap } from "./ScanLocationMap";
import { TagLocationMap } from "./TagLocationMap";
import { TagsOverviewMap } from "./TagsOverviewMap";
import { listTagScans, type TagScan } from "./lib/scans";
import { assignTag, createTag, deleteTag, listTags, setTagActive, updateTagLocation, TAG_COLORS, type QRTag, type TagColor } from "./lib/tags";

type HomeProps = { user: AuthUser; onSignOut: () => Promise<void> };

export function Home({ user, onSignOut }: HomeProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isAddingPet, setIsAddingPet] = useState(false);
  const [isSavingPet, setIsSavingPet] = useState(false);
  const [isLoadingPets, setIsLoadingPets] = useState(true);
  const [pets, setPets] = useState<Pet[]>([]);
  const [petError, setPetError] = useState("");
  const [editingPet, setEditingPet] = useState<Pet | null>(null);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [vetContacts, setVetContacts] = useState<VetContact[]>([]);
  const [selectedVet, setSelectedVet] = useState<VetContact | null>(null);
  const [isAddingVet, setIsAddingVet] = useState(false);
  const [isSavingVet, setIsSavingVet] = useState(false);
  const [vetError, setVetError] = useState("");
  const [tags, setTags] = useState<QRTag[]>([]);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [isSavingTag, setIsSavingTag] = useState(false);
  const [selectedTag, setSelectedTag] = useState<QRTag | null>(null);
  const [tagError, setTagError] = useState("");
  const [isSavingTagLocation, setIsSavingTagLocation] = useState(false);
  const [isMapView, setIsMapView] = useState(false);
  const [tagScans, setTagScans] = useState<TagScan[]>([]);
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const [isLoadingScans, setIsLoadingScans] = useState(false);
  const firstName = user.name?.trim().split(/\s+/)[0] || "friend";

  useEffect(() => {
    listPets(user.$id)
      .then(setPets)
      .catch((error) => setPetError(error instanceof Error ? error.message : "Could not load your pets."))
      .finally(() => setIsLoadingPets(false));
  }, [user.$id]);

  useEffect(() => {
    listTags(user.$id).then(setTags).catch((error) => setTagError(error instanceof Error ? error.message : "Could not load QR tags."));
  }, [user.$id]);

  useEffect(() => {
    listVetContacts(user.$id)
      .then(setVetContacts)
      .catch((error) => setVetError(error instanceof Error ? error.message : "Could not load vet contacts."));
  }, [user.$id]);

  useEffect(() => {
    document.title = isMapView ? "Locate your furry babies · Pets Heaven" : "Pets Heaven";
  }, [isMapView]);

  useEffect(() => {
    if (!selectedTag) { setTagScans([]); setSelectedScanId(null); return; }
    let active = true;
    setIsLoadingScans(true);
    listTagScans(selectedTag.$id)
      .then((scans) => {
        if (!active) return;
        setTagScans(scans);
        setSelectedScanId(scans.find((scan) => scan.location)?.$id ?? null);
      })
      .catch((error) => { if (active) setTagError(error instanceof Error ? error.message : "Could not load scan history."); })
      .finally(() => { if (active) setIsLoadingScans(false); });
    return () => { active = false; };
  }, [selectedTag?.$id]);

  async function handleSignOut() {
    setIsSigningOut(true);
    try { await onSignOut(); } finally { setIsSigningOut(false); }
  }

  async function addPet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const birthDate = String(data.get("birthDate"));
    const lastSeenAt = String(data.get("lastSeenAt"));
    const latitude = String(data.get("latitude"));
    const longitude = String(data.get("longitude"));
    const photos = data.getAll("photos").filter((value): value is File => value instanceof File && value.size > 0);
    const nextPet: NewPet = {
      name: String(data.get("name")),
      breed: String(data.get("breed")),
      color: String(data.get("color")),
      birthDate: birthDate ? new Date(`${birthDate}T00:00:00`).toISOString() : undefined,
      microchipId: String(data.get("microchipId")),
      status: String(data.get("status")) as Pet["status"],
      lastSeenAt: lastSeenAt ? new Date(lastSeenAt).toISOString() : undefined,
      lastKnownLocation: latitude && longitude ? [Number(longitude), Number(latitude)] : undefined,
      publicFlags: { showName: data.get("showName") === "on" },
    };

    setIsSavingPet(true);
    setPetError("");
    try {
      if (photos.length > 3) throw new Error("You can upload up to 3 pet photos.");
      for (const photo of photos) {
        if (photo.size > 10 * 1024 * 1024) throw new Error("Each pet photo must be 10 MB or smaller.");
        if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(photo.type)) throw new Error("Choose JPG, PNG, WebP, or GIF images.");
      }
      const photoUrls = await Promise.all(photos.map((photo) => uploadPetPhoto(user.$id, photo)));
      nextPet.photoUrls = photoUrls;
      nextPet.photoUrl = photoUrls[0];
      const created = await createPet(user.$id, nextPet);
      setPets((current) => [created, ...current]);
      setIsAddingPet(false);
      form.reset();
    } catch (error) {
      setPetError(error instanceof Error ? error.message : "Could not save your pet.");
    } finally {
      setIsSavingPet(false);
    }
  }

  async function removePet(id: string) {
    setPetError("");
    try {
      await deletePet(id);
      setPets((current) => current.filter((pet) => pet.$id !== id));
    } catch (error) {
      setPetError(error instanceof Error ? error.message : "Could not remove your pet.");
    }
  }

  async function savePetEdits(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingPet) return;
    const data = new FormData(event.currentTarget);
    const photo = data.get("photo");
    const birthDate = String(data.get("birthDate"));
    setIsSavingPet(true);
    setPetError("");
    try {
      let photoUrl = editingPet.photoUrl;
      let photoUrls = getPetPhotos(editingPet);
      if (photo instanceof File && photo.size > 0) {
        if (photo.size > 10 * 1024 * 1024) throw new Error("Profile pictures must be 10 MB or smaller.");
        if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(photo.type)) throw new Error("Choose a JPG, PNG, WebP, or GIF image.");
        photoUrl = await uploadPetPhoto(user.$id, photo);
        photoUrls = [photoUrl, ...photoUrls.filter((url) => url !== photoUrl)].slice(0, 3);
      }
      const updated = await updatePet(editingPet.$id, {
        name: String(data.get("name")).trim(),
        breed: String(data.get("breed")).trim(),
        color: String(data.get("color")).trim(),
        birthDate: birthDate ? new Date(`${birthDate}T00:00:00`).toISOString() : undefined,
        microchipId: String(data.get("microchipId")).trim(),
        photoUrl,
        photoUrls,
        status: String(data.get("status")) as Pet["status"],
        lastKnownLocation: editingPet.lastKnownLocation,
        lastSeenAt: editingPet.lastSeenAt,
        publicFlags: { showName: data.get("showName") === "on" },
      });
      setPets((current) => current.map((pet) => pet.$id === updated.$id ? { ...pet, ...updated } : pet));
      setSelectedPet((current) => current?.$id === updated.$id ? { ...current, ...updated } : current);
      setEditingPet(null);
    } catch (error) {
      setPetError(error instanceof Error ? error.message : "Could not update your pet.");
    } finally {
      setIsSavingPet(false);
    }
  }

  async function addVetContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setIsSavingVet(true);
    setVetError("");
    try {
      const created = await createVetContact(user.$id, {
        name: String(data.get("vetName")),
        clinic: String(data.get("clinic")),
        phone: String(data.get("phone")),
      });
      setVetContacts((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setIsAddingVet(false);
      form.reset();
    } catch (error) {
      setVetError(error instanceof Error ? error.message : "Could not save the vet contact.");
    } finally {
      setIsSavingVet(false);
    }
  }

  async function removeVetContact(id: string) {
    setVetError("");
    try {
      await deleteVetContact(id);
      setVetContacts((current) => current.filter((contact) => contact.$id !== id));
      setPets((current) => current.map((pet) => getVetId(pet) === id ? { ...pet, vetContactId: null } : pet));
    } catch (error) {
      setVetError(error instanceof Error ? error.message : "Could not remove the vet contact.");
    }
  }

  async function assignVet(petId: string, vetId: string) {
    setVetError("");
    try {
      await updatePetVetContact(petId, vetId || null);
      const contact = vetContacts.find((vet) => vet.$id === vetId) ?? null;
      setPets((current) => current.map((pet) => pet.$id === petId ? { ...pet, vetContactId: contact } : pet));
    } catch (error) {
      setVetError(error instanceof Error ? error.message : "Could not update the pet’s vet contact.");
    }
  }

  async function purchaseTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setIsSavingTag(true);
    setTagError("");
    try {
      const created = await createTag(user.$id, String(data.get("label")).trim(), String(data.get("color")) as TagColor);
      setTags((current) => [created, ...current]);
      setIsAddingTag(false);
      form.reset();
    } catch (error) { setTagError(error instanceof Error ? error.message : "Could not create the QR tag."); }
    finally { setIsSavingTag(false); }
  }

  async function changeTagPet(tag: QRTag, petId: string) {
    setTagError("");
    try {
      await assignTag(tag.$id, petId || null);
      const pet = pets.find((item) => item.$id === petId) ?? null;
      setTags((current) => current.map((item) => item.$id === tag.$id ? { ...item, petId: pet } : item));
      setSelectedTag((current) => current?.$id === tag.$id ? { ...current, petId: pet } : current);
    } catch (error) { setTagError(error instanceof Error ? error.message : "Could not assign this tag."); }
  }

  async function toggleTag(tag: QRTag) {
    try {
      const updated = await setTagActive(tag.$id, !tag.isActive);
      setTags((current) => current.map((item) => item.$id === tag.$id ? { ...item, ...updated } : item));
      setSelectedTag((current) => current?.$id === tag.$id ? { ...current, ...updated } : current);
    } catch (error) { setTagError(error instanceof Error ? error.message : "Could not update this tag."); }
  }

  async function saveTagLocation(tag: QRTag, latitude: number, longitude: number) {
    setIsSavingTagLocation(true);
    setTagError("");
    try {
      const updated = await updateTagLocation(tag.$id, latitude, longitude);
      setTags((current) => current.map((item) => item.$id === tag.$id ? { ...item, ...updated } : item));
      setSelectedTag((current) => current?.$id === tag.$id ? { ...current, ...updated } : current);
    } catch (error) { setTagError(error instanceof Error ? error.message : "Could not update the tag location."); }
    finally { setIsSavingTagLocation(false); }
  }

  function useCurrentTagLocation(tag: QRTag) {
    setTagError("");
    if (!navigator.geolocation) {
      setTagError("Location services are not supported by this browser.");
      return;
    }
    setIsSavingTagLocation(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => void saveTagLocation(tag, coords.latitude, coords.longitude),
      (error) => { setIsSavingTagLocation(false); setTagError(error.message || "Could not get your current location."); },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  async function removeTag(id: string) {
    try { await deleteTag(id); setTags((current) => current.filter((tag) => tag.$id !== id)); setSelectedTag(null); }
    catch (error) { setTagError(error instanceof Error ? error.message : "Could not remove this tag."); }
  }

  function getTagPet(tag: QRTag) { return typeof tag.petId === "string" ? pets.find((pet) => pet.$id === tag.petId) : tag.petId; }
  function getTagPetId(tag: QRTag) { return typeof tag.petId === "string" ? tag.petId : tag.petId?.$id ?? ""; }
  function getPublicTagUrl(tag: QRTag) { return `${window.location.origin}/p/${tag.qrToken}`; }

  function getVetId(pet: Pet) {
    return typeof pet.vetContactId === "string" ? pet.vetContactId : pet.vetContactId?.$id ?? "";
  }

  function showsNamePublicly(pet: Pet) {
    if (!pet.publicFlags) return true;
    try { return JSON.parse(pet.publicFlags).showName !== false; } catch { return true; }
  }

  function getPetPhotos(pet: Pet) {
    if (pet.photoUrls) {
      try {
        const urls = JSON.parse(pet.photoUrls);
        if (Array.isArray(urls)) return urls.filter((url): url is string => typeof url === "string").slice(0, 3);
      } catch { /* Fall back to the legacy profile photo. */ }
    }
    return pet.photoUrl ? [pet.photoUrl] : [];
  }

  if (isMapView) {
    const locatedTags = tags.filter((tag) => tag.location);
    const missingTags = locatedTags.filter((tag) => getTagPet(tag)?.status === "missing");
    return (
      <main className="home-page map-view-page">
        <nav className="home-nav"><button className="details-back" onClick={() => setIsMapView(false)}><ArrowLeft /> Back to home</button><a className="brand home-brand" href="/"><span className="brand-mark"><PawPrint /></span><span>Pets Heaven</span></a></nav>
        <div className="map-view-content">
          <header className="map-view-header"><div><p className="eyebrow">Location overview</p><h1>Locate your furry babies</h1><p>See every located QR tag and the pet connected to it.</p></div><div className="map-view-stats"><span><strong>{locatedTags.length}</strong> located</span><span className={missingTags.length ? "alert" : ""}><strong>{missingTags.length}</strong> missing</span></div></header>
          <section className="map-view-panel">
            <TagsOverviewMap tags={tags} pets={pets} owner={user} onSelectTag={(tag) => { setIsMapView(false); setSelectedTag(tag); }} />
            {!locatedTags.length && <div className="map-view-empty"><MapPin /><h2>No tag locations yet</h2><p>Open a QR tag and set its location to make it appear here.</p></div>}
            <div className="map-view-legend"><span><i className="legend-photo" /> Located pet</span><span><i className="legend-missing">⚑</i> Missing pet</span></div>
          </section>
        </div>
      </main>
    );
  }

  if (selectedPet) {
    const photos = getPetPhotos(selectedPet);
    const vet = typeof selectedPet.vetContactId === "string" ? vetContacts.find((item) => item.$id === selectedPet.vetContactId) : selectedPet.vetContactId;
    return (
      <main className="home-page">
        <nav className="home-nav"><button className="details-back" onClick={() => setSelectedPet(null)}><ArrowLeft /> Back to pets</button><a className="brand home-brand" href="/"><span className="brand-mark"><PawPrint /></span><span>Pets Heaven</span></a></nav>
        <div className="pet-details-page">
          <header className="pet-details-header"><div><p className="eyebrow">Pet profile</p><h1>{selectedPet.name}</h1><p>{[selectedPet.breed, selectedPet.color].filter(Boolean).join(" · ") || "A beloved member of the family"}</p></div><div className="pet-details-actions"><span className={`pet-status ${selectedPet.status}`}>{selectedPet.status}</span><Button variant="outline" onClick={() => { setEditingPet(selectedPet); setSelectedPet(null); }}><Pencil /> Edit pet</Button></div></header>
          <section className={`pet-gallery ${photos.length === 1 ? "single" : ""}`}>
            {photos.length ? photos.map((url, index) => <img key={url} src={url} alt={`${selectedPet.name} photo ${index + 1}`} />) : <div className="pet-gallery-empty"><PawPrint /><span>No photos added yet</span></div>}
          </section>
          <section className="pet-details-grid">
            <div className="pet-info-card"><h2>Pet details</h2><dl><div><dt>Breed</dt><dd>{selectedPet.breed || "Not provided"}</dd></div><div><dt>Color</dt><dd>{selectedPet.color || "Not provided"}</dd></div><div><dt>Birth date</dt><dd>{selectedPet.birthDate ? new Date(selectedPet.birthDate).toLocaleDateString() : "Not provided"}</dd></div><div><dt>Microchip ID</dt><dd>{selectedPet.microchipId || "Not provided"}</dd></div><div><dt>Public QR name</dt><dd>{showsNamePublicly(selectedPet) ? "Visible" : "Hidden"}</dd></div></dl></div>
            <div className="pet-info-card"><h2>Care & location</h2><dl><div><dt>Vet</dt><dd>{vet ? `${vet.name}${vet.clinic ? ` · ${vet.clinic}` : ""}` : "Not assigned"}</dd></div><div><dt>Vet phone</dt><dd>{vet?.phone || "Not provided"}</dd></div><div><dt>Last seen</dt><dd>{selectedPet.lastSeenAt ? new Date(selectedPet.lastSeenAt).toLocaleString() : "Not provided"}</dd></div><div><dt>Last known location</dt><dd>{selectedPet.lastKnownLocation ? <span className="location-value"><MapPin /> {selectedPet.lastKnownLocation[1]}, {selectedPet.lastKnownLocation[0]}</span> : "Not provided"}</dd></div><div><dt>Profile created</dt><dd>{new Date(selectedPet.$createdAt).toLocaleString()}</dd></div><div><dt>Last updated</dt><dd>{new Date(selectedPet.$updatedAt).toLocaleString()}</dd></div></dl></div>
          </section>
        </div>
      </main>
    );
  }

  if (selectedVet) {
    const assignedPets = pets.filter((pet) => getVetId(pet) === selectedVet.$id);
    return (
      <main className="home-page">
        <nav className="home-nav"><button className="details-back" onClick={() => setSelectedVet(null)}><ArrowLeft /> Back to home</button><a className="brand home-brand" href="/"><span className="brand-mark"><PawPrint /></span><span>Pets Heaven</span></a></nav>
        <div className="vet-details-page">
          <header className="vet-details-header">
            <span className="vet-details-avatar"><Stethoscope /></span>
            <div><p className="eyebrow">Trusted care</p><h1>{selectedVet.name}</h1><p>{selectedVet.clinic || "Veterinary contact"}</p></div>
            <a className="vet-call-button" href={`tel:${selectedVet.phone}`}><Phone /> Call vet</a>
          </header>
          <section className="vet-details-grid">
            <div className="pet-info-card"><h2>Contact information</h2><dl><div><dt>Name</dt><dd>{selectedVet.name}</dd></div><div><dt>Clinic</dt><dd>{selectedVet.clinic || "Not provided"}</dd></div><div><dt>Phone</dt><dd><a className="detail-phone-link" href={`tel:${selectedVet.phone}`}>{selectedVet.phone}</a></dd></div><div><dt>Added</dt><dd>{new Date(selectedVet.$createdAt).toLocaleString()}</dd></div><div><dt>Last updated</dt><dd>{new Date(selectedVet.$updatedAt).toLocaleString()}</dd></div></dl></div>
            <div className="pet-info-card"><h2>Assigned pets</h2>{assignedPets.length ? <div className="assigned-pet-list">{assignedPets.map((pet) => <button key={pet.$id} onClick={() => { setSelectedVet(null); setSelectedPet(pet); }}>{pet.photoUrl ? <img src={pet.photoUrl} alt="" /> : <span><PawPrint /></span>}<div><strong>{pet.name}</strong><small>{[pet.breed, pet.color].filter(Boolean).join(" · ") || "Pet profile"}</small></div><ChevronRight /></button>)}</div> : <div className="empty-assignment"><PawPrint /><p>No pets are assigned to this vet yet.</p></div>}</div>
          </section>
        </div>
      </main>
    );
  }

  if (selectedTag) {
    const pet = getTagPet(selectedTag) ?? undefined;
    const vet = pet ? (typeof pet.vetContactId === "string" ? vetContacts.find((item) => item.$id === pet.vetContactId) : pet.vetContactId) : undefined;
    const publicUrl = getPublicTagUrl(selectedTag);
    const location = selectedTag.location;
    const selectedScan = tagScans.find((scan) => scan.$id === selectedScanId);
    return (
      <main className="home-page">
        <nav className="home-nav"><button className="details-back" onClick={() => setSelectedTag(null)}><ArrowLeft /> Back to home</button><a className="brand home-brand" href="/"><span className="brand-mark"><PawPrint /></span><span>Pets Heaven</span></a></nav>
        <div className="tag-details-page">
          <section className={`tag-hero tag-${selectedTag.color}`}><div className="tag-qr"><QRCodeImage value={publicUrl} label={selectedTag.label} /></div><div><p className="eyebrow">Smart QR tag</p><h1>{selectedTag.label}</h1><p>{pet ? `Linked to ${pet.name}` : "Not assigned to a pet"}</p><span className={`tag-state ${selectedTag.isActive ? "active" : "inactive"}`}>{selectedTag.isActive ? "Active" : "Paused"}</span></div></section>
          {tagError && <p className="home-error" role="alert">{tagError}</p>}
          <section className="tag-location-card pet-info-card">
            <div className="tag-location-heading"><div><p className="eyebrow">Last reported position</p><h2>Tag location</h2></div><Button variant="outline" onClick={() => useCurrentTagLocation(selectedTag)} disabled={isSavingTagLocation}><MapPin /> {isSavingTagLocation ? "Saving…" : "Use current location"}</Button></div>
            <TagLocationMap label={selectedTag.label} location={location} onLocationChange={(latitude, longitude) => saveTagLocation(selectedTag, latitude, longitude)} />
            <p className="tag-map-help">Drag the pin or click anywhere on the map. The new coordinates are saved automatically.</p>
            {location && <div className="tag-map-meta"><span><MapPin /> {location[1].toFixed(6)}, {location[0].toFixed(6)}</span><a href={`https://www.openstreetmap.org/?mlat=${location[1]}&mlon=${location[0]}#map=16/${location[1]}/${location[0]}`} target="_blank" rel="noreferrer">Open larger map <ExternalLink /></a></div>}
            <form key={location?.join(",") ?? "empty"} className="tag-coordinate-form" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void saveTagLocation(selectedTag, Number(data.get("latitude")), Number(data.get("longitude"))); }}>
              <div className="field-group"><Label htmlFor="tag-latitude">Latitude</Label><Input id="tag-latitude" name="latitude" type="number" min="-90" max="90" step="any" defaultValue={location?.[1]} placeholder="12.971599" required /></div>
              <div className="field-group"><Label htmlFor="tag-longitude">Longitude</Label><Input id="tag-longitude" name="longitude" type="number" min="-180" max="180" step="any" defaultValue={location?.[0]} placeholder="77.594566" required /></div>
              <Button type="submit" disabled={isSavingTagLocation}>{isSavingTagLocation ? "Saving…" : "Save location"}</Button>
            </form>
          </section>
          <section className="tag-details-grid"><div className="pet-info-card"><h2>Tag settings</h2><div className="field-group"><Label htmlFor="tag-pet">Assigned pet</Label><select id="tag-pet" value={getTagPetId(selectedTag)} onChange={(event) => changeTagPet(selectedTag, event.target.value)}><option value="">Not assigned</option>{pets.map((item) => <option key={item.$id} value={item.$id}>{item.name}</option>)}</select></div><dl><div><dt>Color</dt><dd className="capitalize">{selectedTag.color}</dd></div><div><dt>Issued</dt><dd>{new Date(selectedTag.issuedAt).toLocaleString()}</dd></div><div><dt>Tag ID</dt><dd>{selectedTag.$id}</dd></div></dl><div className="tag-setting-actions"><Button variant="outline" onClick={() => toggleTag(selectedTag)}>{selectedTag.isActive ? "Pause tag" : "Activate tag"}</Button><Button variant="destructive" onClick={() => removeTag(selectedTag.$id)}>Delete tag</Button></div></div><div className="pet-info-card"><h2>Public profile link</h2><p className="tag-help">This is the URL encoded in the QR. It works without signing in while the tag is active and assigned.</p><a className="public-profile-link" href={publicUrl} target="_blank" rel="noreferrer"><span>{publicUrl}</span><ExternalLink /></a>{pet && <button className="tag-linked-pet" onClick={() => { setSelectedTag(null); setSelectedPet(pet); }}><span>View {pet.name}’s full profile</span><ChevronRight /></button>}</div></section>
          <section className="scan-history-card pet-info-card">
            <div className="scan-history-heading"><div><p className="eyebrow">QR activity</p><h2>Scan history</h2></div><span>{tagScans.length} {tagScans.length === 1 ? "scan" : "scans"}</span></div>
            {isLoadingScans ? <p className="scan-history-empty">Loading scan history…</p> : tagScans.length ? <div className="scan-history-layout"><div className="scan-history-list">{tagScans.map((scan) => <button key={scan.$id} className={selectedScanId === scan.$id ? "selected" : ""} onClick={() => setSelectedScanId(scan.$id)}><span className={scan.location ? "scan-location-state located" : "scan-location-state"}><MapPin /></span><span><strong>{new Date(scan.scannedAt).toLocaleString()}</strong><small>{scan.location ? `${scan.location[1].toFixed(5)}, ${scan.location[0].toFixed(5)}` : "Location permission not granted"}</small></span><ChevronRight /></button>)}</div><div className="scan-history-map">{selectedScan?.location ? <><ScanLocationMap location={selectedScan.location} pet={pet} owner={user} vet={vet} /><div className="scan-map-meta"><span><MapPin /> {selectedScan.location[1].toFixed(6)}, {selectedScan.location[0].toFixed(6)}</span><a href={`https://www.openstreetmap.org/?mlat=${selectedScan.location[1]}&mlon=${selectedScan.location[0]}#map=16/${selectedScan.location[1]}/${selectedScan.location[0]}`} target="_blank" rel="noreferrer">Open map <ExternalLink /></a></div></> : <div className="scan-map-empty"><MapPin /><p>Select a scan with a shared location to view it on the map.</p></div>}</div></div> : <p className="scan-history-empty">No scans have been recorded for this tag yet.</p>}
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="home-page">
      <nav className="home-nav">
        <a className="brand home-brand" href="/">
          <span className="brand-mark"><PawPrint aria-hidden="true" /></span><span>Pets Heaven</span>
        </a>
        <div className="nav-actions">
          <button className="icon-button" aria-label="Notifications"><Bell /></button>
          <div className="user-chip"><span>{firstName.charAt(0).toUpperCase()}</span><div><strong>{user.name || "Pet parent"}</strong><small>{user.email}</small></div></div>
          <Button variant="ghost" onClick={handleSignOut} disabled={isSigningOut} className="signout-button">
            <LogOut /> {isSigningOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </nav>

      <div className="home-content">
        <section className="welcome-banner">
          <div>
            <p className="eyebrow">Your happy place</p>
            <h1>Good to see you, {firstName}.</h1>
            <p>Everything your pets need, lovingly kept in one place.</p>
          </div>
          <div className="banner-actions">
            <Button variant="outline" className="map-view-button" onClick={() => setIsMapView(true)}><MapIcon /> Map view</Button>
            <Button className="add-vet-button" onClick={() => setIsAddingVet(true)}><Stethoscope /> Add vet contact</Button>
            <Button className="add-pet-button" onClick={() => setIsAddingPet(true)}><Plus /> Add a pet</Button>
          </div>
          <PawPrint className="banner-paw" aria-hidden="true" />
        </section>

        {petError && <p className="home-error" role="alert">{petError}</p>}
        {isLoadingPets && <p className="pets-loading">Loading your pets…</p>}
        {!isLoadingPets && pets.length > 0 && (
          <section className="home-section pet-list-section">
            <div className="section-heading"><div><p className="eyebrow">The family</p><h2>Your pets</h2></div><span>{pets.length} {pets.length === 1 ? "pet" : "pets"}</span></div>
            <div className="pet-grid">
              {pets.map((pet) => (
                <article className="pet-card" key={pet.$id} onClick={() => setSelectedPet(pet)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedPet(pet); }}>
                  {pet.photoUrl ? <img className="pet-avatar pet-photo" src={pet.photoUrl} alt="" /> : <span className="pet-avatar"><PawPrint /></span>}
                  <div className="pet-card-copy"><h3>{pet.name}</h3><p>{[pet.breed, pet.color].filter(Boolean).join(" · ") || "Pet profile"}{pet.birthDate && ` · Born ${new Date(pet.birthDate).toLocaleDateString(undefined, { month: "short", year: "numeric" })}`}</p><label onClick={(event) => event.stopPropagation()}><span>Vet</span><select value={getVetId(pet)} onChange={(event) => assignVet(pet.$id, event.target.value)}><option value="">Not assigned</option>{vetContacts.map((vet) => <option key={vet.$id} value={vet.$id}>{vet.name}{vet.clinic ? ` · ${vet.clinic}` : ""}</option>)}</select></label></div>
                  <span className={`pet-status ${pet.status}`}>{pet.status}</span>
                  <div className="pet-card-actions" onClick={(event) => event.stopPropagation()}><button onClick={() => setEditingPet(pet)} aria-label={`Edit ${pet.name}`}><Pencil /></button><button onClick={() => removePet(pet.$id)} aria-label={`Remove ${pet.name}`}><Trash2 /></button></div>
                </article>
              ))}
            </div>
          </section>
        )}

        {vetError && <p className="home-error" role="alert">{vetError}</p>}
        {vetContacts.length > 0 && (
          <section className="home-section vet-section">
            <div className="section-heading"><div><p className="eyebrow">Trusted care</p><h2>Vet contacts</h2></div><Button variant="outline" size="sm" onClick={() => setIsAddingVet(true)}><Plus /> Add contact</Button></div>
            <div className="vet-grid">
              {vetContacts.map((vet) => (
                <article className="vet-card" key={vet.$id} onClick={() => setSelectedVet(vet)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedVet(vet); }}>
                  <span className="vet-avatar"><Stethoscope /></span>
                  <div><h3>{vet.name}</h3><p>{vet.clinic || "Veterinary contact"}</p><a href={`tel:${vet.phone}`} onClick={(event) => event.stopPropagation()}><Phone /> {vet.phone}</a></div>
                  <button onClick={(event) => { event.stopPropagation(); removeVetContact(vet.$id); }} aria-label={`Remove ${vet.name}`}><Trash2 /></button>
                </article>
              ))}
            </div>
          </section>
        )}

        {tagError && <p className="home-error" role="alert">{tagError}</p>}
        <section className="home-section tag-section">
          <div className="section-heading"><div><p className="eyebrow">Smart identification</p><h2>Your QR tags</h2></div><Button variant="outline" size="sm" onClick={() => setIsAddingTag(true)}><ShoppingBag /> Get a tag</Button></div>
          {tags.length ? <div className="tag-grid">{tags.map((tag) => { const pet = getTagPet(tag); return <article className={`tag-card tag-${tag.color}`} key={tag.$id} onClick={() => setSelectedTag(tag)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedTag(tag); }}><span className="tag-card-icon"><QrCode /></span><div><h3>{tag.label}</h3><p>{pet ? `Linked to ${pet.name}` : "Ready to assign"}</p><span className={`tag-state ${tag.isActive ? "active" : "inactive"}`}>{tag.isActive ? "Active" : "Paused"}</span></div><ChevronRight /></article>; })}</div> : <div className="tag-empty"><QrCode /><div><h3>No QR tags yet</h3><p>Add a colored smart tag and link it to one of your pets.</p></div><Button onClick={() => setIsAddingTag(true)}>Get your first tag</Button></div>}
        </section>

        <section className="home-section">
          <div className="section-heading"><div><p className="eyebrow">At a glance</p><h2>Your pet space</h2></div><button>View all <ChevronRight /></button></div>
          <div className="feature-grid">
            <article className="feature-card peach"><span className="feature-icon"><Heart /></span><div><h3>Pet profiles</h3><p>Keep their stories, photos, and favorite things together.</p></div><button aria-label="Open pet profiles"><ChevronRight /></button></article>
            <article className="feature-card sage"><span className="feature-icon"><CalendarDays /></span><div><h3>Care calendar</h3><p>Never miss a checkup, treatment, or grooming day.</p></div><button aria-label="Open care calendar"><ChevronRight /></button></article>
            <article className="feature-card cream"><span className="feature-icon"><Bone /></span><div><h3>Daily moments</h3><p>Save the little memories you never want to forget.</p></div><button aria-label="Open daily moments"><ChevronRight /></button></article>
          </div>
        </section>

        <section className="tip-card">
          <span><Sparkles /></span><div><p className="eyebrow">Today’s gentle reminder</p><h2>A little play goes a long way.</h2><p>Ten minutes of focused play can brighten your pet’s whole day—and yours too.</p></div>
        </section>
      </div>

      {isAddingPet && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsAddingPet(false); }}>
          <section className="pet-modal" role="dialog" aria-modal="true" aria-labelledby="add-pet-title">
            <button className="modal-close" onClick={() => setIsAddingPet(false)} aria-label="Close"><X /></button>
            <span className="modal-icon"><PawPrint /></span>
            <p className="eyebrow">A new best friend</p>
            <h2 id="add-pet-title">Add your pet</h2>
            <p>Tell us a little about who makes your days brighter.</p>
            <form onSubmit={addPet}>
              <div className="field-group"><Label htmlFor="name">Pet’s name</Label><Input id="name" name="name" placeholder="Milo" maxLength={128} required autoFocus /></div>
              <div className="pet-form-row"><div className="field-group"><Label htmlFor="breed">Breed <span className="optional">(optional)</span></Label><Input id="breed" name="breed" placeholder="Golden retriever" maxLength={128} /></div><div className="field-group"><Label htmlFor="color">Color <span className="optional">(optional)</span></Label><Input id="color" name="color" placeholder="Golden" maxLength={64} /></div></div>
              <div className="pet-form-row"><div className="field-group"><Label htmlFor="birthDate">Birth date <span className="optional">(optional)</span></Label><Input id="birthDate" name="birthDate" type="date" max={new Date().toISOString().slice(0, 10)} /></div><div className="field-group"><Label htmlFor="status">Status</Label><select id="status" name="status" required defaultValue="safe"><option value="safe">Safe</option><option value="missing">Missing</option></select></div></div>
              <div className="field-group"><Label htmlFor="microchipId">Microchip ID <span className="optional">(optional)</span></Label><Input id="microchipId" name="microchipId" placeholder="985141000000000" maxLength={128} /></div>
              <div className="field-group"><Label htmlFor="photos">Pet photos <span className="optional">(up to 3, max 10 MB each)</span></Label><label className="photo-upload" htmlFor="photos"><Upload /><span>Choose up to 3 photos</span></label><Input id="photos" name="photos" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple /></div>
              <details className="location-fields"><summary>Last known location <span>(optional)</span></summary><div className="pet-form-row"><div className="field-group"><Label htmlFor="latitude">Latitude</Label><Input id="latitude" name="latitude" type="number" step="any" min="-90" max="90" placeholder="19.076" /></div><div className="field-group"><Label htmlFor="longitude">Longitude</Label><Input id="longitude" name="longitude" type="number" step="any" min="-180" max="180" placeholder="72.878" /></div></div><div className="field-group"><Label htmlFor="lastSeenAt">Last seen at</Label><Input id="lastSeenAt" name="lastSeenAt" type="datetime-local" /></div></details>
              <label className="remember-me"><input type="checkbox" name="showName" defaultChecked /><span>Show name on the public QR profile</span></label>
              {petError && <p className="form-message" role="alert">{petError}</p>}
              <div className="modal-actions"><Button type="button" variant="outline" onClick={() => setIsAddingPet(false)} disabled={isSavingPet}>Cancel</Button><Button type="submit" className="save-pet-button" disabled={isSavingPet}>{isSavingPet ? "Saving…" : "Add pet"}</Button></div>
            </form>
          </section>
        </div>
      )}

      {editingPet && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditingPet(null); }}>
          <section className="pet-modal" role="dialog" aria-modal="true" aria-labelledby="edit-pet-title">
            <button className="modal-close" onClick={() => setEditingPet(null)} aria-label="Close"><X /></button>
            <span className="modal-icon"><Pencil /></span>
            <p className="eyebrow">Pet profile</p>
            <h2 id="edit-pet-title">Edit {editingPet.name}</h2>
            <p>Update their details or choose a new profile picture.</p>
            <form onSubmit={savePetEdits}>
              <div className="field-group"><Label htmlFor="edit-name">Pet’s name</Label><Input id="edit-name" name="name" defaultValue={editingPet.name} maxLength={128} required autoFocus /></div>
              <div className="pet-form-row"><div className="field-group"><Label htmlFor="edit-breed">Breed <span className="optional">(optional)</span></Label><Input id="edit-breed" name="breed" defaultValue={editingPet.breed} maxLength={128} /></div><div className="field-group"><Label htmlFor="edit-color">Color <span className="optional">(optional)</span></Label><Input id="edit-color" name="color" defaultValue={editingPet.color} maxLength={64} /></div></div>
              <div className="pet-form-row"><div className="field-group"><Label htmlFor="edit-birthDate">Birth date <span className="optional">(optional)</span></Label><Input id="edit-birthDate" name="birthDate" type="date" defaultValue={editingPet.birthDate?.slice(0, 10)} max={new Date().toISOString().slice(0, 10)} /></div><div className="field-group"><Label htmlFor="edit-status">Status</Label><select id="edit-status" name="status" required defaultValue={editingPet.status}><option value="safe">Safe</option><option value="missing">Missing</option></select></div></div>
              <div className="field-group"><Label htmlFor="edit-microchipId">Microchip ID <span className="optional">(optional)</span></Label><Input id="edit-microchipId" name="microchipId" defaultValue={editingPet.microchipId} maxLength={128} /></div>
              <div className="field-group"><Label htmlFor="edit-photo">Profile picture <span className="optional">(JPG, PNG, WebP or GIF; max 10 MB)</span></Label><label className="photo-upload" htmlFor="edit-photo"><Upload /><span>Choose a picture</span></label><Input id="edit-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif" /></div>
              <label className="remember-me"><input type="checkbox" name="showName" defaultChecked={showsNamePublicly(editingPet)} /><span>Show name on the public QR profile</span></label>
              {petError && <p className="form-message" role="alert">{petError}</p>}
              <div className="modal-actions"><Button type="button" variant="outline" onClick={() => setEditingPet(null)} disabled={isSavingPet}>Cancel</Button><Button type="submit" className="save-pet-button" disabled={isSavingPet}>{isSavingPet ? "Saving…" : "Save changes"}</Button></div>
            </form>
          </section>
        </div>
      )}

      {isAddingVet && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsAddingVet(false); }}>
          <section className="pet-modal vet-modal" role="dialog" aria-modal="true" aria-labelledby="add-vet-title">
            <button className="modal-close" onClick={() => setIsAddingVet(false)} aria-label="Close"><X /></button>
            <span className="modal-icon vet-modal-icon"><Stethoscope /></span>
            <p className="eyebrow">Trusted care</p>
            <h2 id="add-vet-title">Add a vet contact</h2>
            <p>Save their details, then assign them to any of your pets.</p>
            <form onSubmit={addVetContact}>
              <div className="field-group"><Label htmlFor="vetName">Vet’s name</Label><Input id="vetName" name="vetName" placeholder="Dr. Maya Patel" maxLength={128} required autoFocus /></div>
              <div className="field-group"><Label htmlFor="clinic">Clinic <span className="optional">(optional)</span></Label><Input id="clinic" name="clinic" placeholder="Happy Paws Veterinary Clinic" maxLength={255} /></div>
              <div className="field-group"><Label htmlFor="phone">Phone number</Label><Input id="phone" name="phone" type="tel" placeholder="+91 98765 43210" maxLength={32} required /></div>
              {vetError && <p className="form-message" role="alert">{vetError}</p>}
              <div className="modal-actions"><Button type="button" variant="outline" onClick={() => setIsAddingVet(false)} disabled={isSavingVet}>Cancel</Button><Button type="submit" className="save-pet-button" disabled={isSavingVet}>{isSavingVet ? "Saving…" : "Add contact"}</Button></div>
            </form>
          </section>
        </div>
      )}

      {isAddingTag && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsAddingTag(false); }}><section className="pet-modal" role="dialog" aria-modal="true" aria-labelledby="add-tag-title"><button className="modal-close" onClick={() => setIsAddingTag(false)} aria-label="Close"><X /></button><span className="modal-icon"><QrCode /></span><p className="eyebrow">Smart identification</p><h2 id="add-tag-title">Get a QR pet tag</h2><p>Choose a color and name. A unique, secure QR code is generated automatically.</p><form onSubmit={purchaseTag}><div className="field-group"><Label htmlFor="tagLabel">Tag name</Label><Input id="tagLabel" name="label" placeholder="Milo’s collar tag" maxLength={128} required autoFocus /></div><fieldset className="tag-color-picker"><legend>Tag color</legend>{TAG_COLORS.map((color) => <label key={color}><input type="radio" name="color" value={color} defaultChecked={color === "forest"} /><span className={`tag-color tag-${color}`} aria-hidden="true" /><span>{color}</span></label>)}</fieldset>{tagError && <p className="form-message" role="alert">{tagError}</p>}<div className="modal-actions"><Button type="button" variant="outline" onClick={() => setIsAddingTag(false)} disabled={isSavingTag}>Cancel</Button><Button type="submit" className="save-pet-button" disabled={isSavingTag}>{isSavingTag ? "Creating…" : "Create tag"}</Button></div></form></section></div>}
    </main>
  );
}
