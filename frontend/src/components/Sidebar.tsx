'use client'
// frontend/src/components/Sidebar.tsx
//
// CHANGES FROM PREVIOUS VERSION — what was removed and why:
//   REMOVED: import { IXP_DATA, ASN_DATA, CABLE_DATA, REGIONS } from '@/lib/ixpData'
//            → all data now comes from API calls
//   REMOVED: local downloadCSV() that read IXP_DATA directly
//            → now calls /api/download/sample (backend serves real PeeringDB CSV)
//   REMOVED: hardcoded counts '14', '7', '20' in Section A
//            → now shows real counts from API response
//   REMOVED: selectedIXP.operator / .tbps / .asnConcentration / .routeDependency /
//            .whyMatters / .founded — these fields no longer exist on IXPNode
//            → replaced with IXPIntelligence fetched per-click from backend
//   REMOVED: ASN_DATA local array for Section C bars
//            → now uses asnRecords state from fetchASNs() API call
//   REMOVED: search over local IXP_DATA / ASN_DATA / CABLE_DATA
//            → search now queries ixpNodes / asnRecords / cableNames (from API)
//   PRESERVED: all UI layout, all CSS classes, Obsidian DNA, 70/30 layout,
//              filter buttons, sim panel, data source strip, loading skeletons

import { useEffect, useState, useCallback } from 'react'
import {
  fetchConcentration,
  fetchRouteFailure,
  fetchASNs,
  fetchIXPs,
  fetchCables,
  fetchIXPIntelligence,
} from '@/lib/api'
import type {
  FilterState,
  IXPNode,
  IXPIntelligence,
  ASNRecord,
  ConcentrationMetrics,
  SearchResult,
} from '@/lib/types'
import { REGIONS } from '@/lib/types'

// ─── Sub-components ──────────────────────────────────────────────────────────

function RiskBadge({ score }: { score: number | null }) {
  if (score === null) return (
    <span className="text-[9px] font-mono border rounded px-1.5 py-0.5 text-rr-muted border-rr-border bg-rr-border/20">
      UNSCORED
    </span>
  )
  const { label, cls } = score >= 70
    ? { label: 'HIGH RISK', cls: 'text-red-400 border-red-400/30 bg-red-400/10' }
    : score >= 40
    ? { label: 'MEDIUM',    cls: 'text-amber-300 border-amber-400/25 bg-amber-400/10' }
    : { label: 'LOW RISK',  cls: 'text-emerald-400 border-emerald-400/25 bg-emerald-400/10' }
  return <span className={`text-[9px] font-mono border rounded px-1.5 py-0.5 ${cls}`}>{label}</span>
}

function SkeletonLine({ w = 'w-full', h = 'h-3' }: { w?: string; h?: string }) {
  return <div className={`${w} ${h} bg-rr-border/60 rounded animate-pulse`} />
}

function SectionHeader({ label }: { label: string }) {
  return (
    <h3 className="text-[10px] font-mono tracking-[0.12em] uppercase text-rr-cyan mb-2.5">
      {label}
    </h3>
  )
}

/** Null-safe value cell — shows "—" with tooltip when data isn't available */
function NullableValue({
  value,
  note,
  cls = 'text-rr-muted',
}: {
  value: string | null
  note?: string
  cls?: string
}) {
  if (value !== null) return <span className={cls}>{value}</span>
  return (
    <span
      className="text-rr-muted/50 cursor-help border-b border-dashed border-rr-border"
      title={note ?? 'Not available from public API'}
    >
      —
    </span>
  )
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  filters: FilterState
  onFiltersChange: (f: Partial<FilterState>) => void
  simResult: null | object
  onSimulate: (r: object | null) => void
  selectedIXP: IXPNode | null
  onSearchSelect: (id: string) => void
  isLiveData: boolean
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Sidebar({
  filters,
  onFiltersChange,
  simResult,
  onSimulate,
  selectedIXP,
  onSearchSelect,
  isLiveData,
}: Props) {

  // ── API state ──────────────────────────────────────────────────────────────
  const [concentration, setConcentration] = useState<ConcentrationMetrics | null>(null)
  const [asnRecords,    setAsnRecords]    = useState<ASNRecord[]>([])
  const [ixpCount,      setIxpCount]      = useState<number | null>(null)
  const [cableCount,    setCableCount]    = useState<number | null>(null)
  const [intelligence,  setIntelligence]  = useState<IXPIntelligence | null>(null)
  const [intelLoading,  setIntelLoading]  = useState(false)

  // ── UI state ───────────────────────────────────────────────────────────────
  const [loading,       setLoading]       = useState(true)
  const [simLoading,    setSimLoading]    = useState(false)
  const [searchQuery,   setSearchQuery]   = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [showSearch,    setShowSearch]    = useState(false)

  // Search index state (populated from API)
  const [ixpIndex,      setIxpIndex]      = useState<{ id: string; name: string; country: string; region: string; members: number }[]>([])
  const [asnIndex,      setAsnIndex]      = useState<{ asn: string; name: string; tier: number; pct: number }[]>([])
  const [cableIndex,    setCableIndex]    = useState<{ id: string; name: string; owners: string; rfs: number | null }[]>([])

  // ── Initial data fetch ─────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchConcentration(),
      fetchASNs(),
      fetchIXPs(),
      fetchCables(),
    ]).then(([conc, asnData, ixpGeo, cableGeo]) => {
      if (conc)    setConcentration(conc)
      if (asnData?.asns) {
        setAsnRecords(asnData.asns)
        setAsnIndex(asnData.asns.map((a: ASNRecord) => ({
          asn: a.asn,
          name: a.name,
          tier: a.tier,
          pct: a.pct_of_routes,
        })))
      }
      if (ixpGeo?.features) {
        setIxpCount(ixpGeo.features.length)
        setIxpIndex(ixpGeo.features.map((f: { properties: { id: string; name: string; country: string; region: string; member_count: number } }) => ({
          id: f.properties.id,
          name: f.properties.name,
          country: f.properties.country,
          region: f.properties.region,
          members: f.properties.member_count,
        })))
      }
      if (cableGeo?.features) {
        setCableCount(cableGeo.features.length)
        setCableIndex(cableGeo.features.map((f: { properties: { id: string; name: string; owners: string; rfs: number | null } }) => ({
          id: f.properties.id,
          name: f.properties.name,
          owners: f.properties.owners,
          rfs: f.properties.rfs,
        })))
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  // ── Fetch per-node intelligence when node is selected ─────────────────────
  useEffect(() => {
    if (!selectedIXP) { setIntelligence(null); return }
    setIntelLoading(true)
    fetchIXPIntelligence(selectedIXP.id)
      .then(data => { setIntelligence(data); setIntelLoading(false) })
      .catch(() => setIntelLoading(false))
  }, [selectedIXP])

  // ── Search over API-sourced indexes ───────────────────────────────────────
  const runSearch = useCallback((q: string) => {
    if (!q.trim()) { setSearchResults([]); return }
    const lower = q.toLowerCase()
    const results: SearchResult[] = []

    ixpIndex.forEach(i => {
      if (i.name.toLowerCase().includes(lower) || i.country.toLowerCase().includes(lower)) {
        results.push({
          type: 'ixp',
          id: i.id,
          label: i.name,
          sublabel: `${i.region} · ${i.members.toLocaleString()} members · PeeringDB`,
        })
      }
    })
    asnIndex.forEach(a => {
      if (a.name.toLowerCase().includes(lower) || a.asn.includes(lower)) {
        results.push({
          type: 'asn',
          id: a.asn,
          label: `AS${a.asn} — ${a.name}`,
          sublabel: `Tier ${a.tier} · ${a.pct.toFixed(2)}% cone · CAIDA`,
        })
      }
    })
    cableIndex.forEach(c => {
      if (c.name.toLowerCase().includes(lower) || c.owners.toLowerCase().includes(lower)) {
        results.push({
          type: 'cable',
          id: c.id,
          label: c.name,
          sublabel: `RFS ${c.rfs ?? '—'} · ${c.owners.split(',')[0]} · TeleGeography`,
        })
      }
    })
    setSearchResults(results.slice(0, 8))
  }, [ixpIndex, asnIndex, cableIndex])

  useEffect(() => { runSearch(searchQuery) }, [searchQuery, runSearch])

  // ── Route failure simulation ───────────────────────────────────────────────
  async function handleSimulate() {
    if (simResult) { onSimulate(null); return }
    setSimLoading(true)
    const result = await fetchRouteFailure()
    onSimulate(result ?? null)
    setSimLoading(false)
  }

  // ── CSV download — delegates to backend /api/download/sample ──────────────
  function downloadCSV() {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    window.open(`${base}/api/download/sample`, '_blank')
  }

  // ── Derived display values ─────────────────────────────────────────────────
  const top5  = concentration?.top5_control_pct  ?? null
  const top10 = concentration?.top10_control_pct ?? null
  const hhi   = concentration?.herfindahl_index  ?? null
  const maxPct = asnRecords.length
    ? Math.max(...asnRecords.map(a => a.pct_of_routes))
    : 1

  const simR = simResult as Record<string, unknown> | null

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-full">

      {/* ── Live/Mock Status + Search toggle ──────────────────────────────── */}
      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <div className={`flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded border ${
          isLiveData
            ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10'
            : 'text-amber-300 border-amber-400/25 bg-amber-400/10'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            isLiveData ? 'bg-emerald-400 animate-pulse' : 'bg-amber-300'
          }`} />
          {isLiveData ? 'LIVE DATA' : 'SEEDS MODE'}
        </div>
        <button
          onClick={() => setShowSearch(s => !s)}
          className={`text-[10px] font-mono px-2 py-1 rounded border transition-all ${
            showSearch
              ? 'text-rr-cyan border-rr-cyan/40 bg-rr-cyan/10'
              : 'text-rr-muted border-rr-border hover:border-rr-cyan/30'
          }`}
        >
          ⌕ Search
        </button>
      </div>

      {/* ── Search Panel ──────────────────────────────────────────────────── */}
      {showSearch && (
        <div className="px-4 py-2 border-b border-rr-border">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search IXP · ASN · Cable…"
            className="w-full bg-rr-bg border border-rr-border rounded px-2.5 py-1.5
              text-[11px] text-rr-text font-mono placeholder:text-rr-muted
              focus:outline-none focus:border-rr-cyan/50 transition-colors"
            autoFocus
          />
          {searchResults.length > 0 && (
            <div className="mt-1.5 space-y-0.5 max-h-48 overflow-y-auto">
              {searchResults.map(r => (
                <button
                  key={`${r.type}-${r.id}`}
                  onClick={() => {
                    if (r.type === 'ixp') onSearchSelect(r.id)
                    setSearchQuery('')
                    setShowSearch(false)
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-rr-border/40 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-mono border rounded px-1 py-0.5 ${
                      r.type === 'ixp'   ? 'text-rr-cyan   border-rr-cyan/25   bg-rr-cyan/10'
                      : r.type === 'asn' ? 'text-rr-indigo border-rr-indigo/25 bg-rr-indigo/10'
                      : 'text-amber-300 border-amber-400/20 bg-amber-400/10'
                    }`}>{r.type.toUpperCase()}</span>
                    <span className="text-[11px] text-rr-text group-hover:text-rr-cyan transition-colors truncate">
                      {r.label}
                    </span>
                  </div>
                  <div className="text-[10px] text-rr-muted pl-9 mt-0.5 truncate">{r.sublabel}</div>
                </button>
              ))}
            </div>
          )}
          {searchQuery && searchResults.length === 0 && (
            <div className="text-[10px] text-rr-muted font-mono px-1 mt-1.5">
              No results for &ldquo;{searchQuery}&rdquo;
            </div>
          )}
        </div>
      )}

      {/* ── Section A — Intelligence Summary ──────────────────────────────── */}
      <section className="px-4 py-3 border-b border-rr-border">
        <SectionHeader label="Section A — Intelligence Summary" />
        {loading ? (
          <div className="space-y-2">{[1,2,3,4,5].map(i => <SkeletonLine key={i} />)}</div>
        ) : (
          <>
            {[
              {
                label: 'IXPs Mapped',
                val: ixpCount !== null ? ixpCount.toLocaleString() : '—',
                cls: 'text-rr-cyan',
                note: 'PeeringDB geocoded IXPs',
              },
              {
                label: 'Submarine Cables',
                val: cableCount !== null ? cableCount.toLocaleString() : '—',
                cls: 'text-rr-cyan',
                note: 'TeleGeography',
              },
              {
                label: 'ASNs Tracked',
                val: asnRecords.length > 0 ? asnRecords.length.toLocaleString() : '—',
                cls: 'text-rr-cyan',
                note: 'CAIDA AS-rank top-N',
              },
              {
                label: 'Top-5 Route Control',
                val: top5 !== null ? `${top5.toFixed(1)}%` : '—',
                cls: 'text-red-400',
                note: 'CAIDA cone_prefixes',
              },
              {
                label: 'Top-10 Control',
                val: top10 !== null ? `${top10.toFixed(1)}%` : '—',
                cls: 'text-amber-300',
                note: 'CAIDA cone_prefixes',
              },
            ].map(({ label, val, cls, note }) => (
              <div key={label} className="flex justify-between items-baseline mb-1"
                   title={note}>
                <span className="text-rr-muted text-[11px]">{label}</span>
                <span className={`font-mono text-sm font-medium ${cls}`}>{val}</span>
              </div>
            ))}

            {top10 !== null && (
              <div className="mt-2">
                <div className="flex justify-between text-[10px] text-rr-muted mb-1">
                  <span>Top-10 ASN route concentration</span>
                  <span className="text-red-400">{top10.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-rr-border rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${top10}%`,
                      background: 'linear-gradient(90deg, #38BDF8, #F87171)',
                    }}
                  />
                </div>
              </div>
            )}

            {hhi !== null && (
              <div className="mt-1.5 text-[10px] text-rr-muted font-mono">
                HHI: <span className={hhi > 2500 ? 'text-red-400' : 'text-amber-300'}>
                  {hhi.toFixed(0)}
                </span>
                <span className="ml-1 text-rr-muted/60">
                  ({hhi > 2500 ? 'highly concentrated' : 'moderate'})
                </span>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Node Intelligence Handshake ───────────────────────────────────── */}
      {selectedIXP ? (
        <section className="px-4 py-3 border-b border-rr-border bg-rr-cyan/[0.02]">
          <div className="flex items-center justify-between mb-2.5">
            <SectionHeader label="Node Intelligence" />
            <RiskBadge score={selectedIXP.riskScore} />
          </div>

          {/* Node title */}
          <div className="flex items-start gap-2 mb-3">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
              style={{
                background: selectedIXP.riskScore === null ? '#6B7280'
                  : selectedIXP.riskScore >= 70 ? '#F87171'
                  : selectedIXP.riskScore >= 40 ? '#FCD34D'
                  : '#34D399',
              }}
            />
            <div>
              <div className="text-sm font-semibold text-rr-text leading-tight">
                {selectedIXP.name}
              </div>
              <div className="text-[10px] text-rr-muted font-mono mt-0.5">
                {selectedIXP.city}, {selectedIXP.country}
              </div>
              {selectedIXP.website && (
                <a
                  href={selectedIXP.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-rr-cyan/60 hover:text-rr-cyan font-mono mt-0.5 block transition-colors"
                >
                  {selectedIXP.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          </div>

          {/* Intelligence metrics grid */}
          {intelLoading ? (
            <div className="grid grid-cols-2 gap-2 mb-3">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="bg-rr-bg/60 rounded p-2 border border-rr-border/60">
                  <SkeletonLine w="w-3/4" h="h-2" />
                  <SkeletonLine w="w-1/2" h="h-4" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 mb-3">
              {[
                {
                  label: 'Members',
                  val: selectedIXP.members.toLocaleString(),
                  note: 'PeeringDB net_set count',
                  cls: 'text-rr-cyan',
                },
                {
                  label: 'Risk Score',
                  val: selectedIXP.riskScore !== null ? `${selectedIXP.riskScore}/100` : null,
                  note: intelligence?.risk_score_method ?? 'Derived from member_count + tier',
                  cls: selectedIXP.riskScore === null ? '' :
                    selectedIXP.riskScore >= 70 ? 'text-red-400' :
                    selectedIXP.riskScore >= 40 ? 'text-amber-300' : 'text-emerald-400',
                },
                {
                  label: 'ASN Concentration',
                  val: null,
                  note: intelligence?.asn_concentration_note ?? 'Requires PeeringDB depth=2',
                  cls: 'text-rr-muted',
                },
                {
                  label: 'Route Dependency',
                  val: null,
                  note: intelligence?.route_dependency_note ?? 'Not available from public APIs',
                  cls: 'text-rr-muted',
                },
                {
                  label: 'Peak Traffic',
                  val: null,
                  note: intelligence?.traffic_tbps_note ?? 'Not disclosed by PeeringDB',
                  cls: 'text-rr-muted',
                },
                {
                  label: 'IPv6',
                  val: selectedIXP.protoIpv6 ? 'Supported' : 'Not listed',
                  note: 'PeeringDB proto_ipv6',
                  cls: selectedIXP.protoIpv6 ? 'text-emerald-400' : 'text-rr-muted',
                },
              ].map(({ label, val, note, cls }) => (
                <div
                  key={label}
                  className="bg-rr-bg/60 rounded p-2 border border-rr-border/60"
                  title={note}
                >
                  <div className="text-[9px] text-rr-muted font-mono uppercase tracking-wide">
                    {label}
                  </div>
                  <div className={`text-sm font-mono font-medium mt-0.5 ${cls}`}>
                    <NullableValue value={val} note={note} cls={cls} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Connected cables */}
          {(intelligence?.connected_cables ?? selectedIXP.connectedCables).length > 0 && (
            <div className="mb-3">
              <div className="text-[9px] font-mono text-rr-muted uppercase tracking-widest mb-1.5">
                Nearby Cables
                <span className="normal-case ml-1 text-rr-muted/50">
                  (TeleGeography proximity)
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {(intelligence?.connected_cables ?? selectedIXP.connectedCables).map(c => (
                  <span
                    key={c}
                    className="text-[10px] font-mono border border-amber-400/20 bg-amber-400/10 text-amber-300 px-1.5 py-0.5 rounded"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Risk score bar */}
          {selectedIXP.riskScore !== null && (
            <div className="mb-3">
              <div className="flex justify-between text-[9px] text-rr-muted font-mono mb-1">
                <span>Concentration Risk (derived)</span>
                <span>{selectedIXP.riskScore}/100</span>
              </div>
              <div className="w-full bg-rr-border rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${selectedIXP.riskScore}%`,
                    background: selectedIXP.riskScore >= 70 ? '#F87171'
                      : selectedIXP.riskScore >= 40 ? '#FCD34D'
                      : '#34D399',
                  }}
                />
              </div>
              <div className="text-[9px] text-rr-muted/50 font-mono mt-1">
                {intelligence?.risk_score_method ?? 'member_count rank + tier weight'}
              </div>
            </div>
          )}

          {/* PeeringDB deep link */}
          <div className="flex items-center gap-2 mt-1">
            <a
              href={selectedIXP.sourceUrl || `https://www.peeringdb.com/ix/${selectedIXP.peeringdbId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-mono text-rr-cyan/60 hover:text-rr-cyan border border-rr-cyan/20
                hover:border-rr-cyan/40 px-2 py-1 rounded transition-all"
            >
              View on PeeringDB →
            </a>
            <span className="text-[9px] text-rr-muted/40 font-mono">
              ID: {selectedIXP.peeringdbId}
            </span>
          </div>
        </section>

      ) : (
        /* ── Section B — Default Why This Matters ──────────────────────── */
        <section className="px-4 py-3 border-b border-rr-border">
          <SectionHeader label="Section B — Why This Matters" />
          <p className="text-rr-muted text-xs leading-relaxed">
            Every financial transaction, cloud workload, and communication crosses a{' '}
            <strong className="text-rr-text font-medium">handful of physical exchange points</strong>.
            The top 5 network operators control{' '}
            <strong className="text-rr-text font-medium">
              {top5 !== null ? `${top5.toFixed(1)}%` : '—'}
            </strong>{' '}
            of global routing (CAIDA AS-rank, cone prefixes) — a structural concentration risk.
            When a Tier-1 carrier fails, entire regions lose connectivity cascading into
            financial markets, healthcare, and emergency services.
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {[
              { label: 'Systemic Risk',       cls: 'bg-red-400/10 text-red-400 border-red-400/25' },
              { label: 'CAIDA-verified',       cls: 'bg-rr-cyan/10 text-rr-cyan border-rr-cyan/25' },
              { label: 'Oligopoly Structure',  cls: 'bg-amber-400/10 text-amber-300 border-amber-400/20' },
            ].map(t => (
              <span key={t.label} className={`text-[10px] font-mono border px-1.5 py-0.5 rounded ${t.cls}`}>
                {t.label}
              </span>
            ))}
          </div>
          <div className="mt-3 text-[10px] text-rr-muted/60 font-mono italic">
            ↖ Click any node on the map for node-level intelligence
          </div>
        </section>
      )}

      {/* ── Section C — Who Controls the Rail ────────────────────────────── */}
      <section className="px-4 py-3 border-b border-rr-border">
        <SectionHeader label="Section C — Who Controls the Rail" />
        {loading ? (
          <div className="space-y-2">{[1,2,3,4,5,6,7,8].map(i => <SkeletonLine key={i} />)}</div>
        ) : asnRecords.length === 0 ? (
          <div className="text-[11px] text-rr-muted font-mono">
            No ASN data — run fetch_real_data.py
          </div>
        ) : (
          <>
            <p className="text-rr-muted text-xs leading-relaxed mb-3">
              Ranked by CAIDA transitive customer cone (cone_prefixes).
              Provider count = 0 indicates a transit-free Tier-1 network.
            </p>
            <div className="space-y-1.5">
              {asnRecords.slice(0, 10).map(a => (
                <div key={a.asn} className="flex items-center gap-2">
                  <span className="w-28 text-[11px] truncate text-rr-text" title={a.name}>
                    {a.name}
                  </span>
                  <div className="flex-1 bg-rr-border rounded-full h-1 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${((a.pct_of_routes / maxPct) * 100).toFixed(1)}%`,
                        background: 'linear-gradient(90deg, #38BDF8, #818CF8)',
                      }}
                    />
                  </div>
                  <span className="w-11 text-right font-mono text-[11px] text-rr-cyan">
                    {a.pct_of_routes.toFixed(1)}%
                  </span>
                  <span
                    title={`Provider count: ${a.provider_count} | Rank: ${a.rank ?? '—'}`}
                    className={`text-[9px] font-mono border rounded px-1 ${
                      a.tier === 1
                        ? 'text-red-400 border-red-400/25 bg-red-400/10'
                        : 'text-rr-cyan border-rr-cyan/25 bg-rr-cyan/10'
                    }`}
                  >
                    T{a.tier}
                  </span>
                </div>
              ))}
            </div>
            <div className="text-[9px] text-rr-muted/50 font-mono mt-2">
              Source: CAIDA AS-rank · cone_prefixes metric
            </div>
          </>
        )}
      </section>

      {/* ── Section D — Filters & Controls ───────────────────────────────── */}
      <section className="px-4 py-3 border-b border-rr-border">
        <SectionHeader label="Section D — Filters & Controls" />

        <div className="text-[11px] text-rr-muted mb-1.5">Region</div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {REGIONS.map(r => (
            <button
              key={r}
              onClick={() => onFiltersChange({ region: r })}
              className={`text-[10px] px-2 py-0.5 rounded border transition-all ${
                filters.region === r
                  ? 'border-rr-cyan text-rr-cyan bg-rr-cyan/10'
                  : 'border-rr-border text-rr-muted hover:border-rr-cyan/40'
              }`}
            >
              {r === 'all' ? 'All' : r}
            </button>
          ))}
        </div>

        <div className="text-[11px] text-rr-muted mb-1.5">Risk Level</div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {(['all', 'low', 'medium', 'high'] as const).map(r => (
            <button
              key={r}
              onClick={() => onFiltersChange({ risk: r })}
              className={`text-[10px] px-2 py-0.5 rounded border transition-all ${
                filters.risk === r
                  ? r === 'high'   ? 'border-red-400/50   text-red-400   bg-red-400/10'
                  : r === 'medium' ? 'border-amber-400/40 text-amber-300 bg-amber-400/10'
                  : r === 'low'    ? 'border-emerald-400/40 text-emerald-400 bg-emerald-400/10'
                  : 'border-rr-cyan text-rr-cyan bg-rr-cyan/10'
                  : 'border-rr-border text-rr-muted hover:border-rr-cyan/40'
              }`}
            >
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>

        <div className="text-[11px] text-rr-muted mb-1.5">Map Layers</div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          <button
            onClick={() => onFiltersChange({ showCables: !filters.showCables })}
            className={`text-[11px] px-2.5 py-1 rounded border transition-all ${
              filters.showCables
                ? 'border-rr-cyan text-rr-cyan bg-rr-cyan/10'
                : 'border-rr-border text-rr-muted'
            }`}
          >
            Submarine Cables
          </button>
          <button
            onClick={() => onFiltersChange({ tier1Only: !filters.tier1Only })}
            className={`text-[11px] px-2.5 py-1 rounded border transition-all ${
              filters.tier1Only
                ? 'border-rr-indigo text-rr-indigo bg-rr-indigo/10'
                : 'border-rr-border text-rr-muted'
            }`}
          >
            Tier-1 ASN Hubs
          </button>
        </div>

        {/* Route failure simulation */}
        <button
          onClick={handleSimulate}
          disabled={simLoading}
          className={`w-full py-2 rounded text-[11px] border transition-all ${
            simResult
              ? 'border-emerald-400/30 text-emerald-400 bg-emerald-400/10'
              : 'border-red-400/30 text-red-400 bg-red-400/10 hover:bg-red-400/15'
          }`}
        >
          {simLoading ? (
            <span className="flex items-center justify-center gap-1.5">
              {[0, 150, 300].map(d => (
                <span
                  key={d}
                  className="w-1.5 h-1.5 rounded-full bg-red-400 animate-bounce"
                  style={{ animationDelay: `${d}ms` }}
                />
              ))}
            </span>
          ) : simResult
            ? '✓ Reset Route Failure Simulation'
            : '⚠ Simulate Route Failure (top ranked ASN)'}
        </button>

        {simResult && simR && (
          <div className="mt-2 p-2.5 bg-red-400/5 border border-red-400/20 rounded text-[11px] text-rr-muted leading-relaxed">
            <strong className="text-red-400 block mb-1">
              SIMULATION — AS{simR.simulated_asn as string} ({simR.asn_name as string})
            </strong>
            <div>CAIDA rank: <span className="text-rr-text">#{simR.asn_rank as number}</span></div>
            <div>
              Cone prefixes lost:{' '}
              <span className="text-red-400">
                {(simR.cone_prefixes_lost as number).toLocaleString()}
              </span>
            </div>
            <div>
              Global routes affected:{' '}
              <strong className="text-red-400">{simR.pct_global_routes_affected as number}%</strong>
            </div>
            <div className="text-[9px] text-rr-muted/50 mt-1">
              Source: CAIDA AS-rank cone_prefixes
            </div>
          </div>
        )}
      </section>

      {/* ── Download ──────────────────────────────────────────────────────── */}
      <div className="p-4 mt-auto">
        <button
          onClick={downloadCSV}
          className="w-full py-2 border border-rr-cyan/30 text-rr-cyan
            bg-rr-cyan/10 hover:bg-rr-cyan/15 rounded text-xs transition-all"
        >
          ↓ Download PeeringDB IXP Data (.CSV)
        </button>
      </div>

      {/* ── Data Sources ──────────────────────────────────────────────────── */}
      <div className="px-4 pb-4">
        <div className="text-[10px] text-rr-muted font-mono mb-1.5 border-t border-rr-border pt-3">
          Data Sources
        </div>
        {[
          { label: 'PeeringDB',     note: 'IXP registry, member counts, geocoding',  cls: 'text-rr-cyan   border-rr-cyan/25   bg-rr-cyan/10' },
          { label: 'CAIDA',         note: 'AS-rank, cone_prefixes, Tier classification', cls: 'text-rr-indigo border-rr-indigo/25 bg-rr-indigo/10' },
          { label: 'TeleGeography', note: 'Submarine cable routes + landing points', cls: 'text-amber-300 border-amber-400/20 bg-amber-400/10' },
        ].map(s => (
          <div key={s.label} className="flex items-start gap-2 mb-1.5">
            <span className={`text-[9px] font-mono border px-1.5 py-0.5 rounded flex-shrink-0 ${s.cls}`}>
              {s.label}
            </span>
            <span className="text-[10px] text-rr-muted leading-tight">{s.note}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
