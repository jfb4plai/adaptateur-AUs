import { useState } from 'react'
import type { AU } from '../types'

interface Props {
  au: AU
  enabled: boolean
  onToggle: () => void
}

const METHOD_BADGE: Record<string, { label: string; color: string }> = {
  xml_direct:       { label: 'Direct XML', color: 'bg-emerald-100 text-emerald-700' },
  claude_rewrite:   { label: 'Claude AI',  color: 'bg-purple-100 text-purple-700'  },
  structure_reorder:{ label: 'Réordonne',  color: 'bg-amber-100 text-amber-700'    },
}

export default function AUCard({ au, enabled, onToggle }: Props) {
  const [showRiss, setShowRiss] = useState(false)
  const badge = METHOD_BADGE[au.method]

  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        enabled
          ? 'border-blue-400 bg-blue-50 shadow-sm'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Icône + info */}
        <span className="text-2xl mt-0.5">{au.icon}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-slate-800 text-sm">{au.label}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.color}`}>
              {badge.label}
            </span>
            <span className="text-xs text-slate-400">{au.id}</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">{au.description}</p>

          {/* Bases scientifiques */}
          {au.riss_refs.length > 0 && (
            <div className="mt-2">
              <button
                onClick={() => setShowRiss(!showRiss)}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                📚 Bases scientifiques ({au.riss_refs.length})
                <span>{showRiss ? '▲' : '▼'}</span>
              </button>
              {showRiss && (
                <div className="mt-2 space-y-2 bg-white rounded-lg border border-slate-200 p-3">
                  {au.riss_refs.map(ref => (
                    <div key={ref.id} className="text-xs">
                      <p className="font-medium text-slate-700">
                        {ref.authors} ({ref.year})
                      </p>
                      <p className="text-slate-500 italic">"{ref.key_finding}"</p>
                      <p className="text-slate-400 mt-0.5">→ RISS: {ref.id}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Toggle */}
        <button
          onClick={onToggle}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 mt-1 ${
            enabled ? 'bg-blue-600' : 'bg-slate-300'
          }`}
          aria-pressed={enabled}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 mt-0.5 ${
              enabled ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
    </div>
  )
}
