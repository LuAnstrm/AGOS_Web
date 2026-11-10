# AGOS

Flood monitoring platform — backend API, ML engine, web dashboard, mobile app —
built against a simulation layer while the IoT sensor nodes are fabricated.
Spec: *AGOS Software Architecture Framework* (Claude Docs).

## Status (development sequence)

| # | Step | State |
|---|------|-------|
| 1 | Backend skeleton — NestJS, PostgreSQL schema, `POST /readings` | done |
| 2 | Simulation job — scenario-parameterized generator | done (historical replay pending: needs AquaAlert dataset) |
| 3 | Filtering (EKF) + ML (Random Forest, LSTM) | EKF done; ML service runs **baseline** models until trained artifacts exist |
| 4 | Realtime (WebSocket/SSE) + five-tier alerts | done — storm scenario delivered in < 2 s on both channels |
| 5 | Web dashboard (Next.js) | all features in the paper done; evacuation is "nearest safe centre" (straight-line), not street routing |
| 6 | Mobile app (React Native) | citizen app built (Expo): area status, alerts, local notifications, SOS with offline queue, nearest safe evacuation centre with hand-off to the phone's maps app, live map, closed-app push registration, EN/FIL. Verified as a web build; not yet run on a phone |
| 7 | Hardware integration | — |

## Layout

```
backend/     NestJS API (TypeORM + PostgreSQL); EKF in src/filtering/ekf.ts
ml-service/  FastAPI inference service (scikit-learn), managed with uv
simulator/   Node 24 script, no dependencies (runs .ts natively)
web/         Next.js 16 DRRMO dashboard (Leaflet map, Recharts)
mobile/      Expo SDK 58 / React Native citizen app (Expo Router)
```

## Run it (four terminals, plus the dashboard)

```bash
cd backend && npm install && npm run db        # local PostgreSQL on :5433 (embedded, no Docker)
```

```bash
cd backend && npm run start:dev                # API on :3000, creates tables on first start
```

```bash
cd ml-service && uv sync && uv run uvicorn app.main:app --port 8000
```

```bash
cd simulator && npm run demo                   # 60 ticks, one every 2 s
```

Dashboard on http://localhost:3001 (backend URL from `NEXT_PUBLIC_AGOS_API`,
default `http://localhost:3000`). It is for DRRMO officers, so create an
officer account first (run after `npm run build` in `backend/`; prints a
generated password once, or set `AGOS_OFFICER_PASSWORD` to choose one):

```bash
cd backend && npm run create-officer -- --email you@example.ph --name "Your Name"
```

```bash
cd web && npm install && npm run dev
```

After signing in, it shows the sensor map (markers color-coded by tier, Critical ones pulsing),
a node list sorted by severity, the selected node's ML panel (depth, trend,
risk class, 1 h / 6 h / 24 h forecast) and raw-vs-filtered trend chart (with
a table view), and the live alert feed (filters: all tiers / Watch and above /
selected node; EN ⇄ FIL). It follows the OS light/dark setting and backfills
after a dropped connection. Map tiles come from OpenStreetMap, so the browser
needs internet access.

Simulated SOS requests (stand-in for the Bluetooth Mesh distress flow; some
are "relayed" twice to exercise dedup), shown live in the dashboard's SOS panel
and on the map:

```bash
cd simulator && npm run sos -- --count 5
```

To check alerts and realtime delivery, run the listener, then the storm
scenario (normal → steady rise → flash surge → recession, ~35 s accelerated):

```bash
cd simulator && node src/listen.ts --seconds 48
```

```bash
cd simulator && npm run storm
```

The listener prints each alert (EN + FIL) as it arrives over WebSocket, then
p50/p95/max delivery latency, and exits non-zero if anything took longer than
2 s. SSE is the officer channel, so it is checked too (and compared with the
WebSocket) only when `AGOS_OFFICER_EMAIL` / `AGOS_OFFICER_PASSWORD` are set.

Storm run after auth landed, both channels: 582 events, p50 41 ms, p95 73 ms,
max 105 ms; same 22 alerts on both.

Simulator options: `--interval <s>` (default 60, the real uplink rate),
`--ticks <n>` (0 = forever), `--profile normal|rising|flash_flood|dropout|storm`
(override every node), `--failover <0..1>` (chance a packet is also sent on a
backup channel), `--truth <file.csv>` (log ground-truth depth, for evaluating
the filter). `AGOS_API` sets the backend URL. Nodes live in
`simulator/nodes.json` (coordinates and mount heights are placeholders). The
simulator registers its nodes with `PUT /nodes/:id` on start.

The backend keeps each node's filter and alert state in memory. If you wipe the database
while it runs, restart it, or new readings older than the remembered state are
skipped as late packets.

## Pipeline

`POST /readings` → store raw → *(async, strictly in order per node)* Extended
Kalman Filter → `readings_filtered` → ML service `/classify` + `/forecast` in
parallel → `classifications`, `forecasts` → five-tier alert policy → `alerts`
(on tier change) → push over WebSocket and SSE. The sender gets `202` as soon
as the raw reading is stored. If the ML service is down, readings are still
stored, filtered and pushed; the node's tier is held.

**EKF** (`backend/src/filtering/ekf.ts`) corrects speed-of-sound temperature
drift and pole tilt (from packet `temperatureC`, `imu.tiltDeg` and the node's
`mountHeightCm`), weights noise by vibration (wind), gates single debris
spikes, and accepts sustained jumps (flash floods) with a short manoeuvre
window. On an 80-minute simulator run, RMSE vs. ground truth (raw → filtered):

| Profile | Raw | Filtered |
|---|---|---|
| normal | 5.4 cm | 1.0 cm |
| rising | 9.6 cm | 1.6 cm |
| dropout | 7.2 cm | 1.3 cm |
| flash flood | 6.7 cm | 3.7 cm |

Known limit: a debris spike within ~6 minutes after a surge is trusted as real
change (one reading can't tell them apart).

**ML models.** No trained artifacts yet, so responses carry `modelVersion`
`baseline-bands-v1` (current depth only: Low < 45 cm, Moderate < 90, High) and
`baseline-damped-trend-v1` (forecast from a 30-min trend; no trend until 10 min
of history; lags after a surge). Put a
trained `rf.joblib` in `ml-service/models/` (format in `app/models.py`) and it
replaces the baseline classifier on restart. The LSTM loader and the training
scripts come once the training data is settled.

**Alert policy** (`backend/src/alerts/alert-policy.ts`, pure and unit-tested).
"Rising" means the 1-h forecast is at least 15 cm above the current depth.

| Class | 1-h forecast steady | 1-h forecast rising |
|---|---|---|
| Low | Safe | Advisory |
| Moderate | Watch | Warning |
| High | Warning → Critical after 10 min held | Critical |

Escalation is immediate; stepping down needs 5 consecutive calmer readings
(no flapping at thresholds). Alert text is bilingual. **The Filipino wording
in `src/alerts/messages.ts` is a draft for native-speaker and CDRRMO review.**

Storm scenario, 4 nodes: every node went Advisory (25–39 cm) → Warning
(46–47 cm) → Critical (95–113 cm) → Watch → Safe. 582 events (560 readings,
22 alerts); ingestion → client p50 54 ms, p95 78 ms, max 166 ms on both
WebSocket and SSE, same alerts on both.

## Realtime

- **WebSocket** (mobile): `ws://host/ws[?nodes=ID,ID]`. Each frame is
  `{"type": "reading" | "alert", "data": {...}}`; a `hello` frame on connect.
- **SSE** (web, **officers only**): `GET /events[?nodes=ID,ID]`, named events
  `reading`, `alert`, `sos`, and `ping` every 25 s. In the browser:
  `new EventSource('/events', { withCredentials: true })`.
- `alert.data.notify` is true for Watch and above: the mobile app shows a push
  notification. `receivedAt` on every event is the backend's ingest time.
- Payload types: `backend/src/realtime/events.ts`. The event bus is
  in-process, single backend instance.

## Mobile app (citizens)

Expo SDK 58 + Expo Router, one codebase for iOS and Android (`mobile/`).
Filipino by default, English in Settings.

- **My area** — the nearest sensor (by GPS) as a full-color tier card with what
  to do, depth now, 1-hour forecast and trend; other sensors with distance.
  Falls back to the most severe sensor when location is off.
- **Alerts** — the five-tier alert feed, near me (3 km) or all areas, live over
  the WebSocket. Alerts at Watch and above near the user raise a local
  notification while the app is running.
- **SOS** — people count, needs, message, phone; a confirm step; the request
  is saved on the phone first and sent automatically when the connection
  returns (idempotent `clientId`, retried every 15 s and on reconnect). Shows
  status in plain words ("Help is on the way · Team: …") from `GET /sos/mine`.
  Location is required; 911 is always one tap away. Needs a citizen account
  (created in the app); alerts work without one.
- **Low connectivity** — opens instantly from the last cached readings and
  says how old they are; WebSocket reconnects with backoff and on foreground.
- Sign-in token in the OS keychain/keystore (`expo-secure-store`).

Run on a phone with Expo Go (same Wi-Fi as your computer; point the app at
your computer's LAN IP, since `localhost` on a phone is the phone):

```bash
cd mobile && npm install && EXPO_PUBLIC_AGOS_API=http://<your-LAN-IP>:3000 npx expo start
```

Or as a web build in a browser (what was used for testing here; serves on
:8081, which the backend allows by default in development):

```bash
cd mobile && npm run build:web && npm run serve:web
```

Verified in the web build: live tier changes during a storm, citizen sign-up,
SOS send → officer acknowledge/dispatch → "Help is on the way" in the app,
refusal without location, and the offline queue sending by itself after the
connection returned. **Not yet verified on a real iOS/Android device** (native
notifications, SecureStore, GPS, push, native map). Not built yet: turn-by-turn
safe routing inside the app (the Directions button hands off to the phone's
maps app), and the real Bluetooth Mesh SOS path (needs mesh hardware).

**Live map** — sensors by tier, evacuation centres and you, on the home
screen. Native builds use `react-native-maps` (works in Expo Go as-is); the
web build uses Leaflet (`nearby-map.web.tsx`). Production Android builds need
a Google Maps API key: add the `react-native-maps` config plugin with
`androidGoogleMapsApiKey` (from an `app.config.js` env var, not committed).

**Push alerts (app closed)** — once notifications are allowed, the app
registers its Expo push token with `POST /push/register` (language + location
rounded to ~100 m, no account needed). For every Watch-or-higher alert the
backend sends a push through Expo's service to phones within 3 km of the
sensor (phones with no location get all alerts), in each phone's language,
and drops tokens Expo reports as unregistered. **Requires an Expo project id**
(`npx eas-cli init` → `extra.eas.projectId`) and a development or store build;
Expo Go on Android cannot receive remote push. Until then the app skips
registration silently and the in-app WebSocket alerts still work. The send
path is unit-tested but has **not been tried on a real device**.
The Filipino strings in `src/lib/i18n.ts` are a draft for native-speaker and
CDRRMO review.

## Evacuation centres ("nearest safe centre first")

Street routing is deliberately not built yet; instead:

- **Centres** live in `evac_centers` (name, barangay, location, kind,
  capacity, status `open | full | closed`). Officers set the status from the
  dashboard's **Centres** tab; the change reaches every app instantly.
- **Recommendation** (`backend/src/evac/evac-rules.ts`, unit-tested): open
  centres only, nearest first, by straight-line distance. A centre within
  500 m of a sensor at Watch or above is ranked last as *unsafe*; a straight
  path passing within 300 m of one is flagged *caution* ("go around"). Walking
  time assumes streets add ~30% and ~1.1 m/s.
- **Mobile**: "Nearest safe evacuation centre" card with a direction arrow,
  distance, walking time, warnings, and a **Directions** button that opens the
  phone's maps app for real street directions. Computed on the phone from
  cached data, so it works offline (same rules as the backend — keep
  `mobile/src/lib/evac.ts` in sync).
- **Dashboard**: centre markers on the map, the Centres tab, and every SOS
  card shows its nearest safe open centre for dispatch.
- **Data**: a fresh development database is seeded with **6 placeholder
  centres** (marked as such everywhere). Load the CDRRMO's real list with
  `npm run seed-centers -- path/to/centres.json --drop-placeholders` (same
  fields as `backend/seed/evac-centers.placeholder.json`).
- Known limits: no street awareness (a straight line can cross a river), and
  flooding is only known where there are sensors.

## Auth

Separate citizen (mobile) and DRRMO officer (web) accounts, plus a device key
for gateways. Every HTTP route goes through one guard
(`backend/src/auth/auth.guard.ts`); the rules themselves are a pure, tested
function (`access.ts`).

| Caller | Presents | Can |
|---|---|---|
| Anyone | nothing | read flood data: `/nodes`, `/nodes/:id/series`, `/alerts`, `/readings`, `/health`, the citizen WebSocket |
| Gateway / simulator | `X-Device-Key` | `POST /readings`, `PUT /nodes/:id`, `POST /sos` (mesh relay) |
| Citizen | `Authorization: Bearer <token>` | `POST /sos`, `GET /sos/mine` (own requests, no personal data) |
| Officer | session cookie (web) or Bearer | everything: SOS queue and actions, `/events`, `PUT /nodes/:id` |

- `POST /auth/register` — citizens only (role can't be chosen). Passwords 10+
  characters, hashed with scrypt.
- `POST /auth/login` — returns `accessToken` (mobile) and sets an HttpOnly,
  SameSite=Lax `agos_session` cookie (web). Officer sessions last 8 h (one
  shift), citizen sessions 30 days. Failed sign-ins are limited per email +
  client IP (so nobody can lock a real officer out); unknown emails take as
  long as wrong passwords.
- `POST /auth/logout`, `GET /auth/me`.
- Officer accounts: `npm run create-officer -- --email … --name "…"` only.
- SOS history records the signed-in officer (name + user id).
- Env: `JWT_SECRET`, `DEVICE_API_KEY`, `WEB_ORIGINS` — see
  `backend/.env.example`. With `NODE_ENV=production` the server refuses to
  start without real secrets; in development it uses dev values and warns.
  The simulator sends `AGOS_DEVICE_KEY` (default: the dev key).

Not yet: password reset, revoking a token before it expires (sign-out clears
the cookie; a copied token stays valid until expiry — deleting or changing
the account's role does revoke it), officer admin UI, phone-number sign-in
for citizens.

## API so far

- `POST /readings` — one packet:
  ```json
  { "nodeId": "MAL-CAINGIN-01", "timestamp": "2026-11-09T13:00:00Z",
    "waterDepthCm": 42.1, "temperatureC": 31.5,
    "imu": { "tiltDeg": 0.8, "vibrationG": 0.05 },
    "gps": { "lat": 14.846, "lng": 120.8125 },
    "power": { "batteryPct": 84.2, "solarChargePct": 60 },
    "channel": "lorawan" }
  ```
  `202 {"status":"accepted"|"duplicate"}`. Same `nodeId` + `timestamp` on a
  second channel is a duplicate. Unknown nodes are registered on first packet.
- `GET /readings?nodeId=&limit=` — latest raw readings.
- `GET /nodes` — registered nodes.
- `PUT /nodes/:id` — register/update name, barangay, location, `mountHeightCm`.
- `GET /nodes/:id/series?limit=` — raw vs. filtered depth, with classification
  and forecast per reading.
- `GET /alerts?nodeId=&limit=` — alert history, newest first.
- `GET /evac/centers`, `GET /evac/recommend?lat=&lng=&limit=` (public);
  `PATCH /evac/centers/:id` `{status}` (officers). Live `centre` events on
  both the WebSocket and SSE.
- `POST /push/register` `{token, locale, lat?, lng?}` and `DELETE /push/register`
  `{token}` — public; only Expo push tokens are accepted.
- `POST /sos` — distress request from the app or mesh gateway (`clientId`,
  `channel` `ble_mesh|app`, `lat`, `lng`, optional `peopleCount`, `needs`
  `medical|elderly|children|pwd|pregnant|trapped`, `message`, `reporterName`,
  `reporterPhone`, `relayNodeId`, `relayHops`). `201` new, `200` +
  `duplicate: true` when the same `clientId` arrives again.
- `GET /sos?scope=open|all`, `GET /sos/:id` (with status history),
  `PATCH /sos/:id` (`status`, `assignedTeam`, `note`) — officers only.
  Lifecycle: new → acknowledged → dispatched → resolved, cancel from any open
  state; acknowledged → resolved allowed; dispatch needs a team; illegal moves
  → `409`. Each request is tagged with its nearest sensor node. SOS data is
  personal (names, phones, locations): officers only, pushed on SSE `/events`
  (type `sos`), never on the citizen WebSocket.
- `GET /sos/mine` — a signed-in citizen's own requests, status only.
- `GET /events` (SSE) and `ws://…/ws` — see Realtime.
- `GET /health`

## Schema

`sensor_nodes`, `readings_raw`, `readings_filtered`, `classifications`,
`forecasts`, `alerts`, `users` — see `backend/src/database/entities/`.
Generated from entities (`DB_SYNC=true`) during the simulation phase; switch to
migrations before the pilot deploy.

**Migrations.** `src/database/migrations` holds the schema history (starting
with `InitialSchema`, all 11 tables). With `DB_SYNC=false` — required in
production — the app applies pending migrations at startup and never
auto-alters the schema. After changing an entity:

```bash
cd backend && npm run migration:generate --name=DescribeTheChange
```

`npm run migration:run` / `migration:show` apply or list them by hand.

## Tests

```bash
cd backend && npm test
```

Backend end-to-end tests boot the real app against a throwaway `agos_test`
database on the dev Postgres (created automatically; needs `npm run db`), with
only the ML service stubbed. They cover the access matrix, ingestion → filter
→ alert with failover dedup, the SOS lifecycle, push registration and
evacuation centres:

```bash
cd backend && npm run test:e2e
```

```bash
cd ml-service && uv run pytest
```

```bash
cd simulator && npm test
```
