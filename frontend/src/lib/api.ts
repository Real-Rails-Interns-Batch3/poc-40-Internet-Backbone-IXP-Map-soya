// frontend/src/lib/api.ts
// INCREMENTAL CHANGE: added fetchIXPIntelligence()
// All other functions unchanged.

import axios from 'axios'
import type {
  IXPFeatureCollection,
  CableFeatureCollection,
  ConcentrationMetrics,
  IXPIntelligence,
} from '@/lib/types'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
export const api = axios.create({ baseURL: BASE, timeout: 8000 })

export async function fetchIXPs(params?: {
  country?: string
  min_members?: number
}): Promise<IXPFeatureCollection | null> {
  try {
    const res = await api.get('/api/ixps/geojson', { params })
    return res.data
  } catch { return null }
}

export async function fetchCables(params?: {
  owner?: string
}): Promise<CableFeatureCollection | null> {
  try {
    const res = await api.get('/api/cables/geojson', { params })
    return res.data
  } catch { return null }
}

export async function fetchASNs(params?: { tier?: string; country?: string }) {
  try {
    const res = await api.get('/api/asns', { params })
    return res.data
  } catch { return null }
}

export async function fetchConcentration(): Promise<ConcentrationMetrics | null> {
  try {
    const res = await api.get('/api/metrics/concentration')
    return res.data
  } catch { return null }
}

export async function fetchRouteFailure(asn_id?: string) {
  try {
    const res = await api.get('/api/simulation/route-failure', { params: { asn_id } })
    return res.data
  } catch { return null }
}

export async function fetchSidebar() {
  try {
    const res = await api.get('/api/intelligence/sidebar')
    return res.data
  } catch { return null }
}

// ── NEW: per-node intelligence handshake ─────────────────────────────────────
export async function fetchIXPIntelligence(
  ixpId: string
): Promise<IXPIntelligence | null> {
  try {
    const res = await api.get(`/api/ixps/${ixpId}/intelligence`)
    return res.data
  } catch { return null }
}