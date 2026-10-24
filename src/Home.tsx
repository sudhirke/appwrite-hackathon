import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bell, Bone, CalendarDays, ChevronRight, Heart, LogOut, PawPrint, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { AuthUser } from "./lib/auth";

type HomeProps = { user: AuthUser; onSignOut: () => Promise<void> };
type Pet = { id: string; name: string; type: string; birthday: string };

export function Home({ user, onSignOut }: HomeProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isAddingPet, setIsAddingPet] = useState(false);
  const storageKey = `pets-heaven:${user.$id}:pets`;
  const [pets, setPets] = useState<Pet[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || "[]") as Pet[]; } catch { return []; }
  });
  const firstName = user.name?.trim().split(/\s+/)[0] || "friend";

  async function handleSignOut() {
    setIsSigningOut(true);
    try { await onSignOut(); } finally { setIsSigningOut(false); }
  }

  function addPet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const nextPet: Pet = {
      id: crypto.randomUUID(),
      name: String(data.get("petName")),
      type: String(data.get("petType")),
      birthday: String(data.get("birthday")),
    };
    const nextPets = [...pets, nextPet];
    setPets(nextPets);
    localStorage.setItem(storageKey, JSON.stringify(nextPets));
    setIsAddingPet(false);
  }

  function removePet(id: string) {
    const nextPets = pets.filter((pet) => pet.id !== id);
    setPets(nextPets);
    localStorage.setItem(storageKey, JSON.stringify(nextPets));
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

        {pets.length > 0 && (
          <section className="home-section pet-list-section">
            <div className="section-heading"><div><p className="eyebrow">The family</p><h2>Your pets</h2></div><span>{pets.length} {pets.length === 1 ? "pet" : "pets"}</span></div>
            <div className="pet-grid">
              {pets.map((pet) => (
                <article className="pet-card" key={pet.id}>
                  <span className="pet-avatar"><PawPrint /></span>
                  <div><h3>{pet.name}</h3><p>{pet.type}{pet.birthday && ` · Born ${new Date(`${pet.birthday}T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" })}`}</p></div>
                  <button onClick={() => removePet(pet.id)} aria-label={`Remove ${pet.name}`}><Trash2 /></button>
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
              <div className="field-group"><Label htmlFor="petName">Pet’s name</Label><Input id="petName" name="petName" placeholder="Milo" minLength={1} required autoFocus /></div>
              <div className="field-group"><Label htmlFor="petType">Type of pet</Label><select id="petType" name="petType" required defaultValue=""><option value="" disabled>Select one</option><option>Dog</option><option>Cat</option><option>Bird</option><option>Rabbit</option><option>Other</option></select></div>
              <div className="field-group"><Label htmlFor="birthday">Birthday <span className="optional">(optional)</span></Label><Input id="birthday" name="birthday" type="date" max={new Date().toISOString().slice(0, 10)} /></div>
              <div className="modal-actions"><Button type="button" variant="outline" onClick={() => setIsAddingPet(false)}>Cancel</Button><Button type="submit" className="save-pet-button">Add pet</Button></div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
