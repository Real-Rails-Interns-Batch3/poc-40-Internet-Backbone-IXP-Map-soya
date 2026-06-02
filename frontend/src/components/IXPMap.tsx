'use client'
// frontend/src/components/IXPMap.tsx
//
// CHANGES FROM PREVIOUS VERSION — what was removed and why:
//   REMOVED: import { IXP_DATA, CABLE_DATA } from '@/lib/ixpData'
//            → replaced by fetchIXPs() and fetchCables() API calls
//   REMOVED: all direct reads of ixp.riskScore, ixp.tbps, ixp.operator,
//            ixp.asnConcentration, ixp.routeDependency, ixp.whyMatters, ixp.founded
//            → these fields are null from API; UI handles null gracefully
//   ADDED:   useEffect that fetches IXPs + cables from backend on mount
//   ADDED:   dataLoading state — shows skeleton until API responds
//   ADDED:   ixpNodes / cableFeatures state arrays (replaces static imports)
//   PRESERVED: all map init, Leaflet layer logic, glow ring, zoom, legend,
//              filter logic, search fly-to, tooltip card layout

import { useEffect, useRef, useState, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { fetchIXPs, fetchCables } from '@/lib/api'
import type {
  FilterState,
  IXPNode,
  IXPFeature,
  CableFeature,
} from '@/lib/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function riskColor(score: number | null, simActive: boolean): string {
  if (simActive) return '#F87171'
  if (score === null) return '#6B7280'   // grey — no data
  if (score >= 70) return '#F87171'      // red
  if (score >= 40) return '#FCD34D'      // yellow
  return '#34D399'                        // green
}

function tierRadius(tier: string): number {
  return tier === 'mega' ? 11 : tier === 'large' ? 8 : tier === 'medium' ? 6 : 5
}

/** Convert a GeoJSON IXPFeature → flat IXPNode for use throughout the app */
function featureToNode(f: IXPFeature): IXPNode {
  const p = f.properties
  const [lon, lat] = f.geometry.coordinates
  return {
    id: p.id,
    peeringdbId: p.peeringdb_id,
    name: p.name,
    nameLong: p.name_long,
    lat,
    lon,
    country: p.country,
    city: p.city,
    region: p.region,
    website: p.website,
    members: p.member_count,
    tier: p.tier,
    protoIpv6: p.proto_ipv6,
    created: p.created,
    sourceUrl: p.source_url,
    connectedCables: p.connected_cables ?? [],
    trafficTbps: null,
    riskScore: p.risk_score,
    asnConcentration: null,
  }
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  filters: FilterState
  simResult: null | object
  onSelectIXP: (ixp: IXPNode | null) => void
  selectedIXP: IXPNode | null
  searchTarget: string | null
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function IXPMap({
  filters,
  simResult,
  onSelectIXP,
  selectedIXP,
  searchTarget,
}: Props) {
  const mapRef           = useRef<L.Map | null>(null)
  const layerGroupRef    = useRef<L.LayerGroup | null>(null)
  const cableGroupRef    = useRef<L.LayerGroup | null>(null)
  const glowGroupRef     = useRef<L.LayerGroup | null>(null)
  const mapContainerRef  = useRef<HTMLDivElement>(null)

  const [mapReady,       setMapReady]       = useState(false)
  const [dataLoading,    setDataLoading]    = useState(true)
  const [ixpNodes,       setIxpNodes]       = useState<IXPNode[]>([])
  const [cableFeatures,  setCableFeatures]  = useState<CableFeature[]>([])
  const [loadError,      setLoadError]      = useState<string | null>(null)

  // ── 1. Fetch IXPs + cables from backend (runs once) ──────────────────────
  useEffect(() => {
    setDataLoading(true)
    Promise.all([fetchIXPs(), fetchCables()])
      .then(([ixpGeo, cableGeo]) => {
        if (ixpGeo?.features) {
          setIxpNodes(ixpGeo.features.map(featureToNode))
        } else {
          setLoadError('IXP data unavailable — run fetch_real_data.py')
        }
        if (cableGeo?.features) {
          setCableFeatures(cableGeo.features)
        }
        setDataLoading(false)
      })
      .catch(err => {
        setLoadError(`Backend unreachable: ${err.message}`)
        setDataLoading(false)
      })
  }, [])

  // ── 2. Map initialisation (runs once) ────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return
    const map = L.map(mapContainerRef.current, {
      center: [20, 10],
      zoom: 2,
      minZoom: 1,
      maxZoom: 8,
      zoomControl: false,
      attributionControl: false,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      opacity: 0.15,
    }).addTo(map)
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    mapRef.current      = map
    cableGroupRef.current  = L.layerGroup().addTo(map)
    layerGroupRef.current  = L.layerGroup().addTo(map)
    glowGroupRef.current   = L.layerGroup().addTo(map)
    setTimeout(() => setMapReady(true), 400)
  }, [])

  // ── 3. Redraw whenever data / filters / selection changes ─────────────────
  useEffect(() => {
    if (
      !mapRef.current ||
      !layerGroupRef.current ||
      !cableGroupRef.current ||
      !glowGroupRef.current ||
      dataLoading
    ) return

    layerGroupRef.current.clearLayers()
    cableGroupRef.current.clearLayers()
    glowGroupRef.current.clearLayers()

    const simActive = !!simResult

    // ── Cables (from TeleGeography API) ─────────────────────────────────────
    if (filters.showCables) {
      cableFeatures.forEach(cable => {
        const p = cable.properties
        // Leaflet polyline needs [[lat, lon], ...]; GeoJSON is [[lon, lat], ...]
        const leafletCoords = cable.geometry.coordinates.map(
          ([lon, lat]) => [lat, lon] as [number, number]
        )
        if (leafletCoords.length < 2) return

        const isConnected = selectedIXP?.connectedCables.includes(p.name)
        const color   = simActive ? '#F87171' : isConnected ? '#FCD34D' : (p.color || '#38BDF8')
        const opacity = simActive ? 0.25      : isConnected ? 0.85      : 0.4
        const weight  = isConnected ? 2.5 : 1.5

        const line = L.polyline(leafletCoords, {
          color,
          weight,
          opacity,
          dashArray: isConnected ? undefined : '5, 6',
        })

        // Tooltip — only shows real fields; null fields shown as "—"
        line.bindTooltip(`
          <div style="font-family:monospace;font-size:11px;color:#E5E7EB;line-height:1.6">
            <div style="color:#38BDF8;font-weight:bold;margin-bottom:4px">⎯ ${p.name}</div>
            <div style="color:#6B7280">Owners:&nbsp;&nbsp;<span style="color:#818CF8">${p.owners || '—'}</span></div>
            <div style="color:#6B7280">RFS:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#E5E7EB">${p.rfs ?? '—'}</span></div>
            <div style="color:#6B7280">Length:&nbsp;&nbsp;<span style="color:#34D399">${p.length_km ? p.length_km.toLocaleString() + ' km' : '—'}</span></div>
            <div style="color:#374151;font-size:9px;margin-top:3px">Source: TeleGeography</div>
          </div>
        `, { className: 'rr-tooltip', sticky: true })

        line.addTo(cableGroupRef.current!)
      })
    }

    // ── IXP Nodes (from PeeringDB API) ───────────────────────────────────────
    ixpNodes.forEach(ixp => {
      // Region filter
      if (filters.region !== 'all' && ixp.region !== filters.region) return

      // Risk filter — based on derived riskScore (null = unscored, shown in all views)
      if (filters.risk !== 'all' && ixp.riskScore !== null) {
        if (filters.risk === 'low'    && ixp.riskScore >= 40) return
        if (filters.risk === 'medium' && (ixp.riskScore < 40 || ixp.riskScore >= 70)) return
        if (filters.risk === 'high'   && ixp.riskScore < 70) return
      }

      // Tier-1 hub filter
      if (filters.tier1Only && !['mega', 'large'].includes(ixp.tier)) return

      const isSelected = selectedIXP?.id === ixp.id
      const col    = riskColor(ixp.riskScore, simActive)
      const radius = tierRadius(ixp.tier)

      // Glow rings for selected node
      if (isSelected) {
        L.circleMarker([ixp.lat, ixp.lon], {
          radius: radius + 8,
          fillColor: 'transparent',
          color: '#38BDF8',
          weight: 2,
          opacity: 0.7,
          fillOpacity: 0,
          className: 'ixp-glow-ring',
        }).addTo(glowGroupRef.current!)

        L.circleMarker([ixp.lat, ixp.lon], {
          radius: radius + 14,
          fillColor: 'transparent',
          color: '#38BDF8',
          weight: 1,
          opacity: 0.3,
          fillOpacity: 0,
        }).addTo(glowGroupRef.current!)
      }

      // Main marker
      const marker = L.circleMarker([ixp.lat, ixp.lon], {
        radius,
        fillColor: col,
        color: isSelected ? '#38BDF8' : col,
        weight: isSelected ? 2.5 : 1,
        opacity: 0.95,
        fillOpacity: isSelected ? 1 : 0.82,
      })

      // Hover tooltip — null-safe; never shows fabricated values
      const riskScore = ixp.riskScore
      const riskLabel = riskScore === null ? '⬜ UNSCORED'
        : riskScore >= 70 ? '🔴 HIGH'
        : riskScore >= 40 ? '🟡 MEDIUM'
        : '🟢 LOW'
      const riskHex = riskScore === null ? '#6B7280'
        : riskScore >= 70 ? '#F87171'
        : riskScore >= 40 ? '#FCD34D'
        : '#34D399'
      const riskDisplay = riskScore !== null ? `${riskLabel} (${riskScore}/100)` : riskLabel

      marker.bindTooltip(`
        <div style="font-family:monospace;font-size:11px;color:#E5E7EB;line-height:1.8;min-width:180px">
          <div style="color:#38BDF8;font-weight:bold;font-size:12px;margin-bottom:5px;
                      border-bottom:1px solid #1F2937;padding-bottom:4px">${ixp.name}</div>
          <div style="color:#6B7280">Region:&nbsp;&nbsp;&nbsp;<span style="color:#E5E7EB">${ixp.region} · ${ixp.country}</span></div>
          <div style="color:#6B7280">City:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#E5E7EB">${ixp.city}</span></div>
          <div style="color:#6B7280">Members:&nbsp;&nbsp;<span style="color:#818CF8">${ixp.members.toLocaleString()}</span></div>
          <div style="color:#6B7280">Traffic:&nbsp;&nbsp;&nbsp;<span style="color:#9CA3AF">Not disclosed</span></div>
          <div style="margin-top:4px;color:#6B7280">Risk:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:${riskHex}">${riskDisplay}</span></div>
          <div style="color:#374151;font-size:9px;margin-top:4px">
            Source: PeeringDB · Click for full intelligence
          </div>
        </div>
      `, { className: 'rr-tooltip', sticky: false, offset: [14, 0] })

      marker.on('click', () => onSelectIXP(isSelected ? null : ixp))
      marker.addTo(layerGroupRef.current!)
    })

  }, [filters, simResult, selectedIXP, onSelectIXP, ixpNodes, cableFeatures, dataLoading])

  // ── 4. Search fly-to ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!searchTarget || !mapRef.current) return
    const node = ixpNodes.find(i => i.id === searchTarget)
    if (node) {
      mapRef.current.flyTo([node.lat, node.lon], 5, { duration: 1.2 })
      onSelectIXP(node)
    }
  }, [searchTarget, ixpNodes, onSelectIXP])

  // ─── Render ───────────────────────────────────────────────────────────────

  const isLoading = !mapReady || dataLoading

  return (
    <div className="w-full h-full relative">

      {/* Loading / error overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-[2000] flex flex-col items-center justify-center bg-[#060e1a] gap-3">
          {loadError ? (
            <>
              <div className="text-red-400 font-mono text-[11px] tracking-widest">
                ⚠ DATA LOAD ERROR
              </div>
              <div className="text-rr-muted font-mono text-[10px] max-w-xs text-center leading-relaxed">
                {loadError}
              </div>
            </>
          ) : (
            <>
              <div className="flex gap-1.5">
                {[0, 1, 2, 3, 4].map(i => (
                  <div
                    key={i}
                    className="w-1.5 h-6 rounded-full bg-rr-cyan/40 animate-pulse"
                    style={{ animationDelay: `${i * 120}ms` }}
                  />
                ))}
              </div>
              <div className="text-rr-cyan font-mono text-[11px] tracking-widest animate-pulse">
                LOADING BACKBONE DATA…
              </div>
              <div className="text-rr-muted font-mono text-[9px]">
                PeeringDB IXPs · TeleGeography Cables · CAIDA ASNs
              </div>
            </>
          )}
        </div>
      )}

      {/* Data source attribution strip */}
      {!isLoading && (
        <div className="absolute top-2 right-2 z-[1000] flex gap-1">
          {[
            { label: 'PeeringDB', cls: 'text-rr-cyan border-rr-cyan/25 bg-rr-cyan/10' },
            { label: 'TeleGeography', cls: 'text-amber-300 border-amber-400/20 bg-amber-400/10' },
          ].map(s => (
            <span key={s.label}
              className={`text-[9px] font-mono border px-1.5 py-0.5 rounded backdrop-blur-sm ${s.cls}`}>
              {s.label}
            </span>
          ))}
        </div>
      )}

      {/* Leaflet canvas */}
      <div
        ref={mapContainerRef}
        className="w-full h-full"
        style={{
          background: '#060e1a',
          opacity: mapReady ? 1 : 0,
          transition: 'opacity 0.5s ease',
        }}
      />

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-[1000] glass-card px-3 py-2.5 text-xs space-y-1.5">
        <div className="text-[9px] font-mono text-rr-muted tracking-widest uppercase mb-2">
          Risk Threshold
        </div>
        {[
          { color: '#F87171', label: 'High Risk  (score ≥70)' },
          { color: '#FCD34D', label: 'Medium     (40–69)'     },
          { color: '#34D399', label: 'Low Risk   (<40)'       },
          { color: '#6B7280', label: 'Unscored'               },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
            <span className="text-rr-muted font-mono text-[10px]">{label}</span>
          </div>
        ))}
        <div className="border-t border-rr-border pt-1.5 mt-1">
          {[
            { size: 11, label: 'Mega IXP (>500 members)' },
            { size: 8,  label: 'Large IXP'               },
            { size: 6,  label: 'Medium IXP'              },
          ].map(({ size, label }) => (
            <div key={label} className="flex items-center gap-2 mb-1">
              <span
                className="rounded-full flex-shrink-0 border border-rr-border"
                style={{ width: size, height: size, background: '#374151' }}
              />
              <span className="text-rr-muted text-[10px]">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <span className="inline-block w-5 border-t border-dashed border-rr-cyan/50" />
            <span className="text-rr-muted text-[10px]">Submarine Cable</span>
          </div>
        </div>

        {/* Live node count — from real API */}
        {!dataLoading && (
          <div className="border-t border-rr-border pt-1.5 mt-1 text-[9px] font-mono text-rr-muted">
            {ixpNodes.length} IXPs · {cableFeatures.length} cables
          </div>
        )}
      </div>
    </div>
  )
}
