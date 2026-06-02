/** @type {import('tailwindcss').Config} */
// frontend/tailwind.config.js
// INCREMENTAL ADDITION — Phase 2: added risk colour tokens (rr-risk-*)
// All Phase 1 tokens preserved.

module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Phase 1 ──────────────────────────────────────────────────────
        'rr-bg':      '#030712',
        'rr-surface': '#0B1117',
        'rr-cyan':    '#38BDF8',
        'rr-indigo':  '#818CF8',
        'rr-border':  '#1F2937',
        'rr-muted':   '#374151',
        'rr-text':    '#E5E7EB',
        'rr-subtext': '#6B7280',
        // ── Phase 2: risk threshold colours ──────────────────────────────
        'rr-risk-low':    '#34D399',   // green  — score < 40
        'rr-risk-medium': '#FCD34D',   // yellow — score 40–69
        'rr-risk-high':   '#F87171',   // red    — score ≥ 70
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      boxShadow: {
        'cyan-glow':    '0 0 8px 0 rgba(56,189,248,0.35)',
        'card':         '0 1px 3px rgba(0,0,0,0.4)',
        // Phase 2 additions
        'node-select':  '0 0 0 3px rgba(56,189,248,0.5), 0 0 16px rgba(56,189,248,0.2)',
        'risk-high':    '0 0 8px rgba(248,113,113,0.4)',
      },
      backgroundImage: {
        'grid-pattern': 'linear-gradient(rgba(56,189,248,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.03) 1px, transparent 1px)',
      },
      animation: {
        // Phase 2: glow ring and loading dots
        'glow-pulse': 'ixp-glow-pulse 2s ease-in-out infinite',
        'bounce-dot': 'bounce 0.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}