import { useState, useRef } from 'react'
import { useApp } from '../store/AppContext'
import type { ConversionStep } from '../types'
import { runPhase1, runPhase2 } from '../lib/conversionPipeline'
import type { Phase1Result } from '../lib/conversionPipeline'
import type { RewrittenBlock } from '../lib/claudeRewriter'

const STEPS_P1: Omit<ConversionStep, 'status'>[] = [
  { id: 'parse',      label: 'Document chargé' },
  { id: 'transcribe', label: 'Transcription fidèle (PDF uniquement)' },
  { id: 'claude',     label: 'Adaptation AU' },
]
const STEPS_P2: Omit<ConversionStep, 'status'>[] = [
  { id: 'arasaac',       label: 'Pictogrammes Arasaac' },
  { id: 'build',         label: 'Génération DOCX' },
  { id: 'accessibility', label: 'Vérification accessibilité' },
]
const ALL_STEPS = [...STEPS_P1, ...STEPS_P2]

const STATUS_ICON: Record<ConversionStep['status'], string> = {
  idle: '⬜', running: '⏳', done: '✅', error: '❌',
}

// ── Composant tableau de correction ──────────────────────────────────────────

interface CorrectionPanelProps {
  blocks: RewrittenBlock[]
  onChange: (blocks: RewrittenBlock[]) => void
  onValidate: () => void
  onReset: () => void
}

function CorrectionPanel({ blocks, onChange, onValidate, onReset }: CorrectionPanelProps) {
  function updateTransformed(idx: number, value: string) {
    const next = blocks.map((b, i) => i === idx ? { ...b, transformed: value } : b)
    onChange(next)
  }

  function updateItem(blockIdx: number, itemIdx: number, value: string) {
    const next = blocks.map((b, i) => {
      if (i !== blockIdx) return b
      const items = [...(b.exercise_items ?? [])]
      items[itemIdx] = value
      return { ...b, exercise_items: items }
    })
    onChange(next)
  }

  let currentPage = 1
  let currentExNum = 0

  return (
    <div className="bg-white rounded-2xl border-2 border-amber-300 p-5 space-y-4">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-bold text-slate-800 text-base">✏️ Vérification avant génération</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Corrigez les éventuelles erreurs de transcription. Les champs modifiés apparaissent en jaune.
          </p>
        </div>
        <button
          onClick={onReset}
          className="text-xs text-slate-400 hover:text-slate-600 border border-slate-200 rounded px-2 py-1 shrink-0"
        >
          ↺ Recommencer
        </button>
      </div>

      {/* Blocs */}
      <div className="space-y-3">
        {blocks.map((block, bIdx) => {
          // Séparateur de page
          if (block.type === 'pagebreak') {
            currentPage++
            return (
              <div key={block.id} className="flex items-center gap-2 py-1">
                <div className="flex-1 border-t-2 border-dashed border-slate-300" />
                <span className="text-xs text-slate-400 bg-slate-100 rounded px-2 py-0.5">
                  — Page {currentPage} —
                </span>
                <div className="flex-1 border-t-2 border-dashed border-slate-300" />
              </div>
            )
          }

          // Bandeau exercice
          const showExBanner =
            block.type === 'instruction' &&
            block.exercise_number != null &&
            block.exercise_number !== currentExNum
          if (showExBanner) currentExNum = block.exercise_number!

          const isDirty = block.transformed !== block.original

          return (
            <div key={block.id} className="space-y-1">
              {showExBanner && (
                <div className="text-xs font-semibold text-blue-700 bg-blue-50 rounded px-2 py-1 mt-2">
                  Exercice {block.exercise_number}
                </div>
              )}

              {/* Titre */}
              {block.type === 'title' && (
                <div className="space-y-0.5">
                  <span className="text-xs text-slate-400 uppercase tracking-wide">Titre</span>
                  <textarea
                    value={block.transformed}
                    onChange={e => updateTransformed(bIdx, e.target.value)}
                    rows={1}
                    className={`w-full text-sm border rounded-lg px-3 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                      isDirty ? 'border-amber-300 bg-amber-50' : 'border-slate-200'
                    }`}
                  />
                </div>
              )}

              {/* Consigne */}
              {block.type === 'instruction' && (
                <div className="space-y-0.5">
                  <span className="text-xs text-slate-400 uppercase tracking-wide">Consigne</span>
                  <textarea
                    value={block.transformed}
                    onChange={e => updateTransformed(bIdx, e.target.value)}
                    rows={2}
                    className={`w-full text-sm border rounded-lg px-3 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                      isDirty ? 'border-amber-300 bg-amber-50' : 'border-slate-200'
                    }`}
                  />
                </div>
              )}

              {/* Corps */}
              {block.type === 'body' && (
                <div className="space-y-0.5">
                  <span className="text-xs text-slate-400 uppercase tracking-wide">Texte</span>
                  <textarea
                    value={block.transformed}
                    onChange={e => updateTransformed(bIdx, e.target.value)}
                    rows={2}
                    className={`w-full text-sm border rounded-lg px-3 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                      isDirty ? 'border-amber-300 bg-amber-50' : 'border-slate-200'
                    }`}
                  />
                </div>
              )}

              {/* Items d'exercice */}
              {block.type === 'exercise' && block.exercise_items && (
                <div className="space-y-0.5">
                  <span className="text-xs text-slate-400 uppercase tracking-wide">
                    Items ({block.exercise_items.length})
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {block.exercise_items.map((item, iIdx) => {
                      const orig = blocks[bIdx].exercise_items?.[iIdx] ?? item
                      const dirty = item !== orig
                      return (
                        <input
                          key={iIdx}
                          type="text"
                          value={item}
                          onChange={e => updateItem(bIdx, iIdx, e.target.value)}
                          className={`text-sm border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                            dirty ? 'border-amber-300 bg-amber-50' : 'border-slate-200'
                          }`}
                        />
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Exercice sans items explicites */}
              {block.type === 'exercise' && !block.exercise_items && (
                <div className="space-y-0.5">
                  <span className="text-xs text-slate-400 uppercase tracking-wide">Exercice</span>
                  <textarea
                    value={block.transformed}
                    onChange={e => updateTransformed(bIdx, e.target.value)}
                    rows={3}
                    className={`w-full text-sm border rounded-lg px-3 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                      isDirty ? 'border-amber-300 bg-amber-50' : 'border-slate-200'
                    }`}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Bouton valider */}
      <button
        onClick={onValidate}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl text-sm transition shadow-sm"
      >
        ✅ Valider et générer le DOCX
      </button>
    </div>
  )
}

// ── Écran principal ───────────────────────────────────────────────────────────

type Phase = 'idle' | 'phase1' | 'correction' | 'phase2' | 'done'

export default function ConvertScreen() {
  const { state, dispatch } = useApp()
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Phase 1 result → stocké pour correction
  const [phase1Result, setPhase1Result] = useState<Phase1Result | null>(null)
  const [editableBlocks, setEditableBlocks] = useState<RewrittenBlock[]>([])

  const profiles = state.profiles
  const selectedProfile = state.selectedProfile

  function pickProfile(id: string) {
    const p = profiles.find(x => x.id === id) ?? null
    dispatch({ type: 'SET_SELECTED_PROFILE', profile: p })
  }

  function handleFile(f: File) {
    const allowed = ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/pdf']
    if (!allowed.includes(f.type)) {
      setError('Format non supporté. Utilisez DOCX ou PDF.')
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

  function reset() {
    setPhase('idle')
    setPhase1Result(null)
    setEditableBlocks([])
    setError('')
    dispatch({ type: 'RESET_CONVERSION' })
  }

  async function startPhase1() {
    if (!file || !selectedProfile) return
    setPhase('phase1')
    setError('')
    dispatch({ type: 'RESET_CONVERSION' })
    dispatch({
      type: 'INIT_STEPS',
      steps: ALL_STEPS.map(s => ({ ...s, status: 'idle' })),
    })

    try {
      const result = await runPhase1(file, selectedProfile, (id, status) => {
        dispatch({ type: 'UPDATE_STEP', id, status })
      })
      setPhase1Result(result)
      setEditableBlocks(result.blocks)
      setPhase('correction')
    } catch (e: any) {
      setError(e.message ?? 'Erreur inconnue')
      setPhase('idle')
    }
  }

  async function startPhase2() {
    if (!phase1Result || !selectedProfile) return
    setPhase('phase2')
    setError('')

    // Appliquer les corrections de l'enseignant
    const correctedPhase1: Phase1Result = {
      ...phase1Result,
      blocks: editableBlocks,
    }

    try {
      const result = await runPhase2(correctedPhase1, selectedProfile, (id, status) => {
        dispatch({ type: 'UPDATE_STEP', id, status })
      })
      dispatch({
        type: 'SET_RESULT',
        previewHtml: result.previewHtml,
        docxBlob: result.docxBlob,
        report: result.report,
        filename: file!.name,
      })
      setPhase('done')
    } catch (e: any) {
      setError(e.message ?? 'Erreur inconnue')
      setPhase('correction')
    }
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
    ? `${selectedProfile.au_selections.length} AU · ${selectedProfile.text_adaptation !== 'none' ? selectedProfile.text_adaptation : 'Sans adaptation'}`
    : ''

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
            disabled={phase !== 'idle'}
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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
        </div>

        {/* Zone upload */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <label className="block text-sm font-medium text-slate-700 mb-3">Document source</label>
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition ${
              phase !== 'idle' ? 'opacity-50 cursor-not-allowed' :
              dragging ? 'border-blue-400 bg-blue-50 cursor-pointer' :
              file ? 'border-emerald-400 bg-emerald-50 cursor-pointer' :
              'border-slate-300 hover:border-slate-400 cursor-pointer'
            }`}
            onDragOver={e => { if (phase === 'idle') { e.preventDefault(); setDragging(true) } }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { if (phase === 'idle') onDrop(e) }}
            onClick={() => { if (phase === 'idle') fileRef.current?.click() }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".docx,.pdf"
              className="sr-only"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            {file ? (
              <>
                <div className="text-3xl mb-2">📄</div>
                <p className="font-medium text-slate-700">{file.name}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {(file.size / 1024).toFixed(0)} KB · {file.type.includes('pdf') ? 'PDF' : 'DOCX'}
                </p>
                {phase === 'idle' && <p className="text-xs text-blue-500 mt-2">Cliquer pour changer</p>}
              </>
            ) : (
              <>
                <div className="text-4xl mb-3">📁</div>
                <p className="text-slate-600 font-medium">Glissez votre fichier ici</p>
                <p className="text-xs text-slate-400 mt-1">DOCX ou PDF — max 10 MB</p>
              </>
            )}
          </div>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>

        {/* Bouton Convertir (Phase 1) */}
        {phase === 'idle' && (
          <button
            onClick={startPhase1}
            disabled={!file || !selectedProfile}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-2xl text-lg transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            ✨ Analyser et adapter le document
          </button>
        )}

        {/* Étapes en temps réel */}
        {state.conversionSteps.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
            <h3 className="font-medium text-slate-700 mb-3 text-sm">Traitement</h3>
            {state.conversionSteps.map(step => (
              <div key={step.id} className="flex items-center gap-3 text-sm">
                <span>{STATUS_ICON[step.status]}</span>
                <span className={
                  step.status === 'done'    ? 'text-slate-700' :
                  step.status === 'running' ? 'text-blue-600 font-medium' :
                  step.status === 'error'   ? 'text-red-500' :
                  'text-slate-400'
                }>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Tableau de correction (entre Phase 1 et Phase 2) */}
        {phase === 'correction' && (
          <CorrectionPanel
            blocks={editableBlocks}
            onChange={setEditableBlocks}
            onValidate={startPhase2}
            onReset={reset}
          />
        )}

        {/* Phase 2 en cours */}
        {phase === 'phase2' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-sm text-blue-600 font-medium">⏳ Génération du DOCX en cours…</p>
          </div>
        )}

        {/* Résultat final */}
        {phase === 'done' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <h3 className="font-semibold text-slate-800">Document généré !</h3>
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
              <button
                onClick={reset}
                className="border border-slate-300 text-slate-600 px-5 py-2 rounded-lg text-sm hover:bg-slate-50 transition"
              >
                ↺ Nouveau document
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
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
