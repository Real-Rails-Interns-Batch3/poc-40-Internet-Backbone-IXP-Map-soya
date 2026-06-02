// frontend/src/lib/types.ts
// Shapes exactly match the JSON returned by the FastAPI backend.
// No field is assumed to be non-null unless the backend guarantees it.

// ─── From GET /api/ixps/geojson ─────────────────────────────────────────────

export interface IXPProperties {
  id: string
  peeringdb_id: number
  name: string
  name_long: string
  country: string
  city: string
  region: string
  website: string
  member_count: number
  tier: 'mega' | 'large' | 'medium' | 'small'
  proto_ipv6: boolean
  created: string
  updated: string
  source: 'peeringdb'
  source_url: string
  connected_cables: string[]
  traffic_tbps: null
  risk_score: number | null
  asn_concentration: null
}

export interface IXPFeature {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: IXPProperties
}

export interface IXPFeatureCollection {
  type: 'FeatureCollection'
  features: IXPFeature[]
}

/** Flattened node — built from IXPFeature by useIXPs() hook */
export interface IXPNode {
  id: string
  peeringdbId: number
  name: string
  nameLong: string
  lat: number
  lon: number
  country: string
  city: string
  region: string
  website: string
  members: number
  tier: 'mega' | 'large' | 'medium' | 'small'
  protoIpv6: boolean
  created: string
  sourceUrl: string
  connectedCables: string[]
  trafficTbps: null
  riskScore: number | null
  asnConcentration: null
}

// ─── From GET /api/cables/geojson ────────────────────────────────────────────

export interface CableProperties {
  id: string
  name: string
  color: string
  rfs: number | null
  length_km: number | null
  owners: string
  source: 'telegeography'
  source_url: string
  capacity_tbps: null
}

export interface CableFeature {
  type: 'Feature'
  geometry: { type: 'LineString'; coordinates: [number, number][] }
  properties: CableProperties
}

export interface CableFeatureCollection {
  type: 'FeatureCollection'
  features: CableFeature[]
}

// ─── From GET /api/asns ──────────────────────────────────────────────────────

export interface ASNRecord {
  asn: string
  rank: number | null
  name: string
  country: string
  tier: 1 | 2 | 3
  provider_count: number
  customer_count: number
  peer_count: number
  cone_prefixes: number
  announcing_prefixes: number
  pct_of_routes: number
  source: 'caida_asrank'
  source_url: string
}

// ─── From GET /api/metrics/concentration ────────────────────────────────────

export interface ConcentrationMetrics {
  total_asns_tracked: number
  top5_control_pct: number
  top10_control_pct: number
  herfindahl_index: number
  top_operators: ASNRecord[]
  data_source: string
  insight: string
}

// ─── From GET /api/ixps/{id}/intelligence ────────────────────────────────────

export interface IXPIntelligence {
  peeringdb_id: number
  name: string
  city: string
  country: string
  region: string
  website: string
  member_count: number
  tier: string
  proto_ipv6: boolean
  created: string
  source: string
  source_url: string
  risk_score: number | null
  risk_score_method: string
  connected_cables: string[]
  connected_cables_source: string
  traffic_tbps: null
  traffic_tbps_note: string
  asn_concentration: null
  asn_concentration_note: string
  route_dependency: null
  route_dependency_note: string
}

// ─── UI state ────────────────────────────────────────────────────────────────

export interface FilterState {
  region: string
  risk: string
  tier1Only: boolean
  showCables: boolean
}

export interface SearchResult {
  type: 'ixp' | 'asn' | 'cable'
  id: string
  label: string
  sublabel: string
}

export const REGIONS = ['all', 'Europe', 'Americas', 'AsiaPac', 'MiddleEast', 'Africa'] as const