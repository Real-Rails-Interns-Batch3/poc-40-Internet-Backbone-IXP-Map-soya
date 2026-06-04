# Internet Backbone & IXP Map

**Real Rails Intelligence Library — PoC: Data & Intelligence**

A production-style intelligence dashboard for analyzing global internet infrastructure, including Internet Exchange Points (IXPs), Autonomous Systems (ASNs), submarine cable networks, route concentration metrics, and infrastructure dependency intelligence.

---

# Architecture

```text
internet-ixp-map/
├── backend/                      # Python FastAPI — ETL & Intelligence APIs
│   ├── main.py                   # API routes
│   ├── data_adapters.py          # PeeringDB + CAIDA + TeleGeography adapters
│   ├── fetch_real_data.py        # Data ingestion & seed generation
│   ├── seeds/
│   │   ├── ixps.json
│   │   ├── cables.json
│   │   ├── landing_points.json
│   │   └── asns.json
│   └── requirements.txt
│
└── frontend/                     # Next.js 14 + TypeScript + Tailwind
    ├── src/app/
    ├── src/components/
    │   ├── IXPMap.tsx
    │   ├── Sidebar.tsx
    │   ├── TitleBar.tsx
    │   └── IntelligencePanel.tsx
    └── src/lib/api.ts
```

---

# Quick Start

## Backend

```bash
cd backend

pip install -r requirements.txt

python fetch_real_data.py

uvicorn main:app --reload --port 8000
```

API Documentation:

```text
http://localhost:8000/docs
```

---

## Frontend

```bash
cd frontend

cp .env.example .env.local

npm install

npm run dev
```

Open:

```text
http://localhost:3000
```

---

# Current Dataset

| Dataset                    | Count                          | Source        |
| -------------------------- | ------------------------------ | ------------- |
| IXPs                       | 215                            | PeeringDB     |
| Submarine Cables           | 694                            | TeleGeography |
| ASN Rankings               | 100                            | CAIDA AS-Rank |
| Landing Point Associations | Generated via spatial matching | TeleGeography |

---

# Features

### Internet Exchange Point Intelligence

* 215 global IXPs sourced from PeeringDB
* Tier-based classification (Mega, Large, Medium)
* Risk scoring based on member concentration
* Per-IXP intelligence panel
* Interactive hover and click inspection

### Submarine Cable Intelligence

* 694 submarine cable systems
* Real cable geometries from TeleGeography
* Cable route visualization
* Landing-point-to-cable associations generated through spatial matching
* Cable ownership and metadata display

### ASN Concentration Analysis

* CAIDA AS-Rank integration
* Top-10 operator concentration metrics
* Route dependency analysis
* Herfindahl–Hirschman Index (HHI)
* Global routing concentration insights

### Infrastructure Risk Intelligence

* Risk scoring for major IXPs
* Concentration risk indicators
* Route failure simulation
* Infrastructure dependency analysis

### Interactive Controls

* Region filters
* Risk-level filters
* Layer toggles
* Live intelligence updates without page refresh

### Intelligence Sidebar

* Why This Matters panel
* Who Controls The Rail analysis
* Infrastructure concentration metrics
* Top ASN operators dashboard

### Data Export

* CSV export support
* Intelligence data download

---

# Real Data Sources

## PeeringDB

Used for:

* IXP registry
* Member counts
* Geographic locations
* Exchange metadata

## CAIDA AS-Rank

Used for:

* ASN rankings
* Customer cone analysis
* Route concentration metrics
* Top operator identification

## TeleGeography

Used for:

* Submarine cable routes
* Cable metadata
* Landing-point coordinates
* Cable-to-landing-point intelligence

Landing-point associations are generated through geographic spatial matching between cable route endpoints and TeleGeography landing-point coordinates.

---

# API Endpoints

| Endpoint                          | Description                   |
| --------------------------------- | ----------------------------- |
| GET /api/ixps/geojson             | IXP GeoJSON data              |
| GET /api/cables/geojson           | Submarine cable GeoJSON       |
| GET /api/asns                     | ASN intelligence data         |
| GET /api/metrics/concentration    | HHI and concentration metrics |
| GET /api/intelligence/sidebar     | Sidebar intelligence          |
| GET /api/intelligence/ixp/{id}    | Per-IXP intelligence          |
| GET /api/simulation/route-failure | Route failure simulation      |
| GET /api/download/sample          | CSV export                    |

---

# Intelligence Metrics

The dashboard provides:

* Top-5 ASN control percentage
* Top-10 ASN control percentage
* Herfindahl–Hirschman Index (HHI)
* IXP member concentration risk
* Infrastructure dependency indicators
* Cable proximity intelligence
* ASN route concentration analysis

---

# Real Rails DNA Compliance

| Requirement                           | Status |
| ------------------------------------- | ------ |
| Dark intelligence dashboard theme     | ✅      |
| Interactive global infrastructure map | ✅      |
| Sidebar intelligence panel            | ✅      |
| Live filtering without refresh        | ✅      |
| Glassmorphism UI elements             | ✅      |
| Cyan highlight effects                | ✅      |
| No hardcoded API keys                 | ✅      |
| FastAPI backend                       | ✅      |
| Next.js frontend                      | ✅      |
| PeeringDB integration                 | ✅      |
| CAIDA AS-Rank integration             | ✅      |
| TeleGeography integration             | ✅      |
| Landing-point spatial matching        | ✅      |
| Infrastructure intelligence panels    | ✅      |
| Route failure simulation              | ✅      |

---

# Project Goal

This PoC demonstrates how multiple public internet infrastructure datasets can be combined into a single intelligence platform that visualizes:

* Internet exchange concentration
* Global routing dependencies
* Submarine cable infrastructure
* Network operator influence
* Infrastructure risk exposure

The platform is designed to support infrastructure intelligence, resilience analysis, and strategic network visibility.
