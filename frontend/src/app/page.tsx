'use client'
// frontend/src/app/page.tsx
// INCREMENTAL UPGRADE — Phase 2
// Changes from Phase 1:
//   • Replaces individual tierFilter/showCables booleans with FilterState object
//   • Adds searchTarget state to fly map to searched node
//   • Adds isLiveData detection (checks backend health endpoint)
//   • Passes new props to IXPMap and Sidebar

import dynamic from 'next/dynamic'
import Sidebar from '@/components/Sidebar'
import TitleBar from '@/components/TitleBar'
import { useState, useEffect } from 'react'
import type { FilterState, IXPNode } from '@/lib/types'
import { api } from '@/lib/api'

// Leaflet must be dynamically imported (no SSR)
const IXPMap = dynamic(() => import('@/components/IXPMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#060e1a]">
      <div className="text-rr-cyan font-mono text-sm animate-pulse">Initializing map layer…</div>
    </div>
  ),
})

const DEFAULT_FILTERS: FilterState = {
  region: 'all',
  risk: 'all',
  tier1Only: false,
  showCables: true,
}

export default function HomePage() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const [simResult, setSimResult] = useState<null | object>(null)
  const [selectedIXP, setSelectedIXP] = useState<IXPNode | null>(null)
  const [searchTarget, setSearchTarget] = useState<string | null>(null)
  const [isLiveData, setIsLiveData] = useState(false)

  // Detect whether backend is live
  useEffect(() => {
    api.get('/api/health', { timeout: 3000 })
      .then(() => setIsLiveData(true))
      .catch(() => setIsLiveData(false))
  }, [])

  function handleFiltersChange(partial: Partial<FilterState>) {
    setFilters(prev => ({ ...prev, ...partial }))
  }

  function handleSearchSelect(id: string) {
    setSearchTarget(id)
    // Reset after fly-to so the same id can trigger again
    setTimeout(() => setSearchTarget(null), 1500)
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-rr-bg">
      {/* Main Stage — 70% */}
      <div className="relative flex-[7_7_0%] min-w-0">
        <TitleBar />
        <IXPMap
          filters={filters}
          simResult={simResult}
          onSelectIXP={setSelectedIXP}
          selectedIXP={selectedIXP}
          searchTarget={searchTarget}
        />
      </div>

      {/* Intelligence Sidebar — 30% */}
      <div className="flex-[3_3_0%] min-w-0 border-l border-rr-border bg-rr-surface overflow-y-auto">
        <Sidebar
          filters={filters}
          onFiltersChange={handleFiltersChange}
          simResult={simResult}
          onSimulate={setSimResult}
          selectedIXP={selectedIXP}
          onSearchSelect={handleSearchSelect}
          isLiveData={isLiveData}
        />
      </div>
    </div>
  )
}
