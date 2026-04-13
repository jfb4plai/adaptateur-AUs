/**
 * Pipeline de conversion complet
 * Orchestre : parse → direct-AUs → claude-rewrite → arasaac → docx-build
 */

import type { AUProfile, ConversionReport, ConversionStep, AccessibilityResult } from '../types'
import { parseDocx, buildPreviewHtml } from './docxProcessor'
import { rewriteWithClaude, rewritePdfWithVision, rewritePdfDirect, checkAccessibility } from './claudeRewriter'
import { extractPdfContent } from './pdfProcessor'
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
  // PDF : tente extraction texte d'abord, fallback images si scan
  const pdfContent = isPdf ? await extractPdfContent(file) : null
  onStep('parse', 'done')

  // ── Étape 2 : Direct AUs ─────────────────────────────────────────────────
  onStep('direct', 'running')
  onStep('direct', 'done')

  // ── Étape 3 : Claude texte (DOCX ou PDF numérique) ou Vision (scan) ───────
  const needsClaude = profile.au_selections.some(id =>
    ['AU11','AU12','AU13','AU14','AU15','AU18','AU19','AU20','AU21','AU22','AU23','AU24','AU26'].includes(id)
  )

  let rewriteResult: Awaited<ReturnType<typeof rewriteWithClaude>> | null = null

  onStep('claude', 'running')
  try {
    if (isPdf && pdfContent?.isDigital) {
      // PDF numérique → même pipeline que DOCX (texte extrait proprement)
      rewriteResult = await rewriteWithClaude(
        pdfContent.blocks,
        profile.au_selections,
        profile.text_adaptation,
        profile.language
      )
    } else if (isPdf && pdfContent && !pdfContent.isDigital) {
      // PDF scanné → document natif Claude (même qualité que mobile app)
      rewriteResult = await rewritePdfDirect(
        pdfContent.pdfBase64,
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

  // ── Étape 7 : Vérification accessibilité (passe 3) ───────────────────────
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
    // Non bloquant : la conversion reste disponible même si la vérif échoue
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
    // Passe 2 Vision : corrections et incertitudes
    pass2_corrections: rewriteResult?.pass2_corrections ?? [],
    uncertain_chars: rewriteResult?.uncertain_chars ?? [],
    // Passe 3 : vérification accessibilité
    accessibility,
  }

  return { previewHtml, docxBlob, report }
}
