# Internet Backbone & IXP Map
### Real Rails Intelligence Library — PoC: Data & Intelligence

A production-style intelligence dashboard for internet infrastructure: IXPs, ASNs, submarine cables, and path concentration metrics.

---

## Architecture

```
internet-ixp-map/
├── backend/          # Python FastAPI — ETL, data orchestration
│   ├── main.py       # API routes
│   ├── data_adapters.py  # PeeringDB + CAIDA AS-Rank + mock fallback
│   ├── mock_data.json    # Auto-fallback when live APIs unavailable
│   └── requirements.txt
└── frontend/         # Next.js 14 + TypeScript + Tailwind
    ├── src/app/      # App Router
    ├── src/components/
    │   ├── IXPMap.tsx    # Leaflet map (70% stage)
    │   ├── Sidebar.tsx   # Intelligence sidebar (30%)
    │   └── TitleBar.tsx
    └── src/lib/api.ts    # FastAPI client
```

---

## Quick Start

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open: http://localhost:3000

---

## Features

- **IXP Map** — 14 global IXPs with Leaflet, tier-based coloring, hover tooltips
- **Submarine Cables** — 7 transoceanic routes with capacity visualization
- **ASN Concentration** — Top-10 operators, Herfindahl index, route concentration bar
- **Route Failure Simulation** — Click to simulate AS failure; map turns red
- **Smart Filters** — Tier filter, layer toggles; map updates without page refresh
- **Intelligence Sidebar** — Why It Matters / Who Controls the Rail panels
- **Download Sample Data** — One-click CSV export
- **Mock Fallback** — PeeringDB/RIPEstat errors auto-fall back to `mock_data.json`

---

## Real Rails DNA Compliance

| Requirement | Status |
|---|---|
| Background #030712 | ✅ |
| Sidebar exactly 30% | ✅ |
| Filters update without page refresh | ✅ |
| Glassmorphism on cards | ✅ |
| Cyan glow on active elements | ✅ |
| No hardcoded API keys | ✅ .env only |
| Mock fallback on API error | ✅ Automatic |
| Professional projection library | ✅ Leaflet |
| Why This Matters panel | ✅ |
| Who Controls the Rail panel | ✅ |
| Download Sample Data button | ✅ |

---

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/ixps/geojson` | IXP GeoJSON (filters: country, min_members) |
| `GET /api/cables/geojson` | Submarine cable routes |
| `GET /api/asns` | ASN data with route enrichment |
| `GET /api/metrics/concentration` | Herfindahl index, top-10 control % |
| `GET /api/simulation/route-failure` | Route failure impact simulation |
| `GET /api/facilities` | Data center / facility cards |
| `GET /api/intelligence/sidebar` | Pre-computed insight blocks |
| `GET /api/download/sample` | CSV download |

---

## Data Sources

- **PeeringDB** (live) — IXP registry, member counts, locations
- **CAIDA AS-Rank** (mock enrichment) — ASN prefix counts
- **TeleGeography** (mock) — Submarine cable routes; no public event-level API