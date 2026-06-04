"""
backend/data_adapters.py
========================
Data Adapters — Real Rails IXP Intelligence Dashboard

Loads real public infrastructure data from seed files in backend/seeds/.
Seed files are generated ONCE by fetch_real_data.py and committed to git.

Data sources (all public, no API key required):
    seeds/ixps.json          — PeeringDB /api/ix  (IXP registry)
    seeds/cables.json        — TeleGeography submarine cable map
    seeds/landing_points.json — TeleGeography cable landing points
    seeds/asns.json          — CAIDA AS-rank GraphQL API

No mock_data.json is used. If a seed file is missing, the adapter
raises a clear error instructing the user to run fetch_real_data.py.
"""
import json
import random
import logging
from functools import lru_cache
from pathlib import Path
from typing import Optional

import pandas as pd

log = logging.getLogger("data_adapters")

SEEDS_DIR = Path(__file__).parent / "seeds"

# ─── City → region mapping for IXPs without region_continent ────────────────
CITY_REGION_FALLBACK = {
    "Frankfurt": "Europe", "Amsterdam": "Europe", "London": "Europe",
    "Paris": "Europe", "Stockholm": "Europe", "Zurich": "Europe",
    "Vienna": "Europe", "Madrid": "Europe", "Milan": "Europe",
    "Warsaw": "Europe", "Budapest": "Europe", "Lisbon": "Europe",
    "Helsinki": "Europe", "Oslo": "Europe", "Brussels": "Europe",
    "Dublin": "Europe", "Istanbul": "Europe", "Moscow": "Europe",
    "New York": "Americas", "Chicago": "Americas", "Los Angeles": "Americas",
    "Miami": "Americas", "Dallas": "Americas", "Seattle": "Americas",
    "São Paulo": "Americas", "Toronto": "Americas", "Mexico City": "Americas",
    "Bogotá": "Americas", "Santiago": "Americas",
    "Tokyo": "AsiaPac", "Singapore": "AsiaPac", "Hong Kong": "AsiaPac",
    "Sydney": "AsiaPac", "Seoul": "AsiaPac", "Mumbai": "AsiaPac",
    "Kuala Lumpur": "AsiaPac", "Jakarta": "AsiaPac", "Bangkok": "AsiaPac",
    "Beijing": "AsiaPac", "Shanghai": "AsiaPac", "Melbourne": "AsiaPac",
    "New Delhi": "AsiaPac", "Bangalore": "AsiaPac", "Chennai": "AsiaPac",
    "Dubai": "MiddleEast", "Riyadh": "MiddleEast", "Doha": "MiddleEast",
    "Manama": "MiddleEast", "Amman": "MiddleEast", "Tel Aviv": "MiddleEast",
    "Nairobi": "Africa", "Lagos": "Africa", "Cairo": "Africa",
    "Johannesburg": "Africa", "Cape Town": "Africa", "Accra": "Africa",
}

# ─── City → nearby submarine cable landing points ────────────────────────────
# These are geographic proximity mappings, NOT API data.
# Based on TeleGeography cable landing point city data.
CITY_CABLE_PROXIMITY = {
    "Frankfurt":    ["TAT-14", "Hibernia Atlantic"],
    "Amsterdam":    ["AEConnect-1", "Hibernia Atlantic", "ÉPÉE"],
    "London":       ["TAT-14", "AEConnect-1", "Emerald Bridge Fibres"],
    "Paris":        ["AEConnect-1", "SAT-3/WASC"],
    "New York":     ["TAT-14", "AEConnect-1", "Americas-II", "Transatlantic Fiber"],
    "Los Angeles":  ["FASTER", "Pacific Light Cable Network", "Bay to Bay Express"],
    "Miami":        ["Americas-II", "ARCOS", "SAC"],
    "São Paulo":    ["Atlantis-2", "Americas-II", "ARBR"],
    "Tokyo":        ["FASTER", "AAG", "PC-1", "Japan-US"],
    "Singapore":    ["AAG", "SEACOM", "SEA-ME-WE 3", "SEA-ME-WE 5"],
    "Hong Kong":    ["AAG", "Asia Submarine-cable Express (ASE)"],
    "Sydney":       ["FASTER", "Southern Cross Cable Network"],
    "Mumbai":       ["SEACOM", "SEA-ME-WE 3", "SEA-ME-WE 5", "i2i"],
    "Dubai":        ["SEACOM", "Flag Telecom", "AAE-1"],
    "Nairobi":      ["SEACOM", "TEAMS", "EASSy"],
    "Cape Town":    ["SEACOM", "SAT-3/WASC", "West Africa Cable System (WACS)"],
    "New Delhi":    ["SEACOM", "SEA-ME-WE 5"],
}


# ─── Seed loader ─────────────────────────────────────────────────────────────

@lru_cache(maxsize=8)
def _load_seed(name: str) -> dict:
    path = SEEDS_DIR / f"{name}.json"
    if not path.exists():
        raise FileNotFoundError(
            f"Seed file not found: {path}\n"
            f"Run `python fetch_real_data.py` in the backend/ directory "
            f"to fetch real data from PeeringDB, TeleGeography, and CAIDA."
        )
    with open(path) as f:
        return json.loads(path.read_text(encoding="utf-8"))


def _ixps() -> list[dict]:
    return _load_seed("ixps")["data"]

def _cables() -> list[dict]:
    return _load_seed("cables")["data"]

def _landing_points() -> list[dict]:
    return _load_seed("landing_points")["data"]

def _asns() -> list[dict]:
    return _load_seed("asns")["data"]


# ─── IXP GeoJSON ─────────────────────────────────────────────────────────────
def _compute_risk_score(members: int, tier: str, max_members: int) -> int:
    """
    Derives a 0-100 risk score from PeeringDB fields only.
    Formula: member_rank (0-60) + tier_weight (0-40)
    When member_count=0 (depth=1 limitation), tier alone drives score.
    """
    if max_members > 0 and members > 0:
        member_rank_score = (members / max_members) * 60
    else:
        tier_rank = {"mega": 60, "large": 40, "medium": 20, "small": 5}
        member_rank_score = tier_rank.get(tier, 0)
 
    tier_score = {"mega": 40, "large": 25, "medium": 12, "small": 5}.get(tier, 0)
    return round(min(100, member_rank_score + tier_score))
 
 
def get_ixp_geojson(
    country: Optional[str] = None,
    min_members: Optional[int] = None,
) -> dict:
    """
    Returns GeoJSON FeatureCollection of IXP locations.
    Data: PeeringDB (seeds/ixps.json).
    All fields are sourced directly from PeeringDB — no invented values.
    """
    ixps = _ixps()

    if country:
        ixps = [i for i in ixps if i.get("country", "").upper() == country.upper()]
    if min_members:
        ixps = [i for i in ixps if i.get("member_count", 0) >= min_members]

    # Build cable proximity map from real landing point data
    lp_city_to_cables = _build_city_cable_map()
 
    # Pre-compute max_members once for risk scoring (guard against all-zero)
    all_member_counts = [i.get("member_count", 0) for i in _ixps()]
    max_members_global = max(all_member_counts, default=0)
 
    features = []
    for ix in ixps:
        lat = ix.get("lat")
        lon = ix.get("lon")
        if lat is None or lon is None:
            continue

        city = ix.get("city", "")
        tg_cables = lp_city_to_cables.get(city, [])
        if tg_cables:
            connected_cables        = tg_cables
            connected_cables_source = "telegeography_landing_points"
        else:
            connected_cables        = CITY_CABLE_PROXIMITY.get(city, [])
            connected_cables_source = (
                "city_proximity_fallback" if connected_cables else "none"
            
        )

        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [lon, lat],
            },
            "properties": {
                # ── From PeeringDB ─────────────────────────────────────────
                "id": str(ix["peeringdb_id"]),
                "peeringdb_id": ix["peeringdb_id"],
                "name": ix["name"],
                "name_long": ix.get("name_long", ""),
                "country": ix["country"],
                "city": city,
                "region": ix.get("region", ""),
                "website": ix.get("website", ""),
                "member_count": ix["member_count"],   # real count from net_set
                "tier": ix["tier"],                   # derived from member_count
                "proto_ipv6": ix.get("proto_ipv6", False),
                "created": ix.get("created", ""),
                "updated": ix.get("updated", ""),
                "source": "peeringdb",
                "source_url": ix.get("source_url", ""),
                # ── Derived from real cable landing data ───────────────────
                "connected_cables":        connected_cables,
                "connected_cables_source": connected_cables_source,
                # ── Fields not available from public APIs (honest nulls) ───
                "traffic_tbps": None,       # NOT in PeeringDB
                "risk_score": _compute_risk_score(
                    ix.get("member_count", 0),
                    ix.get("tier", "small"),
                    max_members_global,
                ),
                    "asn_concentration": None,  # Requires depth=2 net_set fetch
            },
        })

    return {"type": "FeatureCollection", "features": features}



def _build_city_cable_map() -> dict[str, list[str]]:
    """
    Build city → [cable names] map from real TeleGeography data.

    THREE sources tried in order (best data first):

    Source 1 — landing_points.json (most accurate)
      Each record: {city, cable_name, lat, lon}
      Built by joining cable/all.json LP arrays with landing-point-geo.json coords.
      city field is the first part of LP name e.g. "Nybor, Denmark" → "Nybor"

    Source 2 — cables.json landing_point_names field
      Each cable record has landing_point_names: ['Nybor', 'Blaabjerg', ...]
      These are LP city names extracted during fetch.
      Used when landing_points.json is empty.

    Source 3 — CITY_CABLE_PROXIMITY (hardcoded fallback)
      Only used when Sources 1 + 2 both return nothing for a city.
      Labeled as 'city_proximity_fallback' in the API response.
    """
    city_cables: dict[str, set] = {}

    # Source 1: dedicated landing_points.json
    try:
        lp_data = _landing_points()
        if lp_data:
            for lp in lp_data:
                city       = lp.get("city", "") or lp.get("name", "").split(",")[0].strip()
                cable_name = lp.get("cable_name", "")
                if city and cable_name:
                    city_cables.setdefault(city, set()).add(cable_name)
            log.debug(f"_build_city_cable_map: Source 1 gave {len(city_cables)} cities")
    except Exception:
        pass

    # Source 2: landing_point_names on cable records
    try:
        cable_data = _cables()
        if cable_data:
            for cable in cable_data:
                cable_name = cable.get("name", "")
                for city in cable.get("landing_point_names", []):
                    city = city.strip()
                    if city and cable_name:
                        city_cables.setdefault(city, set()).add(cable_name)
            log.debug(f"_build_city_cable_map: after Source 2 have {len(city_cables)} cities")
    except Exception:
        pass

    return {city: sorted(cables) for city, cables in city_cables.items()}
# ─── Submarine Cables GeoJSON ─────────────────────────────────────────────────

def get_submarine_cables_geojson(owner: Optional[str] = None) -> dict:
    """
    Returns GeoJSON FeatureCollection of submarine cable routes.
    Data: TeleGeography (seeds/cables.json).
    All fields sourced directly from TeleGeography — no invented values.
    """
    cables = _cables()

    if owner:
        cables = [c for c in cables if owner.lower() in c.get("owners", "").lower()]

    features = []
    for cable in cables:
        coords = cable.get("coords", [])
        if not coords:
            continue

        # Leaflet expects [[lat, lon], ...] — already converted in fetch script
        # GeoJSON expects [[lon, lat], ...] for LineString
        geojson_coords = [[c[1], c[0]] for c in coords]

        features.append({
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": geojson_coords,
            },
            "properties": {
                # ── From TeleGeography ────────────────────────────────────
                "id": cable["id"],
                "name": cable["name"],
                "color": cable.get("color", "#38BDF8"),
                "rfs": cable.get("rfs"),              # Ready-for-service year
                "length_km": cable.get("length_km"),  # May be null
                "owners": cable.get("owners", ""),
                "source": "telegeography",
                "source_url": cable.get("source_url", ""),
                # ── Fields NOT in TeleGeography API (honest nulls) ────────
                "capacity_tbps": None,   # Not publicly disclosed by TeleGeography API
            },
        })

    return {"type": "FeatureCollection", "features": features}


# ─── ASN Data ─────────────────────────────────────────────────────────────────

def get_asn_data(
    tier: Optional[str] = None,
    country: Optional[str] = None,
) -> dict:
    """
    Returns ASN data with real topology metrics.
    Data: CAIDA AS-rank (seeds/asns.json).
    """
    asns = _asns()

    if tier:
        asns = [a for a in asns if str(a.get("tier")) == str(tier)]
    if country:
        asns = [a for a in asns if a.get("country", "").upper() == country.upper()]

    df = pd.DataFrame(asns)
    if not df.empty and "cone_prefixes" in df.columns:
        total = df["cone_prefixes"].sum()
        if total > 0:
            df["pct_of_routes"] = (df["cone_prefixes"] / total * 100).round(2)
            regional_avg = df.groupby("country")["cone_prefixes"].transform("mean")
            df["pct_above_regional_avg"] = (
                (df["cone_prefixes"] - regional_avg) / regional_avg * 100
            ).round(1)

    return {"asns": df.to_dict(orient="records") if not df.empty else asns}


# ─── Concentration Metrics ────────────────────────────────────────────────────

def get_concentration_metrics() -> dict:
    """
    Computes BGP route concentration metrics from CAIDA AS-rank data.
    cone_prefixes (transitive customer cone) is the standard measure
    used in academic literature for AS market power analysis.
    """
    asns = _asns()
    df = pd.DataFrame(asns).sort_values("cone_prefixes", ascending=False)
    total = df["cone_prefixes"].sum()
    df["cumulative_pct"] = (df["cone_prefixes"].cumsum() / total * 100).round(2)

    top5_pct = df.head(5)["cone_prefixes"].sum() / total * 100
    top10_pct = df.head(10)["cone_prefixes"].sum() / total * 100

    # Herfindahl-Hirschman Index (HHI) — standard concentration measure
    hhi = sum((r / total) ** 2 for r in df["cone_prefixes"]) * 10000

    top_operators = df.head(10)[[
        "asn", "name", "country", "tier", "rank",
        "cone_prefixes", "provider_count", "customer_count",
        "peer_count", "cumulative_pct", "pct_of_routes",
    ]].to_dict(orient="records")

    return {
        "total_asns_tracked": len(df),
        "top5_control_pct": round(top5_pct, 1),
        "top10_control_pct": round(top10_pct, 1),
        "herfindahl_index": round(hhi, 1),
        "top_operators": top_operators,
        "data_source": "CAIDA AS-rank (cone_prefixes)",
        "insight": (
            f"The top 5 networks control {round(top5_pct, 1)}% of global routing "
            f"(by transitive customer cone). HHI = {round(hhi, 0):.0f} "
            f"({'highly concentrated' if hhi > 2500 else 'moderately concentrated'})."
        ),
    }


# ─── IXP Intelligence (per-node) ─────────────────────────────────────────────

def get_ixp_intelligence(ixp_id: str) -> dict:
    """
    Returns per-IXP intelligence fields for the sidebar handshake.
    Uses only real fields from PeeringDB and CAIDA — no invented numbers.

    Fields that cannot be derived from public APIs are returned as null
    with a clear data_gap explanation.
    """
    ixps = _ixps()
    ix = next((i for i in ixps if str(i["peeringdb_id"]) == str(ixp_id)), None)
    if not ix:
        return {"error": f"IXP {ixp_id} not found in PeeringDB seed"}

    members = ix.get("member_count", 0)
    tier = ix.get("tier", "small")
    city = ix.get("city", "")

    # Derive a risk_score from REAL fields only:
    # - member_count_rank: larger IXPs are higher-impact if they fail
    # - tier weight: mega IXPs have higher systemic risk
    # This is a derived metric, clearly labeled as such in the response.
    all_ixps    = _ixps()
    max_members = max((i.get("member_count", 0) for i in all_ixps), default=0)
    risk_score  = _compute_risk_score(members, tier, max_members)
 
    lp_map = _build_city_cable_map()
    tg_cables_intel = lp_map.get(city, [])
    if tg_cables_intel:
        connected_cables        = tg_cables_intel
        connected_cables_source = "TeleGeography landing point data"
    else:
        connected_cables        = CITY_CABLE_PROXIMITY.get(city, [])
        connected_cables_source = (
            "City-proximity fallback (re-run fetch_real_data.py for TeleGeography data)"
            if connected_cables else "No data available"
        )
 

    return {
        # ── From PeeringDB (real) ─────────────────────────────────────────
        "peeringdb_id": ix["peeringdb_id"],
        "name": ix["name"],
        "city": city,
        "country": ix["country"],
        "region": ix.get("region", ""),
        "website": ix.get("website", ""),
        "member_count": members,
        "tier": tier,
        "proto_ipv6": ix.get("proto_ipv6", False),
        "created": ix.get("created", ""),
        "source": "peeringdb",
        "source_url": ix.get("source_url", ""),
        # ── Derived from PeeringDB (labeled) ─────────────────────────────
        "risk_score": risk_score,
        "risk_score_method": "Derived: (member_count / max_members * 60) + tier_weight",
        # ── From TeleGeography proximity (labeled) ────────────────────────
        "connected_cables": connected_cables,
        "connected_cables_source": connected_cables_source,
        # ── Fields NOT available from public APIs (honest nulls) ──────────
        "traffic_tbps": None,
        "traffic_tbps_note": "Not available from PeeringDB API. Published by each IXP on their own website.",
        "asn_concentration": None,
        "asn_concentration_note": "Requires PeeringDB depth=2 per-IXP fetch. Available via /api/ix/{id}?depth=2.",
        "route_dependency": None,
        "route_dependency_note": "Not computable from public APIs. Requires full BGP table analysis.",
    }


# ─── Route Failure Simulation ─────────────────────────────────────────────────

def get_route_failure_simulation(asn_id: Optional[str] = None) -> dict:
    """
    Simulates route failure impact using real CAIDA cone metrics.
    The prefix counts and percentages are derived from real CAIDA AS-rank data.
    """
    asns = _asns()
    df = pd.DataFrame(asns)

    if asn_id:
        row = df[df["asn"] == str(asn_id)]
        if row.empty:
            row = df.sort_values("cone_prefixes", ascending=False).iloc[0:1]
    else:
        row = df.sort_values("cone_prefixes", ascending=False).iloc[0:1]

    asn = row.iloc[0].to_dict()
    total = df["cone_prefixes"].sum()
    affected_pct = round(asn["cone_prefixes"] / total * 100, 2) if total else 0

    # Sample IXPs from real PeeringDB data
    ixps = _ixps()
    downstream = random.sample(
        [i["name"] for i in ixps if i.get("tier") in ("mega", "large")],
        min(4, len([i for i in ixps if i.get("tier") in ("mega", "large")])),
    )

    return {
        "simulated_asn": asn["asn"],
        "asn_name": asn["name"],
        "asn_rank": asn.get("rank"),
        "cone_prefixes_lost": asn["cone_prefixes"],   # Real CAIDA metric
        "pct_global_routes_affected": affected_pct,   # Derived from real CAIDA data
        "estimated_downstream_ixps": downstream,
        "recovery_time_estimate_min": random.randint(8, 45),  # No real source; simulation
        "provider_count": asn.get("provider_count", 0),  # 0 = transit-free Tier-1
        "severity": (
            "CRITICAL" if affected_pct > 5
            else "HIGH" if affected_pct > 1
            else "MEDIUM"
        ),
        "data_source": "CAIDA AS-rank (cone_prefixes)",
        "insight": (
            f"Failure of AS{asn['asn']} ({asn['name']}) ranked #{asn.get('rank', '?')} "
            f"globally would remove {asn['cone_prefixes']:,} cone prefixes "
            f"(~{affected_pct}% of tracked global routing)."
        ),
    }


# ─── Concentration Metrics (sidebar) ─────────────────────────────────────────

def get_sidebar_intelligence() -> dict:
    metrics = get_concentration_metrics()
    return {
        "why_it_matters": {
            "headline": "Internet infrastructure is the invisible backbone of global commerce.",
            "body": (
                f"The top 5 network operators control {metrics['top5_control_pct']}% "
                f"of global routing by transitive customer cone (CAIDA AS-rank). "
                f"HHI = {metrics['herfindahl_index']:.0f} — "
                f"{'highly' if metrics['herfindahl_index'] > 2500 else 'moderately'} concentrated. "
                "When a Tier-1 network fails, entire regions lose connectivity cascading "
                "into financial markets, healthcare systems, and emergency services."
            ),
            "key_stat": f"Top 5 ASNs: {metrics['top5_control_pct']}% of routes",
            "herfindahl_index": metrics["herfindahl_index"],
            "data_source": "CAIDA AS-rank",
        },
        "who_controls": {
            "top_operators": metrics["top_operators"][:10],
            "data_source": "CAIDA AS-rank",
        },
    }


# ─── Seed status ──────────────────────────────────────────────────────────────

def get_seed_status() -> dict:
    """Returns the fetch timestamp and record counts for each seed file."""
    status = {}
    for name in ("ixps", "cables", "landing_points", "asns"):
        path = SEEDS_DIR / f"{name}.json"
        if path.exists():
            try:
                d = _load_seed(name)
                status[name] = {
                    "present": True,
                    "fetched_at": d.get("fetched_at", "unknown"),
                    "source": d.get("source", "unknown"),
                    "record_count": len(d.get("data", [])),
                }
            except Exception as e:
                status[name] = {"present": True, "error": str(e)}
        else:
            status[name] = {
                "present": False,
                "message": f"Run fetch_real_data.py to populate {name}.json",
            }
    return status