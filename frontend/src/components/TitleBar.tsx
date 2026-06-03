'use client'

export default function TitleBar() {
  return (
    <div className="absolute top-0 left-0 right-0 z-[500] flex items-center gap-3 px-4 py-3
      bg-gradient-to-b from-[rgba(3,7,18,0.95)] to-transparent pointer-events-none">
      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      <h1 className="text-sm font-semibold tracking-wide text-rr-text">
        Internet Backbone &amp; IXP Map
      </h1>
      <span className="text-[10px] font-mono border border-rr-border px-1.5 py-0.5 rounded text-rr-muted">
        Real Rails Intelligence Library
      </span>
      {['PeeringDB', 'TeleGeography', 'CAIDA AS-Rank'].map(s => (
        <span key={s} className="text-[10px] font-mono border border-rr-border px-1.5 py-0.5 rounded text-rr-muted">
          {s}
        </span>
      ))}
    </div>
  )
}
