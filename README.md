# Abacus Spaces Requirement Board

A Next.js app for **board.abacuspaces.com**. Abacus admins post retail requirements without the brand name. Partner brokers post the properties they hold. Abacus matches properties to requirements, pitches them to brands and tracks every store through to closing.

Built from six documents. The two skeletons (18 Oct) set the base requirements. The two v2 change docs (22 Oct) sit on top of them, and where they conflict the later doc wins. The two HTML mocks set the design.

- **Stack:** Next.js 15 (App Router), TypeScript, MongoDB with Mongoose, nodemailer (SMTP), Leaflet with OpenStreetMap, sharp, zod.
- **Roles:** Admin (from env, up to 3 accounts) and Broker (self sign up).

---

## Contents

1. [Quick start](#1-quick-start)
2. [How requirement conflicts were resolved](#2-how-requirement-conflicts-were-resolved)
3. [End to end workflow](#3-end-to-end-workflow)
4. [Feature breakdown](#4-feature-breakdown)
5. [Technical architecture](#5-technical-architecture)
6. [Setup and deployment](#6-setup-and-deployment)
7. [Testing](#7-testing)
8. [Open items and limits](#8-open-items-and-limits)

---

## 1. Quick start

```bash
npm install
cp .env.example .env        # fill in MongoDB, SMTP, admin emails/passwords, a 32+ char AUTH_SESSION_SECRET
npm run dev                 # http://localhost:3000
```

- Admins log in at `/admin/login`. Accounts are created from the env on first start. The first login on each browser asks for a code sent to the admin's email.
- Brokers sign up at `/signup`.

---

## 2. How requirement conflicts were resolved

| Topic | Earlier doc | Later doc (implemented) |
|---|---|---|
| Posting a requirement | One form per requirement (Admin Skeleton) | **One form per brand ask**: pick many cities, micro markets and stretches. The app creates one `REQ CHN 0012` per micro market, grouped under `BRD 0007`. Size, rent and stores can be overridden per location, and size and rent per stretch (Admin v2 §2). |
| Rent shown to brokers | Exact min to max range | **Band only**. Brokers never see the exact budget. The band runs from about 10% below the minimum (rounded down to ₹10) to the maximum (rounded to ₹10), so brokers are not invited to pitch above budget. See `rentBand()` in `src/lib/domain.ts`. |
| Who matches | Brokers suggest; Abacus matches with stages like matched / proposed / in discussion | Brokers still **suggest**. Only admins **pitch**. A pitch is the record of what was sent to the brand. It uses the eight v2 stages: Received, Under review, Shortlisted, Pitched (automatic), Site visit done, Under negotiation, Closed, Not closed (with note). |
| What a broker sees per property | Requirement code, comments, next update date, history | **Stage name only**: the furthest stage across all pitches, plus the admin's note for Not closed. No dates, brand names, brand counts, emails or WhatsApp (Admin v2 §6, Broker v2 §7d). |
| Admin daily email and 9 am follow up | Pitch follow up email | **No daily emails.** The dashboard is the update, and a 9 am IST daily summary card goes into the bell (Admin v2 §3, §8). |
| Post a Property form | Skeleton A to E | **v2 sections A to H**, with conditional fields, map pin and floor plan helper. Name, phone and email come from the profile. Existing fields not mentioned in v2 are kept (building name, main road, frontage, maintenance, escalation, landlord name, who you dealt with), as v2 asks. |
| Property code | Assigned on save | **Reserved when the draft is created**, so the broker can name the Drive folder (Broker v2 §7b). |
| Drive link | Must start with `https://drive.google.com/` | Must be a **folder** link (`…/drive/folders/`). A file link is rejected with "Paste the folder link, not a file link". |
| Number of admins | Two (Ashu and Das) | **Up to three, from env** (your build brief lists `ADMIN_EMAIL_1..3`). |
| Profile photo storage | Firebase Storage | Stored in **MongoDB GridFS**. No Firebase credentials are in the env spec, and it keeps everything in one database. It is still compressed to about 200 KB. |
| Sector visible to brokers | Open question | **Shown.** The v2 admin table marks Sector "Realtors see: Yes". |

### Decisions I made where the docs were silent

- **Stretch on a property.** v2 matching requires "same stretch if the requirement names stretches", but the v2 property form has no stretch field. I added an optional *Stretch* dropdown under A2. It only appears when that micro market has stretches.
- **Frontage in matching.** v2 lists five hard checks and frontage is not one of them. A shortfall on frontage shows as a tag ("Frontage below minimum"), the same way rent above budget does. It never hides a match.
- **"Pitched" on the property dropdown** is automatic and cannot be picked by hand. Choosing Site visit done, Under negotiation or Closed on a property card moves its pitch. If the property is pitched to several brands, the app asks which pitch.
- **Duplicates.** *Merge* keeps the earlier upload and retires the later one. The later one stays on record, marked merged. *Keep both* clears the flag. Brokers are never told.
- **Kept from the skeletons because v2 did not remove them:** monthly "still available?" check, landlord go ahead upload (photo or PDF), alerts only for the broker's cities, the "nearby requirement" prompt after upload, broker scorecard, Copy for WhatsApp, and saved requirements.
- **Admin first login.** The email OTP is required on the first login and on every new browser. Each trusted browser is remembered for 400 days through a device cookie.

---

## 3. End to end workflow

```
Admin posts brand ask ──► one REQ per micro market (brand hidden, rent shown as a band)
        │                         │ email alert to brokers who cover those cities
        ▼                         ▼
 Dashboard / pending       Broker sees requirement ──► suggests own property (a hint)
        ▲                         │
        │                         ▼
        │                 Broker posts property (code reserved on draft; pin, floor plan, Drive link)
        │                         │ duplicate check (pins within 30 m), "nearby requirements" prompt
        ▼                         ▼
 System suggests matches ──► Admin pitches (property code → requirement code)
        │                         │
        ▼                         ▼
 Pitch stage: Pitched → Site visit done → Under negotiation → Closed / Not closed
        │
        └──► Broker sees only the furthest stage name on My properties
```

### 3.1 Broker registration and login
1. **Sign up** (`/signup`). Fields in this order: full name, username, primary phone (WhatsApp), alternate phone, email, city, company, password, confirm password.
   - The username is checked live as the broker types, and three suggestions built from name and city appear if it is taken.
   - Email OTP is required. WhatsApp OTP is required too when it is switched on (see §8).
   - *Create account* stays disabled until the codes pass. A phone, email or username already registered is rejected.
2. **Login** (`/login`). Username, phone or email, plus password. *Remember me* is on by default and keeps the broker signed in for 30 days (a sliding session). Untick it and the session ends when the browser closes. Standard field types mean browsers offer to save the password.
3. **Forgot password.** A code by email (or WhatsApp when on), then a new password. Every other session is logged out and a "password changed" email goes out.
4. **OTP rules.** Each code is valid for **10 minutes**, stored as an absolute expiry in milliseconds. This fixes the v2 expiry bug. *Resend* unlocks after 60 seconds. Five wrong tries kill the code. A new code replaces the old one.

### 3.2 Requirement posting (admin)
1. **Step 1, Brand.** Pick an existing brand or add a new one. Set sector, contact, formats, carpet area and rent (min to max), frontage, floors, ceiling, power and our fee (15 or 30 days). Optional extras: store model, received on, *brand pays nothing*, condition, parking, signage, deposit, lease, lock in, priority, internal notes.
2. **Step 2, Where.** Tick cities, then micro markets, then stretches (or *Anywhere*), then stores wanted. A missing stretch can be added inline, and it is saved to Settings for next time.
3. **Step 3, Review grid.** One row per micro market. Override carpet area, rent and stores for any row, or per stretch. Potential revenue is shown. *Post* creates everything at once.
4. The app writes a public `Requirement` (no brand, no exact rent) and a separate `RequirementPrivate` (brand, exact rent, stores, fee, notes). Brokers covering those cities get **one email** listing the new requirements, with no brand names.

### 3.3 Property submission (broker)
1. *Post a property* → pick city and micro market → *Reserve a code and start*. The code (`PRP CHN 0042`) appears at the top straight away.
2. Fill sections **A to H**:
   - **A Basics:** city, micro market, optional stretch, format, address.
   - **B Location:** paste a Google Maps link (short links are resolved on the server) or tap the map. The marker is draggable.
   - **C Area and floors:** chargeable area, carpet area, floor count, area per floor (warns if they do not add up to the carpet area), same layout, ceiling, frontage, floor plan helper.
   - **D Commercials:** rent, deposit, maintenance, escalation, landlord name, who you dealt with, optional landlord go ahead upload.
   - **E Building and services.**
   - **F Inside the premises.**
   - **G Status.**
   - **H Photos and notes:** Drive folder link with the SOP pop up, plus notes with a guidance pop up.
3. The progress bar tracks required fields. Drafts **autosave** 1.5 seconds after each change, and the broker can finish later.
4. *Post property* checks every required field. The upload time is stamped and cannot be edited.
5. After posting:
   - The listing is checked for duplicates (pins within 30 m). Only admins see the result.
   - The broker sees **open requirements this property may fit**, each with a one tap *Suggest*.
   - If the broker came from a requirement page, it also offers "Suggest this for REQ …".

### 3.4 Verification and approval (admin)
- **New properties** arrive at *Received* and show in the dashboard pending list. *Review* moves a property to *Under review*.
- Admins can set **Shortlisted**, or **Not closed** with a short note the broker will see.
- **Duplicates** show side by side with upload times, with *Merge* or *Keep both*.
- **Rejecting a match.** *Dismiss* a system suggestion and it never comes back. *Not suitable* on a broker suggestion shows the broker "Not taken forward".

### 3.5 Property management
- **Broker side:** set the listing to Available, Let out or Withdrawn. After 30 days without confirmation, a daily sweep moves the listing to **Needs reconfirming** and it drops out of matching until the broker taps *Still available*. Drafts can be deleted. Posted listings cannot be deleted; they are kept for the record.
- **Admin side:** a filterable inventory (city, micro market, broker, stage, listing status, area, frontage, rent, search) and a full property page with landlord, go ahead document, Drive link, floor plan drawing, pin, pitches, stage history and duplicates.

### 3.6 Pitching to brands
- **From a requirement:** three lists.
  - Broker suggestions.
  - System suggestions, with every check shown (✓ / ✕), *Pitch* or *Dismiss*, and *Pitch all*.
  - Pitched properties, each with its stage dropdown and history. An *Undo* is available while a pitch is still at Pitched.
  
  A collapsed *Other properties in this city* list allows *Pitch anyway*.
- **From a property:** *Pitch to requirement* lists every open requirement, best fits first. Tick several and pitch them in one go.
- **From the demand tracker grid:** a *Pitch* button sits on every empty cell.
- Each pitch records the date, the admin and an optional note. The first pitch moves the property to *Pitched* automatically.

### 3.7 Status updates and notifications

| Event | Admin | Broker |
|---|---|---|
| New broker, brand, requirement, property; pitches; stage changes | Bell: live activity | None |
| Red flags: no option in 7 days, nothing shared in 20 days, confirm still active | Bell (grouped per brand per posting day), dashboard pending list, brand pages | None |
| 9 am IST daily summary (yesterday's numbers) | Bell plus a History tab | None |
| New requirement in the broker's cities | None | One email per posting |
| Stage changes on their property | None | **Stage name on the website only** (as v2 requires) |
| OTP codes, password changed | Email | Email (plus WhatsApp when switched on) |

---

## 4. Feature breakdown

### Broker portal (`/broker`)
- **Dashboard**
  - Time based greeting from one editable list (`GREETING_LINES` in `src/lib/domain.ts`).
  - Photo with a profile completeness ring and a level chip (Scout, Pro, Partner, Elite).
  - A one time level up celebration.
  - Eight count tiles, each opening the filtered list.
  - *Where we need properties*: a state → city → locality tree.
  - A drafts reminder.
- **Requirements**
  - *Demand by micro market* strip ("Anna Nagar · 4 brands looking"), with a filter for the broker's own cities.
  - Filters: state, city, sector, carpet area, in my cities, saved only.
  - Cards with the five synopsis fields and a Save button.
- **Requirement detail:** every realtor visible field, the *brand pays nothing* notice, Save, *Suggest a property* (own active listings, nearest first, with a one line note), *Upload a new property*, *Copy for WhatsApp*, and the broker's own suggestions with Abacus's response.
- **Post a property:** sections A to H as above, plus the floor plan helper:
  - Sides 4 to 10, Right, Left or Angled turns (law of cosines), and the door side.
  - A closure check ("Sides don't meet, recheck side X").
  - Shoelace area compared with the carpet area (warns above 10%).
  - Options: as drawn, mirror image, nearest closed shape, or *Not sure*.
  - A *Draw it myself* grid.
- **My properties:** filter tabs, listing status, *Still available*, *Suggest for a requirement*, Abacus stage name with the Not closed note, and a "No Drive link" warning.
- **My suggestions:** property code, requirement code, date, note, and Abacus's response.
- **Profile**
  - Photo upload with an on screen circular crop, compressed to about 200 KB.
  - Username (changeable once every 30 days).
  - Details and the micro markets the broker covers.
  - Email or phone change with a fresh OTP.
  - Password change.

### Admin portal (`/admin`)
- **Dashboard**
  - City filter that narrows every number.
  - Weekly target banner: this week vs target. On Mondays it leads with last week's result. It turns green when the target is met, and has an 8 week bar chart.
  - Pipeline tiles (stores, not brands).
  - Three revenue tiles: Closed, In negotiation, Full potential.
  - Inventory tiles.
  - **Pending list**, oldest first, each row with one clearing button: Pitch, Still active, Dismiss, Review, Merge or Keep both.
- **Requirements:** list with status and view filters, the three step posting wizard, and a detail page with matching, admin only and realtor visible panels, edit, hold, close and reopen.
- **Properties:** inventory and detail pages, with the stage dropdown everywhere.
- **Map:** every property as a dot coloured by stage, clustered. Open requirements show as shaded micro market circles labelled with brand counts. Filters for city, broker, stage, format and area. A side list mirrors what is on screen. A selected property card has the stage dropdown.
- **Demand tracker:** per micro market, brands asking, fitting properties, brands pitched, brands not yet pitched (red) and last pitch. A grid shows which property went to which brand.
- **Brands:** a list, plus a page per brand with contact, fee, revenue tiles, "Options sent for X of Y locations", and a city by city table with expandable pitches and flags.
- **Brokers:** a scorecard (uploads, active, matched share, share reaching site visit or further, closed, stale rate, suggestions taken) and a profile page with *switch account off*.
- **Settings**
  - Weekly target.
  - Level names and thresholds.
  - SOP PDF link, *How to measure* video link.
  - Editable SOP pop up tabs and notes pop up.
  - **Cities, micro markets (with map centre and radius) and stretches.** Renaming a micro market updates every requirement, property and broker that uses it.
- **Bell and Notifications:** Red flags, Activity and Daily summaries. Each admin marks items read separately.

### Shared platform
- Role based access, enforced on the server in every page and API route.
- Branded transactional emails over SMTP.
- GridFS file storage with per owner access checks.
- Responsive layout for desktop, tablet and phone, plus toasts, empty states, loading and error pages.

---

## 5. Technical architecture

### Folder structure
```
src/
  app/
    (auth)/login, signup, forgot-password        broker auth pages
    admin/(public)/login, forgot-password        admin auth pages
    admin/(app)/...                              admin portal (layout enforces admin session)
    broker/...                                   broker portal (layout enforces broker session)
    api/                                         route handlers (see below)
    layout.tsx, globals.css, error.tsx, not-found.tsx
  components/
    ui/        Field, Button, Modal, Toast, PasswordInput, OtpVerifier, Avatar, Badges, api.ts
    auth/      login, signup, forgot forms
    broker/    PropertyForm, FloorPlanHelper, SopModal, RequirementsBoard, MyProperties, ProfileEditor…
    admin/     RequirementWizard, actions (stage selects, pitch buttons…), Bell, AdminMapView, LocationsManager…
    map/       Leaflet components (client only)
  lib/
    env.ts          env validation (zod), fails loudly at boot
    db.ts           cached Mongoose connection + bootstrap (indexes, admin sync, settings seed)
    auth.ts         sessions, device trust, page/API guards
    otp.ts          send / verify / consume OTP tickets
    mail.ts         nodemailer transport + email templates
    whatsapp.ts     Meta WhatsApp Cloud API OTP (optional)
    domain.ts       pure rules: rent band, matching, stages, greeting, WhatsApp text, revenue
    floorplan.ts    floor plan geometry
    validation.ts   zod schemas shared by forms and API
    uploads.ts      GridFS store, avatar and document processing (sharp)
    services/       board (dashboard, flags, demand, scorecard), pitching, requirements,
                    brokerData, duplicates, levels, jobs, notify, adminView, publicReq
  models/
    index.ts        Mongoose schemas
    types.ts        explicit document types
  middleware.ts     redirects signed out visitors, blocks cross site POSTs
  instrumentation.ts / instrumentation-node.ts   boot: env check, DB connect, admin init
scripts/seed-admins.mjs  optional CLI to create or re-sync admins
tests/                   geometry unit tests
```

### Database schemas and relationships

| Collection | Key fields | Relations |
|---|---|---|
| `admins` | email (unique), passwordHash (bcrypt 12), envFingerprint, emailVerifiedAt, trustedDevices[] | |
| `brokers` | username, phone, email (all unique), city, company, microMarkets[{city,name}], avatarFileId, level/levelSeen, status, lockout fields | |
| `sessions` | tokenHash (keyed SHA-256), userType, userId, expiresAt (TTL index) | → admin / broker |
| `otps` | purpose, channel, target, codeHash, expiresAt, attempts, ticketHash | |
| `settings` (single doc) | cities[{name, code, state, lat, lng, enabled, microMarkets[{name, lat, lng, radiusM, stretches[]}]}], weeklyTarget, SOP texts, levels[] | |
| `brands` | name / nameLower (unique), sector, contact, fee (15 or 30), paysNothing | |
| `brandasks` | code `BRD 0007`, brand, values snapshot | → brand |
| `requirements` (**realtor visible**) | code `REQ CHN 0012`, sector, city, state, microMarket, stretches, formats, carpet range, **rentBandMin/Max**, specs, priority, status, postedAt, stillActiveAt | |
| `requirementprivates` (**admin only**) | requirement (unique), brand, brandAsk, **rentMin/Max**, stretchRent, storesWanted, fee, notes | → requirement, brand, brandask |
| `properties` | code `PRP CHN 0042` (unique, never reused), broker, state (draft / submitted / merged), A to H fields, floorPlan, listingStatus, lastConfirmedAt, adminStage, stageHistory[] | → broker |
| `suggestions` | property + requirement (unique pair), broker, note, status | |
| `pitches` | property + requirement (unique pair), stage, stageNote, by, history[] | |
| `dismissedmatches` | property + requirement (unique) | |
| `duplicatepairs` | a (earlier), b (later), distanceM, status | |
| `savedrequirements` | broker + requirement (unique) | |
| `notifications` | kind (activity / flag / summary), key (unique, sparse), readBy[], resolvedAt | |
| `counters`, `jobruns` | running numbers for codes; once a day job claims | |
| `uploads.files/chunks` | GridFS: avatars and landlord go ahead documents, metadata.ownerId | |

**Why two requirement records.** Brokers only ever receive `publicRequirement()`, an explicit allow list. The brand and the exact rent live in a different collection, so a careless query cannot leak them. This follows the skeleton's build note 1.

### API routes

All routes return JSON `{ error, fields? }` on failure. Bodies are validated with zod on the server.

| Area | Route | Who |
|---|---|---|
| Auth | `POST /api/auth/otp/send`, `POST /api/auth/otp/verify` | public (change_* purposes need a broker session) |
| | `GET /api/auth/username` (availability and suggestions) | public |
| | `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout` | public |
| | `POST /api/auth/forgot`, `POST /api/auth/reset` | public |
| | `POST /api/auth/admin/login`, `POST /api/auth/admin/verify-device` | public |
| Broker | `POST /api/broker/properties` (create draft, reserve code) | broker |
| | `PATCH` / `DELETE /api/broker/properties/[id]` | owner |
| | `POST /api/broker/properties/[id]/submit`, `/listing`; `POST` / `DELETE /goahead`; `GET /nearby` | owner |
| | `POST /api/broker/requirements/[id]/save` | broker |
| | `POST /api/broker/suggestions` | broker (own properties, open requirements) |
| | `PATCH /api/broker/profile`; `POST /profile/username`, `/profile/contact`, `/profile/password`; `POST` / `DELETE /profile/avatar`; `POST /api/broker/level-seen` | broker |
| Admin | `GET /api/admin/brands`; `PATCH /api/admin/brands/[id]` | admin |
| | `POST /api/admin/requirements`; `PATCH /api/admin/requirements/[id]`; `POST /[id]/still-active` | admin |
| | `POST /api/admin/pitches`; `PATCH` / `DELETE /api/admin/pitches/[id]` | admin |
| | `POST /api/admin/dismiss`; `PATCH /api/admin/properties/[id]/stage`; `POST /api/admin/duplicates/[id]` | admin |
| | `PATCH /api/admin/brokers/[id]`; `PUT /api/admin/settings`; `POST /api/admin/settings/locations` | admin |
| | `GET /api/admin/notifications`; `POST /api/admin/notifications/read` | admin |
| Shared | `GET /api/geo/resolve?url=` (Google Maps link to coordinates) | any signed in user |
| | `GET /api/files/[id]` | owner or admin |
| | `GET /api/cron/daily` | `Authorization: Bearer CRON_SECRET` |

Pages are server components that load data through the same services, so access rules apply identically.

### Authentication and authorisation
- **Sessions**
  - The cookie holds a random 256 bit token (`abd_session`: httpOnly, SameSite=Lax, Secure in production).
  - Only a keyed SHA-256 of the token is stored in `sessions`.
  - 30 days, sliding, revocable. Password reset and change revoke every session.
- **Admin devices.** A long lived `abd_device` cookie identifies the browser. Its keyed hash must be in `admin.trustedDevices`, otherwise the login needs an email OTP. The OTP is tied to the same device.
- **Passwords.** bcrypt with cost 12. Five wrong attempts lock the account for 10 minutes.
- **Admin initialisation.**
  - On every boot, `bootstrap()` upserts `ADMIN_EMAIL_n` / `ADMIN_PASSWORD_n`.
  - A password is re-hashed **only when the env value changes** (tracked by a fingerprint). A password reset done in the app is therefore kept until you change the env on purpose.
  - Optional CLI: `npm run seed:admins`.
- **Guards**
  - `pageAdmin()` / `pageBroker()` redirect on pages. `apiAdmin()` / `apiBroker()` throw 401 or 403 on APIs.
  - Ownership is checked for every broker resource. Brokers never see other brokers' properties, suggestions, or counts.
- **CSRF.** SameSite cookies, plus the middleware rejects state changing `/api` calls whose `Origin` is another site.
- **Env validation.** `src/lib/env.ts` lists every missing or invalid variable and stops the server at boot (`instrumentation.ts`).

### File uploads
- **Photos and videos** stay as a Google Drive folder link, as the docs decided. The link is validated as a folder link.
- **Profile photo**
  - Cropped to a circle in the browser (canvas, 512 px).
  - On the server, `sharp` checks it is really a JPG or PNG (5 MB limit), resizes it and compresses it to about 200 KB or less.
  - Stored in GridFS.
- **Landlord go ahead:** JPG, PNG, WEBP or PDF up to 8 MB, checked by magic bytes. Images are re-encoded, which strips EXIF data. Stored in GridFS.
- **Access:** `GET /api/files/[id]` streams a file only to its owner or an admin, with `nosniff` and a safe Content-Disposition. GridFS keeps uploads working on serverless hosts with no persistent disk.

### Email integration
- nodemailer SMTP from the `EMAIL_*` variables. Hostinger uses port 465 with `EMAIL_SECURE=true`.
- Templates (maroon branded HTML plus a plain text version): OTP codes (sign up, reset, admin new browser, email change), password changed, and new requirement alerts to brokers covering those cities.
- Alerts are sent in the background after the requirement is saved, so a slow SMTP server never blocks posting.

### Scheduled work
`runDueJobs()` runs the daily jobs. Each job is idempotent and claims its slot in `jobruns`, so it runs once a day even with several server instances.
- Reconfirm sweep.
- Red flag sync into the bell, grouped per brand.
- The 9 am IST summary of yesterday.

It runs when an admin opens the board (throttled to once every 5 minutes) and from `GET /api/cron/daily`. `vercel.json` schedules that endpoint for 03:31 UTC, which is 9:01 am IST.

---

## 6. Setup and deployment

### Requirements
- Node.js 20 or newer (tested on 22).
- MongoDB 6 or newer. Atlas is fine.
- An SMTP mailbox.

### Steps
1. **Install:** `npm install`
2. **Configure:** `cp .env.example .env` and fill in:
   - `MONGODB_URI`, `MONGODB_DB`
   - `ADMIN_EMAIL_1..3` / `ADMIN_PASSWORD_1..3`. Passwords need at least 10 characters. Blank slots are skipped.
   - `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM`
   - `AUTH_SESSION_SECRET`: at least 32 random characters, for example `openssl rand -base64 48`.
   - Optional: `APP_URL` (used for links in emails), `CRON_SECRET`, `ADMIN_NAME_n`, and the `WHATSAPP_*` variables.
3. **Connect MongoDB.** On Atlas, allow your server's IP under Network Access. The app creates collections and indexes itself on first start.
4. **Initialise admins.** This happens automatically when the server starts. To do it without starting the server, run `npm run seed:admins`.
5. **Run in development:** `npm run dev`
6. **Production:** `npm run build && npm start`. The server listens on port 3000 (`PORT` changes it).
7. **First use**
   1. Log in as an admin. Expect an email code on the first login.
   2. Open **Settings → Cities, micro markets and stretches**. Check the seeded micro markets and add yours. Brokers can only post in micro markets on this list.
   3. Set the SOP PDF link and the *How to measure* video link.

### Deploying
- **Vercel**
  - Import the repo and add the env variables. `vercel.json` sets the daily cron.
  - Set `CRON_SECRET` in Vercel; Vercel sends it automatically.
  - Use a MongoDB host that accepts Vercel's IPs. Atlas with 0.0.0.0/0 plus a strong password, or Atlas's Vercel integration.
- **A VPS or Docker host:** `npm ci && npm run build && npm start` behind nginx with HTTPS. Point any cron at `GET /api/cron/daily` with the bearer secret, or rely on the run-on-admin-visit fallback.
- `.env` is git ignored. Only `.env.example` is committed.

---

## 7. Testing

- `npm run typecheck`: TypeScript strict, no errors.
- `npm run build`: production build passes.
- `npm run test:logic`: floor plan geometry tests (the worked L shape example closes at 1,400 sq ft, mirror, nearest closed fix, law of cosines).
- **End to end (run during development against the production build).** A Playwright script drove these real flows:
  - Broker sign up with email OTP, live username check, duplicate email rejected.
  - Full Post a Property form, including draft autosave, Drive folder validation and the L shaped floor plan.
  - Admin first login OTP, then a known browser logs in without OTP, and a new tab stays signed in.
  - Three step brand ask with an inline new stretch and a per location rent override.
  - Broker alert email: one email, own cities only, no brand name.
  - The broker board's HTML contains no brand name, no exact rent and no fee. The rent band shows correctly.
  - Save, suggest, then admin pitch, then stage moved to Site visit done, then the broker sees only the stage name and "Taken forward".
  - Second broker's pin about 11 m away is flagged as a duplicate, then merged.
  - Map, demand grid, bell, property page.
  - Brokers get 403 on admin APIs and 404 on other brokers' properties.
  - Forgot password, login by phone number, old sessions revoked.
  - Mobile viewport screenshots.
  
  All checks passed. The OTP record was confirmed at a 600 second lifetime and sessions at 30 days.

---

## 8. Open items and limits

- **WhatsApp OTP is off until you decide.** It is the open question in Broker v2 (about ₹0.115 per OTP plus GST and provider fees). The Meta Cloud API integration is built: set `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_OTP_TEMPLATE` (an approved Authentication template) and it switches on everywhere. Until then, sign up verifies email only, the phone number is saved unverified, and Scout level needs only email verification.
- **Reference picture for the Requirements tab.** v2 says a new layout will follow a picture. Until it arrives, the cards and rules from the Broker Skeleton are used, plus the demand strip.
- **"How to measure" animation.** Paste its link in Settings; the link stays hidden until then.
- **Seeded micro markets** are the localities named in the docs (Anna Nagar, Porur, T Nagar, Velachery, RS Puram, Gandhipuram, Perundurai Road, MG Road, Edappally). Their coordinates are approximate. Correct them in Settings.
- **Scale.** Admin screens load the working set into memory per request. That is fine for hundreds of listings and tens of brokers. Past roughly 10,000 properties, move the dashboard maths into aggregation pipelines.
- **Not exercised live in development:** a real MongoDB server, real SMTP delivery, WhatsApp, OpenStreetMap tiles and Google Maps short link resolution. The sandbox could not reach those hosts. Emails went to a local SMTP sink. The database ran on a wire compatible in-memory server, which covers the same Mongoose queries but is not MongoDB itself. Run one pass on your own MongoDB and mailbox before going live.
