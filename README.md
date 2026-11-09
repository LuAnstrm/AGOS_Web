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
| 5 | Web dashboard (Next.js) | next |
| 6 | Mobile app (React Native) | — |
| 7 | Hardware integration | — |

## Layout

```
backend/     NestJS API (TypeORM + PostgreSQL); EKF in src/filtering/ekf.ts
ml-service/  FastAPI inference service (scikit-learn), managed with uv
simulator/   Node 24 script, no dependencies (runs .ts natively)
```

## Run it (four terminals)

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

To check alerts and realtime delivery, run the listener, then the storm
scenario (normal → steady rise → flash surge → recession, ~35 s accelerated):

```bash
cd simulator && node src/listen.ts --seconds 48
```

```bash
cd simulator && npm run storm
```

The listener prints each alert (EN + FIL) as it arrives over WebSocket, then
p50/p95/max delivery latency for WebSocket and SSE, checks both channels saw
the same alerts, and exits non-zero if anything took longer than 2 s.

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
- **SSE** (web): `GET /events[?nodes=ID,ID]`, named events `reading`, `alert`,
  and `ping` every 25 s. In the browser:
  `new EventSource('/events').addEventListener('alert', e => JSON.parse(e.data))`.
- `alert.data.notify` is true for Watch and above: the mobile app shows a push
  notification. `receivedAt` on every event is the backend's ingest time.
- Payload types: `backend/src/realtime/events.ts`. No auth yet (auth module
  is still to come); the event bus is in-process, single backend instance.

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
- `GET /events` (SSE) and `ws://…/ws` — see Realtime.
- `GET /health`

## Schema

`sensor_nodes`, `readings_raw`, `readings_filtered`, `classifications`,
`forecasts`, `alerts`, `users` — see `backend/src/database/entities/`.
Generated from entities (`DB_SYNC=true`) during the simulation phase; switch to
migrations before the pilot deploy.

## Tests

```bash
cd backend && npm test
```

```bash
cd ml-service && uv run pytest
```

```bash
cd simulator && npm test
```
