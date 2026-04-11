import { useState, useRef } from 'react'
import { useApp } from '../store/AppContext'
import type { ConversionStep } from '../types'
import { runConversionPipeline } from '../lib/conversionPipeline'

const STEPS: Omit<ConversionStep, 'status'>[] = [
  { id: 'parse',  label: 'Document chargé et analysé' },
  { id: 'direct', label: 'Application des styles (AUs directs)' },
  { id: 'claude', label: 'Analyse du contenu par Claude AI' },
  { id: 'arasaac',label: 'Injection des pictogrammes Arasaac' },
  { id: 'build',  label: 'Génération du DOCX final' },
]

const STATUS_ICON: Record<ConversionStep['status'], string> = {
  idle:    '⬜',
  running: '⏳',
  done:    '✅',
  error:   '❌',
}

export default function ConvertScreen() {
  const { state, dispatch } = useApp()
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const profiles = state.profiles
  const selectedProfile = state.selectedProfile

  function pickProfile(id: string) {
    const p = profiles.find(x => x.id === id) ?? null
    dispatch({ type: 'SET_SELECTED_PROFILE', profile: p })
  }

  function handleFile(f: File) {
    const allowed = ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/pdf', 'image/jpeg', 'image/png']
    if (!allowed.includes(f.type)) {
      setError('Format non supporté. Utilisez DOCX, PDF, JPG ou PNG.')
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      setError('Fichier trop lourd (max 10 MB).')
      return
    }
    setError('')
    setFile(f)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  async function startConversion() {
    if (!file || !selectedProfile) return

    // PDF/image : pas encore supportés en conversion — DOCX uniquement
    if (file.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      setError('Seuls les fichiers DOCX sont supportés pour la conversion. Le support PDF et image est en développement.')
      return
    }

    setRunning(true)
    setError('')
    dispatch({ type: 'RESET_CONVERSION' })
    dispatch({
      type: 'INIT_STEPS',
      steps: STEPS.map(s => ({ ...s, status: 'idle' })),
    })

    try {
      const result = await runConversionPipeline(file, selectedProfile, (id, status) => {
        dispatch({ type: 'UPDATE_STEP', id, status })
      })
      dispatch({
        type: 'SET_RESULT',
        previewHtml: result.previewHtml,
        docxBlob: result.docxBlob,
        report: result.report,
        filename: file.name,
      })
    } catch (e: any) {
      setError(e.message ?? 'Erreur inconnue')
    }

    setRunning(false)
  }

  function downloadDocx() {
    if (!state.docxBlob) return
    const url = URL.createObjectURL(state.docxBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = (state.originalFilename ?? 'document').replace(/\.[^.]+$/, '') + '-AU.docx'
    a.click()
    URL.revokeObjectURL(url)
  }

  const profileSummary = selectedProfile
    ? `${selectedProfile.au_selections.length} AU · ${selectedProfile.picto_options.density !== 'none' ? 'Pictos ' + selectedProfile.picto_options.density + ' · ' : ''}${selectedProfile.text_adaptation !== 'none' ? selectedProfile.text_adaptation : 'Sans adaptation'}`
    : ''

  const isDone = state.previewHtml !== null

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* En-tête */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-800">📄 Convertir un document</h1>
          <button
            onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'profiles' })}
            className="text-sm text-slate-500 hover:text-slate-700 border border-slate-300 rounded-lg px-3 py-1.5"
          >
            ← Mes profils
          </button>
        </div>

        {/* Sélection du profil */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Profil d'aménagement
          </label>
          <select
            value={selectedProfile?.id ?? ''}
            onChange={e => pickProfile(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— Choisir un profil —</option>
            {profiles.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {selectedProfile && (
            <p className="text-xs text-slate-500 mt-1.5">
              <span className="bg-slate-100 rounded-full px-2 py-0.5">{profileSummary}</span>
            </p>
          )}
          {profiles.length === 0 && (
            <p className="text-xs text-amber-600 mt-1.5">
              Aucun profil disponible.{' '}
              <button
                className="underline"
                onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'profiles' })}
              >
                Créez-en un d'abord.
              </button>
            </p>
          )}
        </div>

        {/* Zone upload */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <label className="block text-sm font-medium text-slate-700 mb-3">Document source</label>
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition cursor-pointer ${
              dragging
                ? 'border-blue-400 bg-blue-50'
                : file
                ? 'border-emerald-400 bg-emerald-50'
                : 'border-slate-300 hover:border-slate-400'
            }`}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".docx,.pdf,.jpg,.jpeg,.png"
              className="sr-only"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            {file ? (
              <>
                <div className="text-3xl mb-2">📄</div>
                <p className="font-medium text-slate-700">{file.name}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {(file.size / 1024).toFixed(0)} KB · {file.type.split('/')[1].toUpperCase()}
                </p>
                <p className="text-xs text-blue-500 mt-2">Cliquer pour changer</p>
              </>
            ) : (
              <>
                <div className="text-4xl mb-3">📁</div>
                <p className="text-slate-600 font-medium">Glissez votre fichier ici</p>
                <p className="text-xs text-slate-400 mt-1">ou cliquez pour parcourir</p>
                <p className="text-xs text-slate-400 mt-1">DOCX · PDF · JPG · PNG — max 10 MB</p>
              </>
            )}
          </div>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>

        {/* Bouton Convertir */}
        <button
          onClick={startConversion}
          disabled={!file || !selectedProfile || running}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-2xl text-lg transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
        >
          {running ? '⏳ Conversion en cours…' : '✨ Convertir le document'}
        </button>

        {/* Étapes en temps réel */}
        {state.conversionSteps.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
            <h3 className="font-medium text-slate-700 mb-3 text-sm">Traitement</h3>
            {state.conversionSteps.map(step => (
              <div key={step.id} className="flex items-center gap-3 text-sm">
                <span>{STATUS_ICON[step.status]}</span>
                <span className={
                  step.status === 'done' ? 'text-slate-700' :
                  step.status === 'running' ? 'text-blue-600 font-medium' :
                  step.status === 'error' ? 'text-red-500' :
                  'text-slate-400'
                }>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Résultat */}
        {isDone && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <h3 className="font-semibold text-slate-800">Conversion terminée !</h3>
            </div>

            <div className="flex gap-3 flex-wrap">
              <button
                onClick={downloadDocx}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
              >
                ↓ Télécharger le DOCX
              </button>
              <button
                onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'report' })}
                className="border border-slate-300 text-slate-600 px-5 py-2 rounded-lg text-sm hover:bg-slate-50 transition"
              >
                📊 Voir le rapport
              </button>
            </div>

            {/* Prévisualisation */}
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-2">Prévisualisation</h4>
              <div
                className="border border-slate-200 rounded-xl p-4 max-h-96 overflow-y-auto text-sm text-slate-700 bg-white"
                style={{ fontFamily: 'Arial, sans-serif', lineHeight: '1.6' }}
                dangerouslySetInnerHTML={{ __html: state.previewHtml ?? '' }}
              />
              <p className="text-xs text-slate-400 mt-2">
                ℹ️ L'audio fonctionne dans cette prévisualisation. Le DOCX téléchargeable contient des marqueurs 🔊.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
