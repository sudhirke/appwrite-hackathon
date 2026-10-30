import { MapPin, PawPrint, Phone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getPublicPet, reportPublicPetScan, type PublicPetData } from "./lib/public-pet-api";

export function PublicPet({ token }: { token: string }) {
  const [pet, setPet] = useState<PublicPetData | null>(null);
  const [error, setError] = useState("");
  const [scanMessage, setScanMessage] = useState("Requesting location to record this scan…");
  const scanReported = useRef(false);

  useEffect(() => {
    getPublicPet(token)
      .then(setPet)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load this pet profile."));
  }, [token]);

  useEffect(() => {
    if (!pet || scanReported.current) return;
    scanReported.current = true;
    const reportScan = async (payload: { consentGiven: boolean; latitude?: number; longitude?: number }) => {
      try {
        await reportPublicPetScan(token, payload);
        setScanMessage(payload.consentGiven ? "Scan and current location shared with the pet owner." : "Scan recorded without location.");
      } catch { setScanMessage("The pet profile is available, but this scan could not be recorded."); }
    };
    if (!navigator.geolocation) {
      void reportScan({ consentGiven: false });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => void reportScan({ consentGiven: true, latitude: coords.latitude, longitude: coords.longitude }),
      () => void reportScan({ consentGiven: false }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  }, [pet, token]);

  if (error) return <main className="public-pet-page"><div className="public-state"><PawPrint /><h1>Pet profile unavailable</h1><p>{error}</p></div></main>;
  if (!pet) return <div className="app-loading"><span className="loading-paw">🐾</span><p>Opening pet profile…</p></div>;
  return <main className="public-pet-page"><header><span className="brand-mark"><PawPrint /></span><span>Pets Heaven</span></header><section className="public-pet-card">{pet.photoUrls[0] ? <img className="public-pet-photo" src={pet.photoUrls[0]} alt={pet.name || "Pet"} /> : <div className="public-pet-photo empty"><PawPrint /></div>}<div className="public-pet-copy"><span className={`pet-status ${pet.status}`}>{pet.status}</span><p className="eyebrow">QR pet profile</p><h1>{pet.name || "A beloved pet"}</h1><p>{[pet.breed, pet.color].filter(Boolean).join(" · ") || "Help this pet get home safely."}</p><p className="public-scan-status"><MapPin /> {scanMessage}</p>{pet.status === "missing" && pet.lastSeenAt && <p className="public-alert"><MapPin /> Last seen {new Date(pet.lastSeenAt).toLocaleString()}</p>}{pet.vet && <a className="public-vet" href={`tel:${pet.vet.phone}`}><Phone /><span><small>Veterinary contact</small><strong>{pet.vet.name}{pet.vet.clinic ? ` · ${pet.vet.clinic}` : ""}</strong></span></a>}</div></section></main>;
}
