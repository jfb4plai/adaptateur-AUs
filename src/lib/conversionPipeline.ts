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

/** Résultat de Phase 1 — blocs prêts à corriger avant génération DOCX */
export interface Phase1Result {
  blocks: RewrittenBlock[]
  illustration_words: string[]   // collectés par Claude, utilisés en Phase 2
  filename: string
}

/** Phase 1 : parse + transcription + adaptation Claude → blocs corrigeables */
export async function runPhase1(
  file: File,
  profile: AUProfile,
  onStep: StepUpdater
): Promise<Phase1Result> {
  const isPdf = file.type === 'application/pdf'

  onStep('parse', 'running')
  const parsed = isPdf ? null : await parseDocx(file)
  const pdfBase64 = isPdf ? await fileToBase64(file) : null
  onStep('parse', 'done')

  let transcription: string | null = null
  let transcriptionAnalysis: string = ''
  if (isPdf && pdfBase64) {
    onStep('transcribe', 'running')
    try {
      const t1 = await transcribePdf(pdfBase64)
      transcription = t1.text
      transcriptionAnalysis = t1.analysis
      onStep('transcribe', 'done')
    } catch (e) {
      onStep('transcribe', 'error')
      throw e
    }
  } else {
    onStep('transcribe', 'done')
  }

  const needsClaude = profile.au_selections.some(id =>
    ['AU11','AU12','AU13','AU14','AU15','AU18','AU19','AU20','AU21','AU22','AU23','AU24','AU26'].includes(id)
  )

  let rewriteResult: Awaited<ReturnType<typeof rewriteWithClaude>> | null = null
  onStep('claude', 'running')
  try {
    if (isPdf && transcription && pdfBase64) {
      rewriteResult = await adaptWithAUs(transcription, pdfBase64, profile.au_selections, profile.text_adaptation, profile.language, transcriptionAnalysis)
    } else if (!isPdf && parsed && needsClaude) {
      rewriteResult = await rewriteWithClaude(parsed.blocks, profile.au_selections, profile.text_adaptation, profile.language)
    }
    onStep('claude', 'done')
  } catch (e) {
    onStep('claude', 'error')
    throw e
  }

  const sourceBlocks = parsed?.blocks ?? []
  const blocks: RewrittenBlock[] = rewriteResult?.blocks ?? sourceBlocks.map(b => ({
    id: b.id, type: b.type, original: b.text, transformed: b.text,
    exercise_number: null, exercise_items: null, illustrations: [],
    action_verb: null, bullet_items: null, objective_sentence: null,
    example: null, counter_example: null, steps: null, bloom_level: null,
    recommended_support: null, feedback_sentence: null, written_version: null,
    checkpoints: null, picto_words: [],
  }))

  if (!isPdf && rewriteResult?.structure_hints.reorder_instructions_first) {
    blocks.sort((a, b) =>
      a.type === 'instruction' && b.type !== 'instruction' ? -1 :
      b.type === 'instruction' && a.type !== 'instruction' ? 1 : 0
    )
  }

  return {
    blocks,
    illustration_words: rewriteResult?.illustration_words ?? [],
    filename: file.name,
  }
}

/** Phase 2 : Arasaac + build DOCX + vérification accessibilité */
export async function runPhase2(
  phase1: Phase1Result,
  profile: AUProfile,
  onStep: StepUpdater
): Promise<ConversionOutput> {
  const { blocks: finalBlocks, illustration_words, filename } = phase1

  let pictoMap = new Map<string, number>()
  let illustrationPictoMap = new Map<string, number>()
  const pictoWordsNotFound: string[] = []
  const illustrationWordsNotFound: string[] = []

  onStep('arasaac', 'running')
  if (profile.au_selections.includes('AU16')) {
    const allPictoWords = [...new Set(finalBlocks.flatMap(b => b.picto_words))]
    pictoMap = await fetchPictosBatch(allPictoWords, profile.language)
    allPictoWords.forEach(w => { if (!pictoMap.has(w)) pictoWordsNotFound.push(w) })
  }

  const imgTagPattern = /\[IMG:\s*([^\]]+)\]/g
  const extractedFromItems = finalBlocks.flatMap(b =>
    (b.exercise_items ?? []).flatMap(item => {
      const matches = [...item.matchAll(imgTagPattern)]
      return matches.map(m => m[1].trim().toLowerCase())
    })
  )
  const allIllustrationWords = [
    ...new Set([...illustration_words, ...finalBlocks.flatMap(b => b.illustrations ?? []), ...extractedFromItems])
  ]
  if (allIllustrationWords.length > 0) {
    illustrationPictoMap = await fetchPictosBatch(allIllustrationWords, profile.language)
    allIllustrationWords.forEach(w => { if (!illustrationPictoMap.has(w)) illustrationWordsNotFound.push(w) })
  }
  onStep('arasaac', 'done')

  onStep('build', 'running')
  const previewHtml = buildPreviewHtml(finalBlocks, pictoMap, profile)
  const docxBlob = await buildDocx(finalBlocks, profile, pictoMap, illustrationPictoMap, filename)
  onStep('build', 'done')

  let accessibility: AccessibilityResult | undefined
  try {
    onStep('accessibility', 'running')
    accessibility = await checkAccessibility(finalBlocks, profile.text_adaptation, profile.au_selections, profile.language)
    onStep('accessibility', 'done')
  } catch (e) {
    console.warn('[accessibility check failed]', e)
    onStep('accessibility', 'error')
  }

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

/** Pipeline complet sans pause (rétrocompatibilité) */
export async function runConversionPipeline(
  file: File,
  profile: AUProfile,
  onStep: StepUpdater
): Promise<ConversionOutput> {
  const phase1 = await runPhase1(file, profile, onStep)
  return runPhase2(phase1, profile, onStep)
}
