import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Bell, Bone, CalendarDays, ChevronRight, Heart, LogOut, MapPin, PawPrint, Pencil, Phone, Plus, Sparkles, Stethoscope, Trash2, Upload, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import type { AuthUser } from "./lib/auth";
import { createPet, deletePet, listPets, updatePet, updatePetVetContact, uploadPetPhoto, type NewPet, type Pet } from "./lib/pets";
import { createVetContact, deleteVetContact, listVetContacts, type VetContact } from "./lib/vets";

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
  const [isAddingVet, setIsAddingVet] = useState(false);
  const [isSavingVet, setIsSavingVet] = useState(false);
  const [vetError, setVetError] = useState("");
  const firstName = user.name?.trim().split(/\s+/)[0] || "friend";

  useEffect(() => {
    listPets(user.$id)
      .then(setPets)
      .catch((error) => setPetError(error instanceof Error ? error.message : "Could not load your pets."))
      .finally(() => setIsLoadingPets(false));
  }, [user.$id]);

  useEffect(() => {
    listVetContacts(user.$id)
      .then(setVetContacts)
      .catch((error) => setVetError(error instanceof Error ? error.message : "Could not load vet contacts."));
  }, [user.$id]);

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
                <article className="vet-card" key={vet.$id}>
                  <span className="vet-avatar"><Stethoscope /></span>
                  <div><h3>{vet.name}</h3><p>{vet.clinic || "Veterinary contact"}</p><a href={`tel:${vet.phone}`}><Phone /> {vet.phone}</a></div>
                  <button onClick={() => removeVetContact(vet.$id)} aria-label={`Remove ${vet.name}`}><Trash2 /></button>
                </article>
              ))}
            </div>
          </section>
        )}

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
    </main>
  );
}
