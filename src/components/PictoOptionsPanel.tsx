import { useState } from 'react'
import type { PictoOptions, PictoDensity, PictoPosition } from '../types'

interface Props {
  opts: PictoOptions
  onChange: (opts: PictoOptions) => void
}

const DENSITY_OPTIONS: { value: PictoDensity; label: string }[] = [
  { value: 'none',        label: 'Aucun' },
  { value: 'all_nouns',   label: 'Noms' },
  { value: 'all_verbs',   label: 'Verbes' },
  { value: 'nouns_verbs', label: 'Noms + Verbes' },
  { value: 'custom',      label: 'Personnalisé' },
]

const POSITION_OPTIONS: { value: PictoPosition; label: string }[] = [
  { value: 'above',        label: 'Au-dessus' },
  { value: 'below',        label: 'En-dessous' },
  { value: 'inline_right', label: 'Inline' },
]

export default function PictoOptionsPanel({ opts, onChange }: Props) {
  const [advanced, setAdvanced] = useState(false)
  const set = <K extends keyof PictoOptions>(key: K, val: PictoOptions[K]) =>
    onChange({ ...opts, [key]: val })

  return (
    <div className="space-y-4 bg-slate-50 rounded-xl p-4 border border-slate-200">
      <h4 className="font-medium text-slate-700 text-sm flex items-center gap-2">
        🖼️ Options Arasaac
      </h4>

      {/* Densité */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Densité</label>
        <div className="flex flex-wrap gap-2">
          {DENSITY_OPTIONS.map(d => (
            <button
              key={d.value}
              onClick={() => set('density', d.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                opts.density === d.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-300 text-slate-600 hover:border-blue-400'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        {opts.density === 'custom' && (
          <input
            type="text"
            placeholder="maison, chien, courir… (séparés par des virgules)"
            value={opts.custom_words?.join(', ') ?? ''}
            onChange={e => set('custom_words', e.target.value.split(',').map(w => w.trim()).filter(Boolean))}
            className="mt-2 w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
          />
        )}
      </div>

      {/* Position */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Position</label>
        <div className="flex gap-2">
          {POSITION_OPTIONS.map(p => (
            <button
              key={p.value}
              onClick={() => set('position', p.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                opts.position === p.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-300 text-slate-600 hover:border-blue-400'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Style : couleur + taille */}
      <div className="flex items-center gap-6 flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
          <input
            type="checkbox"
            checked={opts.color}
            onChange={e => set('color', e.target.checked)}
            className="rounded"
          />
          Couleur
        </label>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600">Taille :</span>
          <input
            type="range" min={1} max={3} step={0.5}
            value={opts.size_ratio}
            onChange={e => set('size_ratio', parseFloat(e.target.value))}
            className="w-24"
          />
          <span className="text-xs text-slate-500">{opts.size_ratio}×</span>
        </div>
      </div>

      {/* Audio */}
      <div className="flex items-center gap-4 flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
          <input
            type="checkbox"
            checked={opts.audio.enabled}
            onChange={e => set('audio', { ...opts.audio, enabled: e.target.checked })}
            className="rounded"
          />
          🔊 Audio (prévisualisation uniquement)
        </label>
        {opts.audio.enabled && (
          <select
            value={opts.audio.voice_language}
            onChange={e => set('audio', { ...opts.audio, voice_language: e.target.value as any })}
            className="text-xs border border-slate-300 rounded px-2 py-1"
          >
            <option value="fr-FR">FR</option>
            <option value="nl-BE">NL</option>
            <option value="en-GB">EN</option>
          </select>
        )}
      </div>

      {/* Mode Avancé */}
      <button
        onClick={() => setAdvanced(!advanced)}
        className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
      >
        ⚙️ Mode avancé {advanced ? '▲' : '▼'}
      </button>

      {advanced && (
        <div className="space-y-3 pt-2 border-t border-slate-200">
          {/* Fond */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-600 w-20">Fond :</span>
            <label className="flex items-center gap-1 text-xs text-slate-700 cursor-pointer">
              <input
                type="radio"
                checked={opts.background_color === 'transparent'}
                onChange={() => set('background_color', 'transparent')}
              /> Transparent
            </label>
            <label className="flex items-center gap-1 text-xs text-slate-700 cursor-pointer">
              <input
                type="radio"
                checked={opts.background_color === '#FFFFFF'}
                onChange={() => set('background_color', '#FFFFFF')}
              /> Blanc
            </label>
            <input
              type="color"
              value={opts.background_color === 'transparent' ? '#ffffff' : opts.background_color}
              onChange={e => set('background_color', e.target.value)}
              className="w-7 h-7 rounded cursor-pointer"
            />
          </div>

          {/* Bordure */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
              <input
                type="checkbox"
                checked={opts.border}
                onChange={e => set('border', e.target.checked)}
              />
              Bordure
            </label>
            {opts.border && (
              <input
                type="color"
                value={opts.border_color ?? '#000000'}
                onChange={e => set('border_color', e.target.value)}
                className="w-7 h-7 rounded cursor-pointer"
              />
            )}
          </div>

          {/* Label */}
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
              <input
                type="checkbox"
                checked={opts.show_label}
                onChange={e => set('show_label', e.target.checked)}
              />
              Afficher le mot
            </label>
            {opts.show_label && (
              <select
                value={opts.label_position}
                onChange={e => set('label_position', e.target.value as any)}
                className="text-xs border border-slate-300 rounded px-2 py-1"
              >
                <option value="below">Dessous</option>
                <option value="above">Dessus</option>
              </select>
            )}
          </div>

          {/* Marqueurs */}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
              <input
                type="checkbox"
                checked={opts.show_tense_marker}
                onChange={e => set('show_tense_marker', e.target.checked)}
              />
              Marqueur de temps
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
              <input
                type="checkbox"
                checked={opts.show_plural_marker}
                onChange={e => set('show_plural_marker', e.target.checked)}
              />
              Marqueur pluriel
            </label>
          </div>

          {/* Fallback */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-600">Si mot sans picto :</span>
            <label className="flex items-center gap-1 text-xs cursor-pointer text-slate-700">
              <input
                type="radio"
                checked={opts.fallback === 'silent'}
                onChange={() => set('fallback', 'silent')}
              /> Ignorer
            </label>
            <label className="flex items-center gap-1 text-xs cursor-pointer text-slate-700">
              <input
                type="radio"
                checked={opts.fallback === 'highlight'}
                onChange={() => set('fallback', 'highlight')}
              /> Signaler dans rapport
            </label>
          </div>
        </div>
      )}
    </div>
  )
}
