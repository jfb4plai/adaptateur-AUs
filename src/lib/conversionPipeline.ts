/**
 * Pipeline de conversion complet — architecture 2 passes pour PDF
 *
 * PDF  → Passe 1 (transcription pure) → Passe 2 (adaptation AU) → Arasaac → DOCX
 * DOCX → Parse texte → Adaptation AU → Arasaac → DOCX
 */

import type { AUProfile, ConversionReport, ConversionStep, AccessibilityResult } from '../types'
import { parseDocx, buildPreviewHtml } from './docxProcessor'
import {
  rewriteWithClaude,
  transcribePdf,
  adaptWithAUs,
  checkAccessibility,
} from './claudeRewriter'
import type { RewrittenBlock } from './claudeRewriter'
import { fetchPictosBatch } from './arasaac'
import { buildDocx } from './docxBuilder'

/** Lit un File en base64 */
async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

export type StepUpdater = (id: string, status: ConversionStep['status']) => void

export interface ConversionOutput {
  previewHtml: string
  docxBlob: Blob
  report: ConversionReport
}

export async function runConversionPipeline(
  file: File,
  profile: AUProfile,
  onStep: StepUpdater
): Promise<ConversionOutput> {
  const isPdf = file.type === 'application/pdf'

  // ── Étape 1 : Chargement ─────────────────────────────────────────────────
  onStep('parse', 'running')
  const parsed = isPdf ? null : await parseDocx(file)
  const pdfBase64 = isPdf ? await fileToBase64(file) : null
  onStep('parse', 'done')

  // ── Étape 2 : Transcription (PDF uniquement — passe 1) ───────────────────
  let transcription: string | null = null
  if (isPdf && pdfBase64) {
    onStep('transcribe', 'running')
    try {
      transcription = await transcribePdf(pdfBase64)
      onStep('transcribe', 'done')
    } catch (e) {
      onStep('transcribe', 'error')
      throw e
    }
  } else {
    onStep('transcribe', 'done')  // DOCX : étape non applicable
  }

  // ── Étape 3 : Adaptation AU (passe 2 pour PDF, unique pour DOCX) ─────────
  const needsClaude = profile.au_selections.some(id =>
    ['AU11','AU12','AU13','AU14','AU15','AU18','AU19','AU20','AU21','AU22','AU23','AU24','AU26'].includes(id)
  )

  let rewriteResult: Awaited<ReturnType<typeof rewriteWithClaude>> | null = null

  onStep('claude', 'running')
  try {
    if (isPdf && transcription) {
      // PDF : passe 2 sur le texte propre de la passe 1
      rewriteResult = await adaptWithAUs(
        transcription,
        profile.au_selections,
        profile.text_adaptation,
        profile.language
      )
    } else if (!isPdf && parsed && needsClaude) {
      // DOCX : pipeline texte existant
      rewriteResult = await rewriteWithClaude(
        parsed.blocks,
        profile.au_selections,
        profile.text_adaptation,
        profile.language
      )
    }
    onStep('claude', 'done')
  } catch (e) {
    onStep('claude', 'error')
    throw e
  }

  // Blocs finaux
  const sourceBlocks = parsed?.blocks ?? []
  const finalBlocks: RewrittenBlock[] = rewriteResult?.blocks ?? sourceBlocks.map(b => ({
    id: b.id,
    type: b.type,
    original: b.text,
    transformed: b.text,
    exercise_number: null,
    exercise_items: null,
    illustrations: [],
    action_verb: null,
    bullet_items: null,
    objective_sentence: null,
    example: null,
    counter_example: null,
    steps: null,
    bloom_level: null,
    recommended_support: null,
    feedback_sentence: null,
    written_version: null,
    checkpoints: null,
    picto_words: [],
  }))

  // ── Étape 4 : Réordonnancement (DOCX uniquement) ─────────────────────────
  // Désactivé pour PDF : l'ordre instruction→items doit être celui du document
  if (!isPdf && rewriteResult?.structure_hints.reorder_instructions_first) {
    finalBlocks.sort((a, b) =>
      a.type === 'instruction' && b.type !== 'instruction' ? -1 :
      b.type === 'instruction' && a.type !== 'instruction' ? 1 : 0
    )
  }

  // ── Étape 5 : Arasaac (picto_words + illustrations) ──────────────────────
  let pictoMap = new Map<string, number>()
  let illustrationPictoMap = new Map<string, number>()
  const pictoWordsNotFound: string[] = []
  const illustrationWordsNotFound: string[] = []

  onStep('arasaac', 'running')

  // Picto_words (AU16 — mots du texte)
  if (profile.au_selections.includes('AU16')) {
    const allPictoWords = [...new Set(finalBlocks.flatMap(b => b.picto_words))]
    pictoMap = await fetchPictosBatch(allPictoWords, profile.language)
    allPictoWords.forEach(w => { if (!pictoMap.has(w)) pictoWordsNotFound.push(w) })
  }

  // Illustrations [IMG: mot] — toujours cherchées, indépendamment de AU16
  const allIllustrationWords = [
    ...new Set([
      ...(rewriteResult?.illustration_words ?? []),
      ...finalBlocks.flatMap(b => b.illustrations ?? []),
    ])
  ]
  if (allIllustrationWords.length > 0) {
    illustrationPictoMap = await fetchPictosBatch(allIllustrationWords, profile.language)
    allIllustrationWords.forEach(w => {
      if (!illustrationPictoMap.has(w)) illustrationWordsNotFound.push(w)
    })
  }

  onStep('arasaac', 'done')

  // ── Étape 6 : Build DOCX ─────────────────────────────────────────────────
  onStep('build', 'running')
  const previewHtml = buildPreviewHtml(finalBlocks, pictoMap, profile)
  const docxBlob = await buildDocx(finalBlocks, profile, pictoMap, illustrationPictoMap, file.name)
  onStep('build', 'done')

  // ── Étape 7 : Vérification accessibilité ─────────────────────────────────
  let accessibility: AccessibilityResult | undefined
  try {
    onStep('accessibility', 'running')
    accessibility = await checkAccessibility(
      finalBlocks,
      profile.text_adaptation,
      profile.au_selections,
      profile.language
    )
    onStep('accessibility', 'done')
  } catch (e) {
    console.warn('[accessibility check failed]', e)
    onStep('accessibility', 'error')
  }

  // ── Rapport ──────────────────────────────────────────────────────────────
  const report: ConversionReport = {
    aus_applied: profile.au_selections.filter(id => !id.startsWith('AU-ENV')),
    aus_not_applicable: profile.au_selections.filter(id => id.startsWith('AU-ENV')),
    picto_words_found: pictoMap.size,
    picto_words_not_found: pictoWordsNotFound,
    blocks_rewritten: finalBlocks.filter(b => b.transformed !== b.original).length,
    warnings: [],
    illustration_words_found: illustrationPictoMap.size,
    illustration_words_not_found: illustrationWordsNotFound,
    accessibility,
  }

  return { previewHtml, docxBlob, report }
}
