# AGOS Web Dashboard

DRRMO officer dashboard for the AGOS flood monitoring platform — a Next.js app that
connects to the shared backend API.

The backend, mobile app, ML service, and simulator live in
[AGOS_Mobile](https://github.com/LuAnstrm/AGOS_Mobile).

## Status

| # | Step | State |
|---|------|-------|
| 5 | Web dashboard (Next.js) | all features done; evacuation is "nearest safe centre" (straight-line), not street routing |
| + | SMS alerts | automatic (Warning/Critical escalations) and officer broadcasts |

## Layout

```
web/     Next.js DRRMO dashboard (Leaflet map, Recharts)
```

## Run locally

```bash
cd web && npm install && npm run dev
```

The dashboard connects to the backend at `NEXT_PUBLIC_AGOS_API` (default `http://localhost:3000`).
Run the backend first from [AGOS_Mobile](https://github.com/LuAnstrm/AGOS_Mobile).

Create an officer account (run once, after the backend is running):

```bash
# In the AGOS_Mobile repo:
cd backend && npm run create-officer -- --email you@example.ph --name "Your Name"
```

## Deployment (Vercel)

The `vercel.json` at the repo root points Vercel at `web/` as the root directory.

Set the following environment variable in your Vercel project:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_AGOS_API` | Your deployed backend URL (e.g. `https://agos-api.railway.app`) |

After deploying, add the Vercel URL to `WEB_ORIGINS` in the backend's environment variables.

## Features

After signing in, the dashboard shows:
- Sensor map (markers color-coded by tier, Critical ones pulsing)
- Node list sorted by severity
- Selected node's ML panel (depth, trend, risk class, 1 h / 6 h / 24 h forecast)
- Raw vs filtered trend chart (with table view)
- Live alert feed (filters: all tiers / Watch and above / selected node; EN ⇄ FIL)
- SOS panel (live requests on the map)
- Evacuation centre status management
- SMS broadcast composer

Light/dark theme follows the OS setting. Map tiles from OpenStreetMap.
