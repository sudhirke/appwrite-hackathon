# Pet-Safe — Implementation Plan (React + Node.js)

## 1. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend (web) | React 18 + Vite, TypeScript | Fast dev loop, strong typing for a data-heavy app |
| Mobile scan page | Same React app, responsive PWA | Public scan page must work great on any phone browser — no app install needed |
| State/data fetching | TanStack Query + Zustand | Server cache separated from local UI state |
| Backend | Node.js (NestJS or Express + TypeScript) | NestJS gives you modules/DI structure that scales better once you add subscriptions, alerts, geo — recommended over plain Express |
| Database | MongoDB (Atlas) | Native `2dsphere` geo-indexing is a natural fit for "find subscribers near this scan location" and flexible schema for medical records |
| Cache / pub-sub | Redis | Session cache, rate limiting on public scan endpoint, pub/sub for real-time alert fan-out |
| Real-time | Socket.IO (or SSE) | Push "pet found near you" / "GPS pinged" events to owner's dashboard live |
| File storage | S3-compatible (AWS S3 / Cloudflare R2) | Pet photos, QR PNG/SVG exports |
| Auth | Auth0 or self-rolled JWT + refresh tokens | Given your Power Platform background, Auth0 or Entra ID (Azure AD B2C) may be an easier operational fit if you want SSO-style admin later |
| Payments | Stripe Billing | Handles tiered subscriptions, dunning, proration out of the box |
| Push notifications | Web Push (VAPID) + Twilio SMS as fallback | Owner needs to be reachable even if the tab isn't open |
| Infra | Docker containers → AWS ECS/Fargate or Azure Container Apps | Azure Container Apps may be attractive since you're already Microsoft-stack-adjacent |
| CI/CD | GitHub Actions | Matches your existing GitHub usage pattern |

---

## 2. High-Level Architecture

```
                     ┌─────────────────────┐
                     │   React SPA/PWA      │
                     │  (Owner Dashboard +   │
                     │   Public Scan Page)   │
                     └──────────┬───────────┘
                                │ HTTPS/WSS
                     ┌──────────▼───────────┐
                     │   Node.js API (NestJS)│
                     │  - Auth               │
                     │  - Pets               │
                     │  - Scans              │
                     │  - Alerts             │
                     │  - Billing            │
                     └──────┬───────┬────────┘
                             │       │
              ┌──────────────┘       └───────────────┐
    ┌─────────▼────────┐                    ┌─────────▼────────┐
    │  MongoDB Atlas     │                    │   Redis            │
    │  (profiles, scans, │                    │  (cache, pub/sub,  │
    │   geo alerts)      │                    │   rate limiting)   │
    └─────────────────────┘                    └────────────────────┘
                │
    ┌───────────▼────────────┐
    │  S3 / R2 (photos, QR)   │
    └──────────────────────────┘

    External: Stripe (billing), Twilio (SMS), Web Push (VAPID)
```

---

## 3. Core Data Models (MongoDB collections)

### `users` (owners)
```ts
{
  _id, email, passwordHash, phone,
  subscriptionTier: 'free' | 'basic' | 'premium',
  stripeCustomerId, stripeSubscriptionId,
  notificationPrefs: { push: bool, sms: bool, email: bool },
  createdAt, updatedAt
}
```

### `pets`
```ts
{
  _id, ownerId, name, breed, age, color, photoUrl,
  microchipId,
  medical: {
    vaccinations: [{ name, date, expiresAt }],
    allergies: [String],
    medications: [{ name, dosage, schedule }],
    dietaryNotes: String,
    vetContact: { name, phone, clinic }
  },
  status: 'safe' | 'missing',
  qrToken: String,          // unguessable, indexed — NOT the same as pet _id
  lastKnownLocation: { type: 'Point', coordinates: [lng, lat] }, // 2dsphere index
  lastSeenAt: Date,
  createdAt, updatedAt
}
```

### `scans` (audit trail of every tag scan)
```ts
{
  _id, petId, scannedAt,
  location: { type: 'Point', coordinates: [lng, lat] },
  ipHash, userAgent,
  triggeredAlert: Boolean
}
```

### `alerts`
```ts
{
  _id, petId, ownerId, createdAt,
  originLocation: { type: 'Point', coordinates: [lng, lat] },
  radiusKm, status: 'active' | 'resolved',
  notifiedUserIds: [ObjectId]
}
```

**Indexes to create day one:**
- `pets.qrToken` — unique
- `pets.lastKnownLocation` — `2dsphere`
- `users` geo field (if storing subscriber "home area" for community alerts) — `2dsphere`
- `scans.petId + scannedAt` — compound, for rate limiting/history

---

## 4. Smart QR Tag & Public Scan Flow

1. On pet creation, backend generates a cryptographically random `qrToken` (NOT the Mongo `_id` — avoids enumeration/ID-guessing attacks).
2. QR code encodes a URL: `https://petsafe.app/s/{qrToken}` — generate server-side with the `qrcode` npm package, store as SVG/PNG in S3, offer print-ready PDF (label size templates) via a print service.
3. Scanning opens the **public scan page** (no login required):
   - Shows only what the owner has explicitly flagged as public-safe: pet name, photo, urgent medical flags (e.g., "on medication," "allergic to X"), and a **masked** contact method (e.g., "Call Owner" button that proxies through your backend so raw phone numbers aren't scraped).
4. Rate-limit the public scan endpoint (Redis) to prevent QR token brute-forcing.
5. If `pet.status === 'missing'`, the page requests the browser's Geolocation API. On consent:
   - POST location to `/scans`, backend updates `pets.lastKnownLocation`, creates a `scans` doc, and fires a real-time event to the owner's dashboard (Socket.IO) + push/SMS.
   - If no consent given, still log the scan (without coordinates) and notify the owner "your pet's tag was scanned, location not shared."

---

## 5. Location Tracking & Community Alert Network

- **Status toggle** (`safe`/`missing`) is a simple PATCH on the pet doc — but flipping to `missing` should also **create an `alerts` document** and kick off community broadcast.
- **Community alert matching**: use `$geoNear` / `$nearSphere` against subscribed users' stored "home area" or last-active-location (only if they've opted in) to find nearby users within `radiusKm`, then fan out via Web Push + email.
- Treat this as a background job (BullMQ on Redis), not an inline API call — geo-fan-out to thousands of users shouldn't block the alert-creation request.
- Give owners a "resolve" action once the pet is found, which stops further notifications and marks the `alerts` doc resolved.

---

## 6. Subscription & Billing

- Stripe Products/Prices for tiers (e.g., Free: 1 pet, no community alerts; Basic: unlimited scans + profile hosting; Premium: + active location alert routing, SMS notifications).
- Use **Stripe Checkout** for signup and **Stripe Customer Portal** for self-serve plan management — minimizes custom billing UI you need to build.
- Webhook endpoint (`/webhooks/stripe`) to sync subscription status into `users.subscriptionTier` — this is the source of truth for feature-gating, not the client.
- Feature-gate at the API layer (middleware/guard checking tier) so gating can't be bypassed from the frontend.

---

## 7. Security & Privacy Considerations (important given medical + GPS data)

- **PII/medical data**: encrypt sensitive fields at rest if your DB provider doesn't already (MongoDB Atlas offers encryption at rest by default; consider field-level encryption for medical notes if you want extra assurance).
- **Public scan page** must never leak the owner's raw contact info, home address, or full medical record — only what's explicitly marked "visible on scan."
- **GPS consent**: always browser-prompted, never silently captured; store only what's needed, consider auto-expiring old scan location history (e.g., 90 days) for privacy/compliance.
- **Rate limiting** on scan and alert endpoints to prevent abuse (fake "missing" spam, QR brute forcing).
- Plan for **GDPR/CCPA-style data export & deletion** endpoints early — retrofitting this later is painful once medical records pile up.

---

## 8. Suggested API Surface (NestJS modules)

```
/auth              POST /login, /register, /refresh
/users/me          GET, PATCH (profile, notification prefs)
/pets              POST, GET (list), GET/:id, PATCH/:id, DELETE/:id
/pets/:id/qr        GET (returns image/PDF)
/pets/:id/status    PATCH (safe/missing toggle)
/s/:qrToken         GET (public scan page data)
/scans              POST (record a scan + optional geo)
/alerts             GET (owner's active alerts), PATCH/:id/resolve
/billing/checkout   POST (create Stripe Checkout session)
/billing/portal     POST (create Stripe portal session)
/webhooks/stripe    POST (Stripe events)
```

---

## 9. Phased Delivery Roadmap

**Phase 1 — Core MVP (4–6 weeks)**
- Auth, pet CRUD, medical records vault
- QR generation + public scan page (static info only, no GPS/alerts yet)
- Basic single-tier subscription via Stripe Checkout

**Phase 2 — Location & Alerts (3–4 weeks)**
- Status toggle, GPS capture on scan, owner real-time notification (Socket.IO + push)
- Scan history/audit log

**Phase 3 — Community Alert Network (3–4 weeks)**
- Geo-indexed nearby-subscriber matching
- Background job queue (BullMQ) for fan-out notifications
- Alert resolution flow

**Phase 4 — Hardening & Scale (2–3 weeks)**
- Rate limiting, abuse prevention, data retention/export/delete
- Load testing on public scan endpoint (this is your highest-traffic, unauthenticated surface)
- Print-ready QR/label export pipeline

---

## 10. Open Decisions to Nail Down Early
- Do free-tier pets get a QR tag at all, or is that a paid-only feature?
- How is "nearby" defined for community alerts — subscriber's home address, or people who happen to be near the scan (i.e., anyone who scans a tag becomes part of the network)?
- SMS costs (Twilio) can add up fast on Premium tier — decide if SMS is unlimited or capped per billing cycle.
- Data retention policy for medical records and scan history (legal/compliance angle, especially if you expand beyond one country).
