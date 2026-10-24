import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bell, Bone, CalendarDays, ChevronRight, Heart, LogOut, PawPrint, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import type { AuthUser } from "./lib/auth";
import { createPet, deletePet, listPets, type NewPet, type Pet } from "./lib/pets";

type HomeProps = { user: AuthUser; onSignOut: () => Promise<void> };

export function Home({ user, onSignOut }: HomeProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isAddingPet, setIsAddingPet] = useState(false);
  const [isSavingPet, setIsSavingPet] = useState(false);
  const [isLoadingPets, setIsLoadingPets] = useState(true);
  const [pets, setPets] = useState<Pet[]>([]);
  const [petError, setPetError] = useState("");
  const firstName = user.name?.trim().split(/\s+/)[0] || "friend";

  useEffect(() => {
    listPets(user.$id)
      .then(setPets)
      .catch((error) => setPetError(error instanceof Error ? error.message : "Could not load your pets."))
      .finally(() => setIsLoadingPets(false));
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
    const nextPet: NewPet = {
      name: String(data.get("name")),
      breed: String(data.get("breed")),
      color: String(data.get("color")),
      birthDate: birthDate ? new Date(`${birthDate}T00:00:00`).toISOString() : undefined,
      microchipId: String(data.get("microchipId")),
      photoUrl: String(data.get("photoUrl")),
      status: String(data.get("status")) as Pet["status"],
      lastSeenAt: lastSeenAt ? new Date(lastSeenAt).toISOString() : undefined,
      lastKnownLocation: latitude && longitude ? [Number(longitude), Number(latitude)] : undefined,
      publicFlags: { showName: data.get("showName") === "on" },
    };

    setIsSavingPet(true);
    setPetError("");
    try {
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
          <Button className="add-pet-button" onClick={() => setIsAddingPet(true)}><Plus /> Add a pet</Button>
          <PawPrint className="banner-paw" aria-hidden="true" />
        </section>

        {petError && <p className="home-error" role="alert">{petError}</p>}
        {isLoadingPets && <p className="pets-loading">Loading your pets…</p>}
        {!isLoadingPets && pets.length > 0 && (
          <section className="home-section pet-list-section">
            <div className="section-heading"><div><p className="eyebrow">The family</p><h2>Your pets</h2></div><span>{pets.length} {pets.length === 1 ? "pet" : "pets"}</span></div>
            <div className="pet-grid">
              {pets.map((pet) => (
                <article className="pet-card" key={pet.$id}>
                  {pet.photoUrl ? <img className="pet-avatar pet-photo" src={pet.photoUrl} alt="" /> : <span className="pet-avatar"><PawPrint /></span>}
                  <div><h3>{pet.name}</h3><p>{[pet.breed, pet.color].filter(Boolean).join(" · ") || "Pet profile"}{pet.birthDate && ` · Born ${new Date(pet.birthDate).toLocaleDateString(undefined, { month: "short", year: "numeric" })}`}</p></div>
                  <span className={`pet-status ${pet.status}`}>{pet.status}</span>
                  <button onClick={() => removePet(pet.$id)} aria-label={`Remove ${pet.name}`}><Trash2 /></button>
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
              <div className="field-group"><Label htmlFor="photoUrl">Photo URL <span className="optional">(optional)</span></Label><Input id="photoUrl" name="photoUrl" type="url" placeholder="https://example.com/milo.jpg" /></div>
              <details className="location-fields"><summary>Last known location <span>(optional)</span></summary><div className="pet-form-row"><div className="field-group"><Label htmlFor="latitude">Latitude</Label><Input id="latitude" name="latitude" type="number" step="any" min="-90" max="90" placeholder="19.076" /></div><div className="field-group"><Label htmlFor="longitude">Longitude</Label><Input id="longitude" name="longitude" type="number" step="any" min="-180" max="180" placeholder="72.878" /></div></div><div className="field-group"><Label htmlFor="lastSeenAt">Last seen at</Label><Input id="lastSeenAt" name="lastSeenAt" type="datetime-local" /></div></details>
              <label className="remember-me"><input type="checkbox" name="showName" defaultChecked /><span>Show name on the public QR profile</span></label>
              {petError && <p className="form-message" role="alert">{petError}</p>}
              <div className="modal-actions"><Button type="button" variant="outline" onClick={() => setIsAddingPet(false)} disabled={isSavingPet}>Cancel</Button><Button type="submit" className="save-pet-button" disabled={isSavingPet}>{isSavingPet ? "Saving…" : "Add pet"}</Button></div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
