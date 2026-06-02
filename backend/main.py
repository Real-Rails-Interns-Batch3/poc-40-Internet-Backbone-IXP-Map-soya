"""
backend/main.py
Internet Backbone & IXP Map — FastAPI Backend
Real Rails Intelligence Library

INCREMENTAL CHANGES from Phase 2:
  • Added GET /api/ixps/{ixp_id}/intelligence  — per-node intelligence handshake
  • Added GET /api/health/seeds                 — seed file status (data provenance)
  • Removed mock_data dependency from get_submarine_cables_geojson description
  • All other routes unchanged
"""
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
import json
import io
import csv
from typing import Optional
from data_adapters import (
    get_ixp_geojson,
    get_submarine_cables_geojson,
    get_asn_data,
    get_concentration_metrics,
    get_route_failure_simulation,
    get_sidebar_intelligence,
    get_ixp_intelligence,
    get_seed_status,
)

app = FastAPI(
    title="Real Rails — Internet Backbone & IXP Map API",
    description=(
        "ETL and intelligence layer for IXP map, ASN filters, and path concentration metrics.\n\n"
        "Data sources:\n"
        "- **PeeringDB** (seeds/ixps.json) — IXP registry\n"
        "- **TeleGeography** (seeds/cables.json) — Submarine cables\n"
        "- **CAIDA AS-rank** (seeds/asns.json) — AS topology and ranking\n\n"
        "Run `python fetch_real_data.py` to populate seed files."
    ),
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "Real Rails IXP Map API", "version": "2.0.0"}


# ── NEW: Seed status endpoint ────────────────────────────────────────────────

@app.get("/api/health/seeds")
def seed_status():
    """
    Returns the status of each seed file: source, fetch timestamp, record count.
    Use this to verify data freshness and provenance.
    """
    return JSONResponse(content=get_seed_status())


# ── IXPs ─────────────────────────────────────────────────────────────────────

@app.get("/api/ixps/geojson")
def ixp_geojson(
    country: Optional[str] = Query(None, description="Filter by 2-letter ISO country code"),
    min_members: Optional[int] = Query(None, description="Minimum number of member ASNs"),
):
    """
    Returns GeoJSON FeatureCollection of IXP locations.
    Source: PeeringDB public API (seeds/ixps.json).
    """
    data = get_ixp_geojson(country=country, min_members=min_members)
    return JSONResponse(content=data)


# ── NEW: Per-IXP intelligence handshake ─────────────────────────────────────

@app.get("/api/ixps/{ixp_id}/intelligence")
def ixp_intelligence(ixp_id: str):
    """
    Returns intelligence fields for a single IXP node (sidebar handshake).
    Source: PeeringDB + CAIDA + TeleGeography proximity.
    Fields not available from public APIs are returned as null with explanation.
    """
    data = get_ixp_intelligence(ixp_id=ixp_id)
    if "error" in data:
        raise HTTPException(status_code=404, detail=data["error"])
    return JSONResponse(content=data)


# ── Cables ───────────────────────────────────────────────────────────────────

@app.get("/api/cables/geojson")
def cable_geojson(
    owner: Optional[str] = Query(None, description="Filter by cable owner/operator name"),
):
    """
    Returns GeoJSON of submarine cable routes.
    Source: TeleGeography public API (seeds/cables.json).
    """
    data = get_submarine_cables_geojson(owner=owner)
    return JSONResponse(content=data)


# ── ASNs ─────────────────────────────────────────────────────────────────────

@app.get("/api/asns")
def asn_list(
    tier: Optional[str] = Query(None, description="Filter by tier: 1, 2, 3"),
    country: Optional[str] = Query(None, description="Filter by ISO country code"),
):
    """
    Returns ASN data with real topology metrics (customer cone, peer count, etc.).
    Source: CAIDA AS-rank GraphQL API (seeds/asns.json).
    """
    data = get_asn_data(tier=tier, country=country)
    return JSONResponse(content=data)


# ── Concentration metrics ─────────────────────────────────────────────────────

@app.get("/api/metrics/concentration")
def concentration_metrics():
    """
    Route concentration metrics derived from CAIDA AS-rank cone_prefixes.
    Includes Herfindahl-Hirschman Index (HHI) for market concentration.
    """
    data = get_concentration_metrics()
    return JSONResponse(content=data)


# ── Simulation ───────────────────────────────────────────────────────────────

@app.get("/api/simulation/route-failure")
def route_failure(
    asn_id: Optional[str] = Query(None, description="ASN to simulate failure for"),
):
    """
    Simulates route failure impact using real CAIDA cone_prefix metrics.
    Prefix counts and percentages are derived from real CAIDA AS-rank data.
    """
    data = get_route_failure_simulation(asn_id=asn_id)
    return JSONResponse(content=data)


# ── Sidebar intelligence ──────────────────────────────────────────────────────

@app.get("/api/intelligence/sidebar")
def sidebar_intelligence():
    """
    Returns pre-computed sidebar insight blocks derived from CAIDA AS-rank data.
    """
    data = get_sidebar_intelligence()
    return JSONResponse(content=data)


# ── CSV download ──────────────────────────────────────────────────────────────

@app.get("/api/download/sample")
def download_sample():
    """
    Returns downloadable CSV of IXP data from PeeringDB seeds.
    """
    ixps = get_ixp_geojson()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "peeringdb_id", "name", "country", "city", "region",
        "lat", "lon", "member_count", "tier", "website", "source",
    ])
    for feat in ixps["features"]:
        p = feat["properties"]
        c = feat["geometry"]["coordinates"]
        writer.writerow([
            p.get("peeringdb_id"), p.get("name"), p.get("country"),
            p.get("city"), p.get("region"),
            c[1], c[0],
            p.get("member_count"), p.get("tier"),
            p.get("website"), p.get("source"),
        ])
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=real_rails_ixp_peeringdb.csv"},
    )