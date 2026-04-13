/**
 * Claude Rewriter — appel API via proxy Supabase Edge Function
 * (la clé Anthropic ne doit jamais être exposée côté client)
 *
 * En développement local, peut pointer vers une Edge Function locale ou
 * un endpoint Express minimal.
 */

import type { TextAdaptation, AccessibilityResult } from '../types'

export interface DocumentBlock {
  id: string
  type: 'title' | 'instruction' | 'body' | 'exercise'
  text: string
}

export interface RewrittenBlock {
  id: string
  type: string
  original: string
  transformed: string
  exercise_number: number | null    // numéro d'exercice (ex: 1, 2, 3)
  exercise_items: string[] | null   // items verticaux d'un exercice
  illustrations: string[]           // mots des [IMG: mot] de ce bloc
  action_verb: string | null
  bullet_items: string[] | null
  objective_sentence: string | null
  example: string | null
  counter_example: string | null
  steps: string[] | null
  bloom_level: number | null
  recommended_support: string | null
  feedback_sentence: string | null
  written_version: string | null
  checkpoints: number[] | null
  picto_words: string[]
}

export interface RewriteResult {
  blocks: RewrittenBlock[]
  structure_hints: {
    reorder_instructions_first: boolean
    complexity_order: string[]
  }
  illustration_words: string[]      // tous les mots [IMG: mot] du document → Arasaac
  pass2_corrections?: string[]
  uncertain_chars?: string[]
}

export async function rewriteWithClaude(
  blocks: DocumentBlock[],
  activeAUs: string[],
  textAdaptation: TextAdaptation,
  language: string
): Promise<RewriteResult> {
  const response = await fetch('/api/rewrite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks, activeAUs, textAdaptation, language }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Claude API error: ${err}`)
  }

  return response.json()
}

/**
 * Analyse un PDF page par page via Claude Vision.
 * Chaque page (image PNG base64) est envoyée à /api/pdf-vision.
 * Retourne les blocs fusionnés de toutes les pages.
 */
export async function rewritePdfWithVision(
  pages: { pageNumber: number; base64: string }[],
  activeAUs: string[],
  textAdaptation: TextAdaptation,
  language: string
): Promise<RewriteResult> {
  const allBlocks: RewrittenBlock[] = []
  let reorderInstructions = false
  const complexityOrder: string[] = []

  const allCorrections: string[] = []
  const allUncertain: string[] = []

  for (const page of pages) {
    const response = await fetch('/api/pdf-vision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pageBase64: page.base64,
        pageNumber: page.pageNumber,
        activeAUs,
        textAdaptation,
        language,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Claude Vision error (page ${page.pageNumber}): ${err}`)
    }

    const result: RewriteResult = await response.json()
    allBlocks.push(...result.blocks)
    if (result.structure_hints.reorder_instructions_first) reorderInstructions = true
    complexityOrder.push(...result.structure_hints.complexity_order)
    if (result.pass2_corrections) allCorrections.push(...result.pass2_corrections)
    if (result.uncertain_chars) allUncertain.push(...result.uncertain_chars)
  }

  return {
    blocks: allBlocks,
    structure_hints: {
      reorder_instructions_first: reorderInstructions,
      complexity_order: complexityOrder,
    },
    illustration_words: [],
    pass2_corrections: allCorrections,
    uncertain_chars: allUncertain,
  }
}

/**
 * PDF scanné (Microsoft Lens, photocopie...) — envoie le PDF brut à Claude
 * comme document natif (type: "document"). Même qualité que la mobile app Claude.
 * Un seul appel pour tout le document, pas de conversion canvas.
 */
export async function rewritePdfDirect(
  pdfBase64: string,
  activeAUs: string[],
  textAdaptation: TextAdaptation,
  language: string
): Promise<RewriteResult> {
  const response = await fetch('/api/pdf-direct', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pdfBase64, activeAUs, textAdaptation, language }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Claude PDF Direct error: ${err}`)
  }

  return response.json()
}

/**
 * NOUVEAU PIPELINE PDF — 2 passes séparées
 *
 * Passe 1 : transcription pure (qualité mobile app Claude)
 * Passe 2 : adaptation AU sur texte propre → JSON fiable
 */

/** Passe 1 — Transcription fidèle du PDF en markdown */
export async function transcribePdf(pdfBase64: string): Promise<string> {
  const response = await fetch('/api/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pdfBase64 }),
  })
  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Transcription error: ${err}`)
  }
  const { text } = await response.json()
  return text
}

/** Passe 2 — Vérification + Adaptation AU (avec accès au PDF original) */
export async function adaptWithAUs(
  transcription: string,
  pdfBase64: string,
  activeAUs: string[],
  textAdaptation: TextAdaptation,
  language: string
): Promise<RewriteResult> {
  const response = await fetch('/api/adapt-au', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcription, pdfBase64, activeAUs, textAdaptation, language }),
  })
  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Adaptation AU error: ${err}`)
  }
  return response.json()
}

/**
 * Passe 3 — Vérification accessibilité du document adapté
 * Appel séparé après la conversion (endpoint Haiku, ~5-10s)
 */
export async function checkAccessibility(
  blocks: RewrittenBlock[],
  textAdaptation: TextAdaptation,
  activeAUs: string[],
  language: string
): Promise<AccessibilityResult> {
  const payload = blocks.map(b => ({ type: b.type, original: b.original, transformed: b.transformed }))

  const response = await fetch('/api/accessibility-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks: payload, textAdaptation, activeAUs, language }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Accessibility check error: ${err}`)
  }

  return response.json()
}
