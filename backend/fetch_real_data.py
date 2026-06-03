#!/usr/bin/env python3
"""
backend/fetch_real_data.py
Run once: cd backend && python fetch_real_data.py
"""

import json, sys, logging, socket , math
from collections import Counter, defaultdict
from pathlib import Path
from datetime import datetime, timezone

import requests


logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger("fetch_real_data")

_orig_getaddrinfo = socket.getaddrinfo
def _ipv4_only(host, port, family=0, type=0, proto=0, flags=0):
    return _orig_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)
socket.getaddrinfo = _ipv4_only

SEEDS_DIR = Path(__file__).parent / "seeds"
SEEDS_DIR.mkdir(exist_ok=True)

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "RealRails-IXP-Dashboard/1.0",
    "Accept": "application/json",
})


# ─── Helper: pre-fetch real member counts via /api/netixlan ─────────────────
# ROOT CAUSE FIX:
# /api/ix?depth=2 does NOT populate net_set on the list endpoint.
# PeeringDB strips it to prevent huge payloads.
# net_set is ONLY populated when fetching a SINGLE IXP (/api/ix/{id}).
#
# CORRECT FIX: /api/netixlan?depth=0&fields=ix_id,net_id
# Returns every network-to-IXP association as a flat list in ONE request.
# Group by ix_id → count = real member_count for each IXP.

def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in km between two lat/lon points."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1))
         * math.cos(math.radians(lat2))
         * math.sin(dlon / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(min(1.0, a)))
 
 
def _lp_near_cable(
    lp_lat: float,
    lp_lon: float,
    route_coords: list,
    threshold_km: float = 100.0,
) -> bool:
    """
    Returns True if the landing point is within threshold_km of any
    cable route endpoint (first or last 10 coordinate pairs).
 
    We only check endpoints, not the middle of the route, because:
    - Landing points are where cables come ashore (endpoints)
    - The middle of a cable route is open ocean
    - Checking only endpoints is 10x faster and more accurate
    """
    if not route_coords:
        return False
    # Check first 10 + last 10 coordinate pairs (the cable ends)
    endpoints = route_coords[:10] + route_coords[-10:]
    for coord in endpoints:
        if len(coord) >= 2:
            d = _haversine_km(lp_lat, lp_lon, coord[0], coord[1])
            if d <= threshold_km:
                return True
    return False

def _fetch_member_counts() -> dict[int, int]:
    log.info("  Pre-fetching member counts via /api/netixlan…")
    try:
        resp = SESSION.get(
            "https://www.peeringdb.com/api/netixlan",
            params={"depth": 0, "fields": "ix_id,net_id", "status": "ok"},
            timeout=60,
        )
        resp.raise_for_status()
        rows = resp.json().get("data", [])
        log.info(f"  Got {len(rows)} netixlan rows")
        counts: dict[int, int] = defaultdict(int)
        for row in rows:
            ix_id = row.get("ix_id")
            if ix_id:
                counts[int(ix_id)] += 1
        log.info(f"  Member counts computed for {len(counts)} IXPs")
        top5 = sorted(counts.items(), key=lambda x: x[1], reverse=True)[:5]
        log.info(f"  Top 5: {top5}")
        return dict(counts)
    except Exception as e:
        log.warning(f"  netixlan failed: {e} — member_count will be 0")
        return {}


# ─── 1. PeeringDB IXPs ───────────────────────────────────────────────────────

def fetch_peeringdb_ixps() -> list[dict]:
    log.info("Fetching PeeringDB IXPs (depth=2)…")

    member_counts = _fetch_member_counts()

    resp = SESSION.get(
        "https://www.peeringdb.com/api/ix",
        params={"depth": 2, "status": "ok"},
        timeout=60,
    )
    resp.raise_for_status()
    data = resp.json().get("data", [])
    log.info(f"  PeeringDB returned {len(data)} IXPs")

    CITY_COORDS: dict[str, tuple[float, float]] = {
        "Amsterdam": (52.3676, 4.9041), "Frankfurt": (50.1109, 8.6821),
        "London": (51.5074, -0.1278), "Paris": (48.8566, 2.3522),
        "Stockholm": (59.3293, 18.0686), "Zurich": (47.3769, 8.5417),
        "Vienna": (48.2082, 16.3738), "Madrid": (40.4168, -3.7038),
        "Milan": (45.4642, 9.1900), "Warsaw": (52.2297, 21.0122),
        "Helsinki": (60.1699, 24.9384), "Oslo": (59.9139, 10.7522),
        "Brussels": (50.8503, 4.3517), "Dublin": (53.3498, -6.2603),
        "Lisbon": (38.7169, -9.1399), "Istanbul": (41.0082, 28.9784),
        "Moscow": (55.7558, 37.6176), "Prague": (50.0755, 14.4378),
        "Budapest": (47.4979, 19.0402), "Bucharest": (44.4268, 26.1025),
        "Sofia": (42.6977, 23.3219), "Athens": (37.9838, 23.7275),
        "Kyiv": (50.4501, 30.5234), "Kiev": (50.4501, 30.5234),
        "Ashburn": (39.0438, -77.4874), "New York": (40.7128, -74.0060),
        "Chicago": (41.8781, -87.6298), "Los Angeles": (34.0522, -118.2437),
        "Dallas": (32.7767, -96.7970), "Miami": (25.7617, -80.1918),
        "Seattle": (47.6062, -122.3321), "San Jose": (37.3382, -121.8863),
        "Atlanta": (33.7490, -84.3880), "Boston": (42.3601, -71.0589),
        "Denver": (39.7392, -104.9903), "Toronto": (43.6532, -79.3832),
        "Montreal": (45.5017, -73.5673), "Vancouver": (49.2827, -123.1207),
        "São Paulo": (-23.5505, -46.6333), "Rio de Janeiro": (-22.9068, -43.1729),
        "Buenos Aires": (-34.6037, -58.3816), "Santiago": (-33.4489, -70.6693),
        "Bogotá": (4.7110, -74.0721), "Lima": (-12.0464, -77.0428),
        "Mexico City": (19.4326, -99.1332),
        "Tokyo": (35.6762, 139.6503), "Singapore": (1.3521, 103.8198),
        "Hong Kong": (22.3193, 114.1694), "Seoul": (37.5665, 126.9780),
        "Sydney": (-33.8688, 151.2093), "Melbourne": (-37.8136, 144.9631),
        "Beijing": (39.9042, 116.4074), "Shanghai": (31.2304, 121.4737),
        "Mumbai": (19.0760, 72.8777), "New Delhi": (28.6139, 77.2090),
        "Bangalore": (12.9716, 77.5946), "Chennai": (13.0827, 80.2707),
        "Kuala Lumpur": (3.1390, 101.6869), "Jakarta": (-6.2088, 106.8456),
        "Bangkok": (13.7563, 100.5018), "Taipei": (25.0330, 121.5654),
        "Osaka": (34.6937, 135.5023), "Dubai": (25.2048, 55.2708),
        "Riyadh": (24.6877, 46.7219), "Doha": (25.2854, 51.5310),
        "Tel Aviv": (32.0853, 34.7818), "Nairobi": (-1.2921, 36.8219),
        "Lagos": (6.5244, 3.3792), "Cairo": (30.0444, 31.2357),
        "Johannesburg": (-26.2041, 28.0473), "Cape Town": (-33.9249, 18.4241),
        "Accra": (5.6037, -0.1870), "Palo Alto": (37.4419, -122.1430),
        "Reston": (38.9586, -77.3570), "Phoenix": (33.4484, -112.0740),
        "Minneapolis": (44.9778, -93.2650), "Portland": (45.5051, -122.6750),
        "Salt Lake City": (40.7608, -111.8910), "Dusseldorf": (51.2217, 6.7762),
        "Hamburg": (53.5753, 10.0153), "Munich": (48.1351, 11.5820),
        "Berlin": (52.5200, 13.4050), "Cologne": (50.9333, 6.9500),
        "Copenhagen": (55.6761, 12.5683), "Marseille": (43.2965, 5.3698),
        "Rotterdam": (51.9225, 4.4792), "Barcelona": (41.3851, 2.1734),
        "Rome": (41.9028, 12.4964), "Lyon": (45.7640, 4.8357),
        "Djibouti": (11.8251, 42.5903), "Karachi": (24.8607, 67.0011),
        "Colombo": (6.9271, 79.8612), "Auckland": (-36.8485, 174.7633),
        "Perth": (-31.9505, 115.8605), "Brisbane": (-27.4698, 153.0251),
        "Manama": (26.2235, 50.5876), "Muscat": (23.5880, 58.3829),
        "Lahore": (31.5497, 74.3436), "Dhaka": (23.8103, 90.4125),
        "Yangon": (16.8661, 96.1951),
    }

    region_map = {
        "Europe": "Europe", "North America": "Americas",
        "South America": "Americas", "Latin America": "Americas",
        "Asia Pacific": "AsiaPac", "Middle East": "MiddleEast",
        "Africa": "Africa", "Oceania": "AsiaPac", "Australia": "AsiaPac",
    }

    all_ixps = []
    skipped  = 0

    for ix in data:
        # Priority 1: fac_set coords from depth=2 response
        lat = lon = None
        for fac in ix.get("fac_set", [])[:3]:
            if not isinstance(fac, dict):
                continue
            raw_lat = fac.get("latitude") or fac.get("lat")
            raw_lon = fac.get("longitude") or fac.get("lng") or fac.get("lon")
            if raw_lat and raw_lon:
                try:
                    lat, lon = float(raw_lat), float(raw_lon)
                    break
                except (TypeError, ValueError):
                    lat = lon = None

        # Priority 2: city fallback
        if lat is None or lon is None:
            city = ix.get("city", "")
            if city in CITY_COORDS:
                lat, lon = CITY_COORDS[city]
            else:
                for k, v in CITY_COORDS.items():
                    if k.lower() in city.lower():
                        lat, lon = v
                        break

        if lat is None or lon is None:
            skipped += 1
            continue

        pdb_id       = ix["id"]
        member_count = member_counts.get(pdb_id, 0)  # ← real netixlan count

        tier = (
            "mega"   if member_count >= 500 else
            "large"  if member_count >= 100 else
            "medium" if member_count >= 30  else
            "small"
        )

        pdb_region = ix.get("region_continent", "")
        all_ixps.append({
            "peeringdb_id": pdb_id,
            "name":         ix.get("name", ""),
            "name_long":    ix.get("name_long", ""),
            "city":         ix.get("city", ""),
            "country":      ix.get("country", ""),
            "region":       region_map.get(pdb_region, pdb_region or "Unknown"),
            "region_raw":   pdb_region,
            "website":      ix.get("website", ""),
            "media":        ix.get("media", ""),
            "proto_unicast": ix.get("proto_unicast", False),
            "proto_ipv6":   ix.get("proto_ipv6", False),
            "created":      ix.get("created", ""),
            "updated":      ix.get("updated", ""),
            "status":       ix.get("status", "ok"),
            "lat":          lat,
            "lon":          lon,
            "member_count": member_count,
            "tier":         tier,
            "source":       "peeringdb",
            "source_url":   f"https://www.peeringdb.com/ix/{pdb_id}",
        })

    tiers = Counter(i["tier"] for i in all_ixps)
    top5  = sorted([(i["name"], i["member_count"]) for i in all_ixps],
                   key=lambda x: x[1], reverse=True)[:5]
    log.info(f"  Geocoded {len(all_ixps)}/{len(data)} ({skipped} skipped)")
    log.info(f"  Tier distribution: {dict(tiers)}")
    log.info(f"  Top 5 by members: {top5}")
    return all_ixps


# ─── 2. TeleGeography cables ─────────────────────────────────────────────────

def fetch_telegeography_cables() -> tuple[list[dict], list[dict]]:
    log.info("Fetching TeleGeography cables + landing points…")
 
    # ── Step 1: Cable route geometries ───────────────────────────────────────
    log.info("  Fetching cable-geo.json…")
    try:
        gr = SESSION.get(
            "https://www.submarinecablemap.com/api/v3/cable/cable-geo.json",
            timeout=60,
        )
        gr.raise_for_status()
        geo_features = gr.json().get("features", [])
        log.info(f"  Got {len(geo_features)} cable geometry features")
    except Exception as e:
        log.error(f"  cable-geo.json failed: {e}")
        geo_features = []
 
    # slug → route coordinates AND slug → cable name (for logging)
    slug_to_coords: dict[str, list] = {}
    for feat in geo_features:
        props = feat.get("properties", {})
        slug  = props.get("id", "") or props.get("feature_id", "")
        if not slug:
            continue
        coords = _extract_cable_coords(feat.get("geometry", {}))
        if coords:
            slug_to_coords[slug] = coords
    log.info(f"  Route geometry for {len(slug_to_coords)} cables")
 
    # ── Step 2: Cable metadata ────────────────────────────────────────────────
    log.info("  Fetching cable/all.json…")
    try:
        lr = SESSION.get(
            "https://www.submarinecablemap.com/api/v3/cable/all.json",
            timeout=30,
        )
        lr.raise_for_status()
        cable_list = lr.json()
        log.info(f"  Got {len(cable_list)} cable metadata records")
    except Exception as e:
        log.error(f"  cable/all.json failed: {e}")
        cable_list = []
 
    # slug → name (needed for landing point records)
    slug_to_name = {c.get("id", ""): c.get("name", "") for c in cable_list}
 
    # ── Step 3: Landing point coordinates ────────────────────────────────────
    log.info("  Fetching landing-point-geo.json…")
    lp_records: list[dict] = []   # {id, name, city, country, lat, lon}
 
    try:
        lpr = SESSION.get(
            "https://www.submarinecablemap.com/api/v3/landing-point/landing-point-geo.json",
            timeout=30,
        )
        lpr.raise_for_status()
        lp_features = lpr.json().get("features", [])
        log.info(f"  Got {len(lp_features)} landing point features")
 
        for feat in lp_features:
            props  = feat.get("properties", {})
            geom   = feat.get("geometry", {})
            lp_id  = props.get("id", "")
            if not lp_id:
                continue
            coords = geom.get("coordinates", [])
            lp_lon = coords[0] if len(coords) >= 2 else None
            lp_lat = coords[1] if len(coords) >= 2 else None
            if lp_lat is None or lp_lon is None:
                continue
 
            full_name   = props.get("name", "")
            name_parts  = full_name.split(",")
            city        = name_parts[0].strip()
            country     = name_parts[-1].strip() if len(name_parts) > 1 else ""
 
            lp_records.append({
                "id":      lp_id,
                "name":    full_name,
                "city":    city,
                "country": country,
                "lat":     float(lp_lat),
                "lon":     float(lp_lon),
            })
 
        log.info(f"  Parsed {len(lp_records)} landing points with coordinates")
 
    except Exception as e:
        log.error(f"  landing-point-geo.json failed: {e}")
        log.warning("  connected_cables will use city-proximity fallback")
 
    # ── Step 4: Spatial join — LP ↔ cable ─────────────────────────────────────
    # For each landing point, find cables whose route endpoint is within 50km.
    # Cable endpoints (first/last 10 coords) = where cables come ashore.
    log.info(
        f"  Running spatial join: {len(lp_records)} LPs × "
        f"{len(slug_to_coords)} cable routes…"
    )
 
    THRESHOLD_KM = 100.0
 
    landing_points: list[dict] = []       # seed records
    city_to_cables: dict[str, list] = {}  # city → [cable names] for data_adapters
 
    for lp in lp_records:
        lp_lat  = lp["lat"]
        lp_lon  = lp["lon"]
        lp_city = lp["city"]
 
        matched_cables: list[str] = []
 
        for slug, route in slug_to_coords.items():
            if _lp_near_cable(lp_lat, lp_lon, route, THRESHOLD_KM):
                cable_name = slug_to_name.get(slug, slug)
                matched_cables.append(cable_name)
                landing_points.append({
                    "id":         lp["id"],
                    "name":       lp["name"],
                    "city":       lp_city,
                    "country":    lp["country"],
                    "lat":        lp_lat,
                    "lon":        lp_lon,
                    "cable_id":   slug,
                    "cable_name": cable_name,
                    "match_method": "spatial_50km",  # provenance label
                })
 
        if matched_cables and lp_city:
            city_to_cables.setdefault(lp_city, [])
            for cn in matched_cables:
                if cn not in city_to_cables[lp_city]:
                    city_to_cables[lp_city].append(cn)
 
    lps_with_match = len({lp["id"] for lp in landing_points})
    log.info(
        f"  Spatial join complete: "
        f"{len(landing_points)} LP↔cable associations, "
        f"{lps_with_match}/{len(lp_records)} LPs matched, "
        f"{len(city_to_cables)} cities"
    )
    if city_to_cables:
        sample = list(city_to_cables.items())[:3]
        for city, cables in sample:
            log.info(f"  Sample: '{city}' → {cables[:3]}")
 
    # ── Step 5: Build cable records with LP city names ────────────────────────
    cables: list[dict] = []
    # Build slug → LP city names from spatial join results
    slug_to_lp_cities: dict[str, list] = {}
    for lp in landing_points:
        slug = lp["cable_id"]
        city = lp["city"]
        slug_to_lp_cities.setdefault(slug, [])
        if city and city not in slug_to_lp_cities[slug]:
            slug_to_lp_cities[slug].append(city)
 
    for cable in cable_list:
        slug = cable.get("id", "")
        if not slug:
            continue
 
        owners_list = cable.get("owners", [])
        owners_str  = ", ".join(
            o.get("name", "") for o in owners_list
            if isinstance(o, dict) and o.get("name")
        ) if isinstance(owners_list, list) else ""
 
        rfs = cable.get("rfs")
        if isinstance(rfs, str) and rfs.isdigit():
            rfs = int(rfs)
        elif not isinstance(rfs, (int, type(None))):
            rfs = None
 
        cables.append({
            "id":                  slug,
            "name":                cable.get("name", ""),
            "color":               cable.get("color", "#38BDF8"),
            "rfs":                 rfs,
            "length_km":           cable.get("length"),
            "owners":              owners_str,
            "owners_list":         owners_list if isinstance(owners_list, list) else [],
            "landing_point_names": slug_to_lp_cities.get(slug, []),  # from spatial join
            "notes":               cable.get("notes", ""),
            "coords":              slug_to_coords.get(slug, []),
            "source":              "telegeography",
            "source_url":          f"https://www.submarinecablemap.com/submarine-cable/{slug}",
        })
 
    cables_with_coords = sum(1 for c in cables if c["coords"])
    log.info(
        f"  Final: {len(cables)} cables, "
        f"{cables_with_coords} with geometry, "
        f"{len(landing_points)} landing point records"
    )
    return cables, landing_points
 


def _extract_cable_coords(geom: dict) -> list:
    if not geom:
        return []
    gtype = geom.get("type", "")
    raw   = geom.get("coordinates", [])
    coords = []
    if gtype == "LineString":
        coords = [[c[1], c[0]] for c in raw if len(c) >= 2]
    elif gtype == "MultiLineString":
        for line in raw:
            coords.extend([[c[1], c[0]] for c in line if len(c) >= 2])
    elif gtype == "GeometryCollection":
        for g in geom.get("geometries", []):
            coords.extend(_extract_cable_coords(g))
    return coords


# ─── 3. CAIDA AS-rank ────────────────────────────────────────────────────────

def fetch_caida_asns(top_n: int = 100) -> list[dict]:
    log.info(f"Fetching CAIDA AS-rank top {top_n} ASNs…")
    query = """{ asns(first: %d, sort: "rank") { edges { node {
        asn rank asnName country { iso }
        asnDegree { provider customer peer total }
        cone { numberAsns numberPrefixes numberAddresses }
        announcing { numberPrefixes }
    }}}}""" % top_n

    resp = SESSION.post(
        "https://api.asrank.caida.org/v2/graphql",
        json={"query": query}, timeout=30,
    )
    resp.raise_for_status()
    edges = resp.json().get("data", {}).get("asns", {}).get("edges", [])
    log.info(f"  CAIDA returned {len(edges)} ASNs")

    total = sum(e["node"]["cone"]["numberPrefixes"] for e in edges if e["node"].get("cone"))
    records = []
    for edge in edges:
        n   = edge["node"]
        d   = n.get("asnDegree") or {}
        c   = n.get("cone") or {}
        cp  = c.get("numberPrefixes", 0)
        pct = round(cp / total * 100, 2) if total else 0
        p   = d.get("provider", 0)
        r   = n.get("rank")
        tier = 1 if (p == 0 and r and r <= 20) else 2 if cp >= 50000 else 3
        records.append({
            "asn": str(n.get("asn", "")), "rank": r,
            "name": n.get("asnName", ""),
            "country": (n.get("country") or {}).get("iso", ""),
            "provider_count": p, "customer_count": d.get("customer", 0),
            "peer_count": d.get("peer", 0), "total_degree": d.get("total", 0),
            "cone_asns": c.get("numberAsns", 0), "cone_prefixes": cp,
            "cone_addresses": c.get("numberAddresses", 0),
            "announcing_prefixes": (n.get("announcing") or {}).get("numberPrefixes", 0),
            "tier": tier, "pct_of_routes": pct,
            "source": "caida_asrank",
            "source_url": f"https://api.asrank.caida.org/v2/as/{n.get('asn', '')}",
        })
    return records


# ─── Save + Main ─────────────────────────────────────────────────────────────

def save_seed(name: str, data: object) -> None:
    path = SEEDS_DIR / f"{name}.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    log.info(f"  Saved {path} ({path.stat().st_size // 1024} KB)")

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()

def main():
    log.info("=" * 60)
    log.info("Real Rails — fetch_real_data.py")
    log.info("=" * 60)
    errors = []

    try:
        ixps = fetch_peeringdb_ixps()
        save_seed("ixps", {"source": "peeringdb", "fetched_at": _now(), "data": ixps})
        log.info(f"✓ IXPs: {len(ixps)}")
    except Exception as e:
        log.error(f"✗ PeeringDB: {e}"); errors.append(str(e))

    try:
        cables, lps = fetch_telegeography_cables()
        save_seed("cables", {"source": "telegeography", "fetched_at": _now(), "data": cables})
        save_seed("landing_points", {"source": "telegeography", "fetched_at": _now(), "data": lps})
        log.info(f"✓ Cables: {len(cables)}, LPs: {len(lps)}")
    except Exception as e:
        log.error(f"✗ TeleGeography: {e}"); errors.append(str(e))

    try:
        asns = fetch_caida_asns(top_n=100)
        save_seed("asns", {"source": "caida_asrank", "fetched_at": _now(), "data": asns})
        log.info(f"✓ ASNs: {len(asns)}")
    except Exception as e:
        log.error(f"✗ CAIDA: {e}"); errors.append(str(e))

    log.info("=" * 60)
    if errors:
        for e in errors: log.warning(f"  - {e}")
        sys.exit(1)
    else:
        log.info("All seeds fetched successfully.")

if __name__ == "__main__":
    main()
    