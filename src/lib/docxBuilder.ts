/**
 * DOCX Builder — génère le fichier DOCX final adapté
 * Utilise la bibliothèque `docx` npm
 */

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, Footer, BorderStyle,
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

/** Extrait le mot d'un marqueur [IMG: mot], retourne null si absent */
function extractImgWord(text: string): string | null {
  const m = text.match(/^\[IMG:\s*([^\]]+)\]/)
  return m ? m[1].trim() : null
}

/** Retire le marqueur [IMG: mot] du début d'un texte */
function stripImgMarker(text: string): string {
  return text.replace(/^\[IMG:\s*[^\]]+\]\s*/, '')
}

export async function buildDocx(
  blocks: RewrittenBlock[],
  profile: AUProfile,
  pictoMap: Map<string, number>,
  illustrationPictoMap: Map<string, number>,
  _originalFilename: string
): Promise<Blob> {
  const { au_selections, picto_options } = profile

  const useArialFont = au_selections.includes('AU01')
  const defaultFont = useArialFont ? 'Arial' : undefined
  const defaultSize = useArialFont ? 24 : undefined  // half-points (24 = 12pt)
  const lineSpacing = au_selections.includes('AU02') ? { line: 360 } : undefined  // 240 = single, 360 = 1.5
  const alignment = au_selections.includes('AU03') ? AlignmentType.LEFT : undefined

  const children: Paragraph[] = []

  // ── Numérotation automatique des exercices ───────────────────────────────
  // Si Claude n'a pas fourni exercise_number, on le calcule en détectant
  // les transitions instruction→exercise ou les blocs exercise consécutifs.
  let autoExNum = 0
  const normalizedBlocks = blocks.map((block, i) => {
    if (block.exercise_number != null) return block  // Claude l'a fourni → on garde
    // Calcul automatique : nouvelle instruction avant un exercice = nouvel exercice
    const isNewExerciseGroup =
      block.type === 'instruction' &&
      blocks.slice(i + 1).find(b => b.type === 'exercise') !== undefined
    if (isNewExerciseGroup) autoExNum++
    const num = (block.type === 'instruction' || block.type === 'exercise') && autoExNum > 0
      ? autoExNum
      : null
    return { ...block, exercise_number: num }
  })

  let lastExerciseNumber = 0

  for (const block of normalizedBlocks) {
    const text = block.transformed || block.original

    // ── Séparateur visuel + numéro avant chaque exercice ─────────────────
    if (block.exercise_number && block.exercise_number !== lastExerciseNumber
        && block.type === 'instruction') {
      // Espace blanc généreux avant l'exercice (sauf le premier)
      if (lastExerciseNumber > 0) {
        children.push(new Paragraph({ spacing: { before: 480, after: 0 }, children: [] }))
      }
      // Bandeau "━━━ Exercice N ━━━━━━━━━━━━━━━━"
      const dashes = '━'.repeat(20)
      children.push(new Paragraph({
        spacing: { before: 80, after: 160 },
        shading: { fill: 'EFF6FF' },   // fond bleu très clair
        border: {
          top:    { style: BorderStyle.SINGLE, size: 8, color: '3B82F6', space: 4 },
          bottom: { style: BorderStyle.SINGLE, size: 8, color: '3B82F6', space: 4 },
          left:   { style: BorderStyle.SINGLE, size: 8, color: '3B82F6', space: 4 },
          right:  { style: BorderStyle.SINGLE, size: 8, color: '3B82F6', space: 4 },
        },
        children: [
          new TextRun({
            text: `${dashes}  Exercice ${block.exercise_number}  ${dashes}`,
            bold: true,
            color: '1D4ED8',
            size: (defaultSize ?? 24) + 2,
            font: defaultFont ?? 'Arial',
          }),
        ],
      }))
      lastExerciseNumber = block.exercise_number
    }

    // ── Consigne (instruction) ────────────────────────────────────────────
    if (block.type === 'instruction') {
      const runs: TextRun[] = []
      if (au_selections.includes('AU12') && block.action_verb) {
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
      if (picto_options.audio.enabled) {
        runs.push(new TextRun({ text: ' [audio]', font: defaultFont, size: defaultSize }))
      }
      children.push(new Paragraph({
        alignment,
        spacing: { ...(lineSpacing ?? {}), before: 80, after: 160 },
        children: runs,
      }))

    // ── Exercice : items verticaux ────────────────────────────────────────
    } else if (block.type === 'exercise') {
      // Priorité 1 : exercise_items[] (tableau explicite fourni par Claude)
      // Priorité 2 : split sur \n
      // Priorité 3 : le texte entier comme item unique
      const raw: string[] = block.exercise_items?.length
        ? block.exercise_items
        : text.split('\n')
      const items = raw.map((l: string) => l.trim()).filter((l: string) => l.length > 0)

      // Si un seul item sans \n = Claude a tout mis en ligne → on tente split sur |
      const finalItems = (items.length === 1 && items[0].includes('|'))
        ? items[0].split('|').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
        : items

      for (const item of finalItems) {
        const imgWord = extractImgWord(item)
        const itemText = imgWord ? stripImgMarker(item) : item

        // Chercher le pictogramme Arasaac pour l'illustration
        const imgId = imgWord ? illustrationPictoMap.get(imgWord) : undefined
        const imgBuf = imgId
          ? await fetchImageAsBuffer(
              `https://api.arasaac.org/v1/pictograms/${imgId}${profile.picto_options.color ? '' : '?color=false'}`
            )
          : null

        const itemSize = Math.round(16 * (profile.picto_options.size_ratio ?? 1))
        const runs: (TextRun | ImageRun)[] = [
          new TextRun({ text: '›  ', bold: true, color: '3B82F6', font: defaultFont ?? 'Arial', size: defaultSize }),
        ]

        // Illustration : pictogramme Arasaac ou étiquette texte
        if (imgWord) {
          if (imgBuf) {
            runs.push(new ImageRun({ type: 'png', data: imgBuf, transformation: { width: itemSize, height: itemSize } }))
            runs.push(new TextRun({ text: '  ', font: defaultFont, size: defaultSize }))
          } else {
            // Non trouvé dans Arasaac → étiquette discrète
            runs.push(new TextRun({ text: `[🖼 ${imgWord}]  `, color: '9CA3AF', italics: true, font: defaultFont, size: (defaultSize ?? 24) - 4 }))
          }
        }

        runs.push(new TextRun({ text: itemText, font: defaultFont, size: defaultSize }))

        children.push(new Paragraph({
          alignment,
          spacing: { ...(lineSpacing ?? {}), before: 80, after: 80 },
          indent: { left: 440 },
          children: runs,
        }))
      }

    // ── Titre ─────────────────────────────────────────────────────────────
    } else if (block.type === 'title') {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment,
        spacing: lineSpacing,
        children: [new TextRun({ text, font: defaultFont, size: defaultSize })],
      }))

    // ── Body (texte courant) ──────────────────────────────────────────────
    } else {
      const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0)
      for (const line of lines) {
        children.push(new Paragraph({
          alignment,
          spacing: lineSpacing,
          children: [new TextRun({ text: line, font: defaultFont, size: defaultSize })],
        }))
      }
    }

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

    // Étapes (AU19) — numérotation dans le texte (pas de référence numbering externe)
    if (au_selections.includes('AU19') && block.steps?.length) {
      block.steps.forEach((step, i) => {
        children.push(new Paragraph({
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
