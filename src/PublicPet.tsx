import { MapPin, PawPrint, Phone } from "lucide-react";
import { useEffect, useState } from "react";

type PublicPetData = { name?: string; breed?: string; color?: string; photoUrls: string[]; status: "safe" | "missing"; lastSeenAt?: string; lastKnownLocation?: [number, number]; vet?: { name: string; clinic?: string; phone: string } };

export function PublicPet({ token }: { token: string }) {
  const [pet, setPet] = useState<PublicPetData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/public/pets/${encodeURIComponent(token)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 404 ? "This tag is not active or has not been assigned." : "Could not load this pet profile.");
        return response.json() as Promise<PublicPetData>;
      })
      .then(setPet)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load this pet profile."));
  }, [token]);

  if (error) return <main className="public-pet-page"><div className="public-state"><PawPrint /><h1>Pet profile unavailable</h1><p>{error}</p></div></main>;
  if (!pet) return <div className="app-loading"><span className="loading-paw">🐾</span><p>Opening pet profile…</p></div>;
  return <main className="public-pet-page"><header><span className="brand-mark"><PawPrint /></span><span>Pets Heaven</span></header><section className="public-pet-card">{pet.photoUrls[0] ? <img className="public-pet-photo" src={pet.photoUrls[0]} alt={pet.name || "Pet"} /> : <div className="public-pet-photo empty"><PawPrint /></div>}<div className="public-pet-copy"><span className={`pet-status ${pet.status}`}>{pet.status}</span><p className="eyebrow">QR pet profile</p><h1>{pet.name || "A beloved pet"}</h1><p>{[pet.breed, pet.color].filter(Boolean).join(" · ") || "Help this pet get home safely."}</p>{pet.status === "missing" && pet.lastSeenAt && <p className="public-alert"><MapPin /> Last seen {new Date(pet.lastSeenAt).toLocaleString()}</p>}{pet.vet && <a className="public-vet" href={`tel:${pet.vet.phone}`}><Phone /><span><small>Veterinary contact</small><strong>{pet.vet.name}{pet.vet.clinic ? ` · ${pet.vet.clinic}` : ""}</strong></span></a>}</div></section></main>;
}
