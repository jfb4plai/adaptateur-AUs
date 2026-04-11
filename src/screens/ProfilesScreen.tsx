import { useState, useEffect } from 'react'
import { useApp } from '../store/AppContext'
import { supabase } from '../lib/supabase'
import { AU_CATALOG, AU_CATEGORIES } from '../data/auCatalog'
import AUCard from '../components/AUCard'
import PictoOptionsPanel from '../components/PictoOptionsPanel'
import type { AUProfile, TextAdaptation } from '../types'
import { DEFAULT_PICTO_OPTIONS, TEXT_ADAPTATION_LABELS } from '../types'

const EMPTY_PROFILE = (): Omit<AUProfile, 'id' | 'teacher_id' | 'created_at' | 'updated_at'> => ({
  name: 'Nouveau profil',
  is_school_wide: false,
  au_selections: [],
  picto_options: { ...DEFAULT_PICTO_OPTIONS },
  text_adaptation: 'none',
  language: 'fr',
})

export default function ProfilesScreen() {
  const { state, dispatch } = useApp()
  const [profiles, setProfiles] = useState<AUProfile[]>(state.profiles)
  const [editing, setEditing] = useState<AUProfile | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  // Charger les profils depuis Supabase (ou démo)
  useEffect(() => {
    if (state.teacher?.id === 'demo') {
      // Profil démo pré-chargé
      const demo: AUProfile = {
        id: 'demo-profile-1',
        teacher_id: 'demo',
        name: 'Profil démo — Classe 3B',
        is_school_wide: false,
        au_selections: ['AU01','AU02','AU03','AU12','AU13','AU16'],
        picto_options: { ...DEFAULT_PICTO_OPTIONS },
        text_adaptation: 'none',
        language: 'fr',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      setProfiles([demo])
      dispatch({ type: 'SET_PROFILES', profiles: [demo] })
      return
    }
    loadProfiles()
  }, [state.teacher?.id])

  async function loadProfiles() {
    if (!state.teacher) return
    const { data } = await supabase
      .from('au_profiles')
      .select('*')
      .eq('teacher_id', state.teacher.id)
      .order('created_at', { ascending: false })
    if (data) {
      setProfiles(data as AUProfile[])
      dispatch({ type: 'SET_PROFILES', profiles: data as AUProfile[] })
    }
  }

  function newProfile() {
    const p: AUProfile = {
      id: 'new-' + Date.now(),
      teacher_id: state.teacher?.id ?? '',
      ...EMPTY_PROFILE(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    setEditing(p)
  }

  async function saveProfile() {
    if (!editing) return
    setSaving(true)
    setMsg('')

    // S'assure que la ligne teachers existe avant toute sauvegarde de profil
    if (state.teacher?.id && state.teacher.id !== 'demo') {
      await supabase.from('teachers').upsert(
        { id: state.teacher.id, email: state.teacher.email },
        { onConflict: 'id' }
      )
    }

    if (state.teacher?.id === 'demo') {
      // Mode démo : sauvegarde locale
      const isNew = !profiles.find(p => p.id === editing.id)
      const updated = isNew
        ? [...profiles, editing]
        : profiles.map(p => p.id === editing.id ? editing : p)
      setProfiles(updated)
      dispatch({ type: 'SET_PROFILES', profiles: updated })
      setSaving(false)
      setMsg('Profil sauvegardé (mode démo)')
      return
    }

    const payload = {
      teacher_id: state.teacher?.id,
      name: editing.name,
      is_school_wide: editing.is_school_wide,
      au_selections: editing.au_selections,
      picto_options: editing.picto_options,
      text_adaptation: editing.text_adaptation,
      language: editing.language,
      updated_at: new Date().toISOString(),
    }

    if (editing.id.startsWith('new-')) {
      const { data, error } = await supabase.from('au_profiles').insert(payload).select().single()
      if (!error && data) {
        setEditing(data as AUProfile)
        await loadProfiles()
        setMsg('Profil créé !')
      } else {
        setMsg('Erreur : ' + error?.message)
      }
    } else {
      const { error } = await supabase.from('au_profiles').update(payload).eq('id', editing.id)
      if (!error) {
        await loadProfiles()
        setMsg('Profil sauvegardé !')
      } else {
        setMsg('Erreur : ' + error.message)
      }
    }
    setSaving(false)
  }

  async function deleteProfile(id: string) {
    if (!confirm('Supprimer ce profil ?')) return
    if (state.teacher?.id === 'demo') {
      const updated = profiles.filter(p => p.id !== id)
      setProfiles(updated)
      dispatch({ type: 'SET_PROFILES', profiles: updated })
      if (editing?.id === id) setEditing(null)
      return
    }
    await supabase.from('au_profiles').delete().eq('id', id)
    await loadProfiles()
    if (editing?.id === id) setEditing(null)
  }

  function toggleAU(id: string) {
    if (!editing) return
    const sel = editing.au_selections.includes(id)
      ? editing.au_selections.filter(x => x !== id)
      : [...editing.au_selections, id]
    setEditing({ ...editing, au_selections: sel })
  }

  function toggleCategory(cat: string, on: boolean) {
    if (!editing) return
    const catIds = AU_CATALOG.filter(a => a.category === cat).map(a => a.id)
    const others = editing.au_selections.filter(x => !catIds.includes(x))
    setEditing({ ...editing, au_selections: on ? [...others, ...catIds] : others })
  }

  function exportJson() {
    if (!editing) return
    const blob = new Blob([JSON.stringify(editing, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `profil-au-${editing.name.replace(/\s+/g, '-')}.json`
    a.click()
  }

  function importJson(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string) as AUProfile
        setEditing({ ...data, id: 'new-' + Date.now(), teacher_id: state.teacher?.id ?? '' })
      } catch { alert('Fichier JSON invalide') }
    }
    reader.readAsText(file)
  }

  const auCount = editing?.au_selections.length ?? 0
  const profileSummary = (p: AUProfile) => {
    const parts = [`${p.au_selections.length} AU`]
    if (p.picto_options.density !== 'none') parts.push(`Pictos ${p.picto_options.density}`)
    if (p.text_adaptation !== 'none') parts.push(p.text_adaptation)
    return parts.join(' · ')
  }

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar gauche — liste des profils */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            <img src="/plai-logo.jpg" alt="PLAI" className="h-6 w-auto" />
          </div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-slate-800">Mes profils AU</h2>
            <button
              onClick={newProfile}
              className="bg-blue-600 text-white rounded-lg px-3 py-1.5 text-sm hover:bg-blue-700 transition"
            >
              + Nouveau
            </button>
          </div>
          <p className="text-xs text-slate-500">{state.teacher?.display_name}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {profiles.length === 0 && (
            <p className="text-sm text-slate-400 text-center mt-8">
              Aucun profil. Créez-en un !
            </p>
          )}
          {profiles.map(p => (
            <button
              key={p.id}
              onClick={() => setEditing(p)}
              className={`w-full text-left rounded-lg p-3 transition border ${
                editing?.id === p.id
                  ? 'bg-blue-50 border-blue-300'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="font-medium text-sm text-slate-800 truncate">{p.name}</div>
              <div className="text-xs text-slate-500 mt-0.5 truncate">{profileSummary(p)}</div>
              {p.is_school_wide && (
                <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full mt-1 inline-block">
                  Établissement
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-3 border-t border-slate-100">
          <button
            onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'convert' })}
            className="w-full bg-emerald-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-emerald-700 transition"
          >
            → Convertir un document
          </button>
        </div>
      </aside>

      {/* Zone principale — éditeur */}
      {editing ? (
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto">
            {/* En-tête */}
            <div className="flex items-center gap-4 mb-6 flex-wrap">
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-medium text-slate-500 mb-1">Nom du profil</label>
                <input
                  type="text"
                  value={editing.name}
                  onChange={e => setEditing({ ...editing, name: e.target.value })}
                  placeholder="Ex : Classe 3B, Évaluation Maths…"
                  className="w-full text-lg font-semibold text-slate-800 border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={editing.is_school_wide}
                  onChange={e => setEditing({ ...editing, is_school_wide: e.target.checked })}
                />
                Profil établissement
              </label>
              <select
                value={editing.language}
                onChange={e => setEditing({ ...editing, language: e.target.value as any })}
                className="border border-slate-300 rounded px-2 py-1 text-sm"
              >
                <option value="fr">FR</option>
                <option value="nl">NL</option>
                <option value="en">EN</option>
              </select>
            </div>

            {/* AUs par catégorie */}
            <div className="space-y-6">
              {AU_CATEGORIES.map(cat => {
                const catAUs = AU_CATALOG.filter(a => a.category === cat)
                const allOn = catAUs.every(a => editing.au_selections.includes(a.id))
                return (
                  <section key={cat}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-slate-700">{cat}</h3>
                      <button
                        onClick={() => toggleCategory(cat, !allOn)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {allOn ? 'Tout désactiver' : 'Tout activer'}
                      </button>
                    </div>
                    <div className="grid gap-2">
                      {catAUs.map(au => (
                        <AUCard
                          key={au.id}
                          au={au}
                          enabled={editing.au_selections.includes(au.id)}
                          onToggle={() => toggleAU(au.id)}
                        />
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>

            {/* Pictogrammes (si AU16 actif) */}
            {editing.au_selections.includes('AU16') && (
              <div className="mt-6">
                <PictoOptionsPanel
                  opts={editing.picto_options}
                  onChange={opts => setEditing({ ...editing, picto_options: opts })}
                />
              </div>
            )}

            {/* Adaptation textuelle */}
            <div className="mt-6 bg-slate-50 rounded-xl p-4 border border-slate-200">
              <h4 className="font-medium text-slate-700 text-sm mb-3">Adaptation textuelle</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(Object.entries(TEXT_ADAPTATION_LABELS) as [TextAdaptation, any][]).map(([val, info]) => (
                  <label
                    key={val}
                    className={`flex flex-col gap-0.5 cursor-pointer rounded-lg border p-3 transition ${
                      editing.text_adaptation === val
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="text_adaptation"
                      value={val}
                      checked={editing.text_adaptation === val}
                      onChange={() => setEditing({ ...editing, text_adaptation: val })}
                      className="sr-only"
                    />
                    <span className="font-medium text-sm text-slate-800">{info.label}</span>
                    <span className="text-xs text-slate-500">{info.desc}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex items-center gap-3 flex-wrap">
              <button
                onClick={saveProfile}
                disabled={saving}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
              >
                {saving ? 'Sauvegarde…' : '💾 Sauvegarder'}
              </button>
              <button
                onClick={() => setEditing({ ...editing, id: 'new-' + Date.now(), name: `${editing.name} (copie)` })}
                className="border border-slate-300 text-slate-600 px-4 py-2 rounded-lg text-sm hover:bg-slate-50 transition"
              >
                Dupliquer
              </button>
              <button
                onClick={exportJson}
                className="border border-slate-300 text-slate-600 px-4 py-2 rounded-lg text-sm hover:bg-slate-50 transition"
              >
                ↓ Export JSON
              </button>
              <label className="border border-slate-300 text-slate-600 px-4 py-2 rounded-lg text-sm hover:bg-slate-50 transition cursor-pointer">
                ↑ Import JSON
                <input type="file" accept=".json" onChange={importJson} className="sr-only" />
              </label>
              <button
                onClick={() => deleteProfile(editing.id)}
                className="text-red-500 hover:text-red-700 text-sm px-3 py-2"
              >
                Supprimer
              </button>
              {msg && <span className="text-sm text-emerald-600">{msg}</span>}
            </div>

            <p className="mt-4 text-xs text-slate-400">
              Résumé : <strong>{auCount} AU{auCount > 1 ? 's' : ''}</strong> actif{auCount > 1 ? 's' : ''}
              {editing.picto_options.density !== 'none' && ` · Pictos (${editing.picto_options.density})`}
              {editing.text_adaptation !== 'none' && ` · Adaptation ${editing.text_adaptation}`}
            </p>
          </div>
        </main>
      ) : (
        <main className="flex-1 flex items-center justify-center text-slate-400">
          <div className="text-center">
            <div className="text-5xl mb-4">👈</div>
            <p>Sélectionnez un profil ou créez-en un nouveau</p>
          </div>
        </main>
      )}
    </div>
  )
}
