/**
 * DOCX Builder — génère le fichier DOCX final adapté
 * Utilise la bibliothèque `docx` npm
 */

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, Footer,
  ImageRun,
} from 'docx'
import type { RewrittenBlock } from './claudeRewriter'
import type { AUProfile } from '../types'

/** Télécharge et encode une image en base64 */
async function fetchImageAsBuffer(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return res.arrayBuffer()
  } catch {
    return null
  }
}

export async function buildDocx(
  blocks: RewrittenBlock[],
  profile: AUProfile,
  pictoMap: Map<string, number>,
  _originalFilename: string
): Promise<Blob> {
  const { au_selections, picto_options } = profile

  const useArialFont = au_selections.includes('AU01')
  const defaultFont = useArialFont ? 'Arial' : undefined
  const defaultSize = useArialFont ? 24 : undefined  // half-points (24 = 12pt)
  const lineSpacing = au_selections.includes('AU02') ? { line: 360 } : undefined  // 240 = single, 360 = 1.5
  const alignment = au_selections.includes('AU03') ? AlignmentType.LEFT : undefined

  const children: Paragraph[] = []

  for (const block of blocks) {
    const text = block.transformed || block.original

    // Construire les runs de texte
    const runs: TextRun[] = []

    if (block.type === 'instruction' && au_selections.includes('AU12') && block.action_verb) {
      // Verbe en gras, reste normal
      const verbIdx = text.toLowerCase().indexOf(block.action_verb.toLowerCase())
      if (verbIdx >= 0) {
        if (verbIdx > 0) runs.push(new TextRun({ text: text.slice(0, verbIdx), font: defaultFont, size: defaultSize }))
        runs.push(new TextRun({ text: text.slice(verbIdx, verbIdx + block.action_verb.length), bold: true, font: defaultFont, size: defaultSize }))
        runs.push(new TextRun({ text: text.slice(verbIdx + block.action_verb.length), font: defaultFont, size: defaultSize }))
      } else {
        runs.push(new TextRun({ text, font: defaultFont, size: defaultSize }))
      }
    } else {
      runs.push(new TextRun({ text, font: defaultFont, size: defaultSize }))
    }

    // Audio marker
    if (picto_options.audio.enabled) {
      runs.push(new TextRun({ text: ' 🔊', font: defaultFont, size: defaultSize }))
    }

    const para = new Paragraph({
      heading: block.type === 'title' ? HeadingLevel.HEADING_1 : undefined,
      alignment,
      spacing: lineSpacing,
      children: runs,
    })
    children.push(para)

    // Objectif (AU15)
    if (au_selections.includes('AU15') && block.objective_sentence) {
      children.push(new Paragraph({
        alignment,
        spacing: lineSpacing,
        children: [new TextRun({ text: `🎯 ${block.objective_sentence}`, italics: true, font: defaultFont, size: defaultSize })],
      }))
    }

    // Puces (AU14)
    if (au_selections.includes('AU14') && block.bullet_items?.length) {
      for (const item of block.bullet_items) {
        children.push(new Paragraph({
          bullet: { level: 0 },
          alignment,
          spacing: lineSpacing,
          children: [new TextRun({ text: item, font: defaultFont, size: defaultSize })],
        }))
      }
    }

    // Étapes (AU19)
    if (au_selections.includes('AU19') && block.steps?.length) {
      block.steps.forEach((step, i) => {
        children.push(new Paragraph({
          numbering: { reference: 'numbered-steps', level: 0 },
          alignment,
          spacing: lineSpacing,
          children: [new TextRun({ text: `${i + 1}. ${step}`, font: defaultFont, size: defaultSize })],
        }))
      })
    }

    // Exemple / contre-exemple (AU18)
    if (au_selections.includes('AU18') && block.example) {
      children.push(new Paragraph({
        spacing: lineSpacing,
        children: [
          new TextRun({ text: '✅ Exemple : ', bold: true, font: defaultFont, size: defaultSize }),
          new TextRun({ text: block.example, font: defaultFont, size: defaultSize }),
        ],
      }))
    }
    if (au_selections.includes('AU18') && block.counter_example) {
      children.push(new Paragraph({
        spacing: lineSpacing,
        children: [
          new TextRun({ text: '❌ Contre-exemple : ', bold: true, font: defaultFont, size: defaultSize }),
          new TextRun({ text: block.counter_example, font: defaultFont, size: defaultSize }),
        ],
      }))
    }

    // Bloom (AU21)
    if (au_selections.includes('AU21') && block.bloom_level) {
      const bloomLabels = ['', 'Mémorisation', 'Compréhension', 'Application', 'Analyse', 'Évaluation', 'Création']
      children.push(new Paragraph({
        spacing: lineSpacing,
        children: [new TextRun({ text: `🧠 Bloom niveau ${block.bloom_level} — ${bloomLabels[block.bloom_level]}`, italics: true, color: '6B7280', font: defaultFont, size: (defaultSize ?? 24) - 4 })],
      }))
    }

    // Rétroaction (AU24)
    if (au_selections.includes('AU24') && block.feedback_sentence && block.type === 'exercise') {
      children.push(new Paragraph({
        spacing: lineSpacing,
        children: [new TextRun({ text: `⭐ ${block.feedback_sentence}`, italics: true, color: '92400E', font: defaultFont, size: defaultSize })],
      }))
    }

    // Pictogrammes inline (AU16) — on ajoute une ligne avec les pictos
    if (au_selections.includes('AU16') && block.picto_words.length > 0) {
      const pictoRuns: (TextRun | ImageRun)[] = []
      for (const word of block.picto_words) {
        const id = pictoMap.get(word)
        if (!id) continue
        const url = `https://api.arasaac.org/v1/pictograms/${id}${picto_options.color ? '' : '?color=false'}`
        const buf = await fetchImageAsBuffer(url)
        if (buf) {
          const size = Math.round(16 * picto_options.size_ratio)
          pictoRuns.push(
            new ImageRun({ type: 'png', data: buf, transformation: { width: size, height: size } }),
            new TextRun({ text: picto_options.show_label ? ` ${word}  ` : '  ', font: defaultFont, size: defaultSize })
          )
        }
      }
      if (pictoRuns.length > 0) {
        children.push(new Paragraph({ alignment, spacing: lineSpacing, children: pictoRuns }))
      }
    }
  }

  // Pied de page ARASAAC obligatoire
  const footer = new Footer({
    children: [
      new Paragraph({
        children: [
          new TextRun({ text: 'Document adapté selon les Aménagements Universels (FWB) | Généré par AU-Convertisseur', size: 16 }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Les symboles pictographiques sont la propriété du Gouvernement d\'Aragon (ARASAAC) créés par Sergio Palao — Licence CC BY-NC-SA — https://arasaac.org', size: 14, color: '6B7280' }),
        ],
      }),
    ],
  })

  const doc = new Document({
    sections: [{
      properties: {},
      footers: { default: footer },
      children,
    }],
  })

  const blob = await Packer.toBlob(doc)
  return blob
}
