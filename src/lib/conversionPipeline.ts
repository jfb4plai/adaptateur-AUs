/**
 * Pipeline de conversion complet
 * Orchestre : parse → direct-AUs → claude-rewrite → arasaac → docx-build
 */

import type { AUProfile, ConversionReport, ConversionStep } from '../types'
import { parseDocx, buildPreviewHtml } from './docxProcessor'
import { rewriteWithClaude, rewritePdfWithVision } from './claudeRewriter'
import { pdfToImages } from './pdfProcessor'
import { fetchPictosBatch } from './arasaac'
import { buildDocx } from './docxBuilder'

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

  // ── Étape 1 : Parse ──────────────────────────────────────────────────────
  onStep('parse', 'running')
  const parsed = isPdf ? null : await parseDocx(file)
  const pdfPages = isPdf ? await pdfToImages(file) : null
  onStep('parse', 'done')

  // ── Étape 2 : Direct AUs ─────────────────────────────────────────────────
  onStep('direct', 'running')
  // Pour PDF : appliquées après reconstruction — marquage uniquement
  onStep('direct', 'done')

  // ── Étape 3 : Claude (DOCX) ou Vision (PDF) ───────────────────────────────
  const needsClaude = profile.au_selections.some(id =>
    ['AU11','AU12','AU13','AU14','AU15','AU18','AU19','AU20','AU21','AU22','AU23','AU24','AU26'].includes(id)
  )

  let rewriteResult: Awaited<ReturnType<typeof rewriteWithClaude>> | null = null

  onStep('claude', 'running')
  try {
    if (isPdf && pdfPages) {
      // PDF → Vision : 1 appel par page, Claude voit l'image complète
      rewriteResult = await rewritePdfWithVision(
        pdfPages,
        profile.au_selections,
        profile.text_adaptation,
        profile.language
      )
    } else if (!isPdf && parsed && needsClaude) {
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

  // Utiliser les blocs réécrits ou les blocs originaux
  const sourceBlocks = parsed?.blocks ?? []
  const finalBlocks = rewriteResult?.blocks ?? sourceBlocks.map(b => ({
    id: b.id,
    type: b.type,
    original: b.text,
    transformed: b.text,
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

  // ── Étape 4 : Réordonnancement (structure_reorder) ────────────────────────
  if (rewriteResult?.structure_hints.reorder_instructions_first) {
    finalBlocks.sort((a, b) =>
      a.type === 'instruction' && b.type !== 'instruction' ? -1 :
      b.type === 'instruction' && a.type !== 'instruction' ? 1 : 0
    )
  }

  // ── Étape 5 : Arasaac ────────────────────────────────────────────────────
  let pictoMap = new Map<string, number>()
  const pictoWordsNotFound: string[] = []

  if (profile.au_selections.includes('AU16')) {
    onStep('arasaac', 'running')
    const allPictoWords = [...new Set(finalBlocks.flatMap(b => b.picto_words))]
    pictoMap = await fetchPictosBatch(allPictoWords, profile.language)
    allPictoWords.forEach(w => { if (!pictoMap.has(w)) pictoWordsNotFound.push(w) })
    onStep('arasaac', 'done')
  } else {
    onStep('arasaac', 'done')
  }

  // ── Étape 6 : Build DOCX ─────────────────────────────────────────────────
  onStep('build', 'running')
  const previewHtml = buildPreviewHtml(finalBlocks, pictoMap, profile)
  const docxBlob = await buildDocx(finalBlocks, profile, pictoMap, file.name)
  onStep('build', 'done')

  // ── Rapport ──────────────────────────────────────────────────────────────
  const report: ConversionReport = {
    aus_applied: profile.au_selections.filter(id => !id.startsWith('AU-ENV')),
    aus_not_applicable: profile.au_selections.filter(id => id.startsWith('AU-ENV')),
    picto_words_found: pictoMap.size,
    picto_words_not_found: pictoWordsNotFound,
    blocks_rewritten: finalBlocks.filter(b => b.transformed !== b.original).length,
    warnings: [],
  }

  return { previewHtml, docxBlob, report }
}
