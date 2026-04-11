/**
 * DOCX Processor
 * Parsing entrant : mammoth → structure de blocs
 * Génération sortant : docx npm → DOCX final adapté
 */

import mammoth from 'mammoth'
import type { DocumentBlock } from './claudeRewriter'
import type { AUProfile } from '../types'

export interface ParsedDocument {
  blocks: DocumentBlock[]
  rawHtml: string
  images: Array<{ name: string; dataUrl: string }>
}

/** Parse un fichier DOCX et extrait les blocs */
export async function parseDocx(file: File): Promise<ParsedDocument> {
  const arrayBuffer = await file.arrayBuffer()

  // Extraction du HTML avec mammoth
  const htmlResult = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      convertImage: mammoth.images.imgElement((image) =>
        image.read('base64').then((base64: string) => ({
          src: `data:${image.contentType};base64,${base64}`,
        }))
      ),
    }
  )

  const rawHtml = htmlResult.value

  // Parser le HTML pour extraire les blocs textuels
  const parser = new DOMParser()
  const doc = parser.parseFromString(rawHtml, 'text/html')
  const blocks: DocumentBlock[] = []
  let blockIdx = 0

  doc.body.childNodes.forEach((node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as HTMLElement
    const text = el.textContent?.trim() || ''
    if (!text) return

    let type: DocumentBlock['type'] = 'body'
    const tag = el.tagName.toLowerCase()

    if (tag.match(/^h[1-3]$/)) {
      type = 'title'
    } else if (
      text.match(/^(consigne|question|exercice|activité|tâche|instruction)/i)
    ) {
      type = 'instruction'
    } else if (text.match(/^(exercice|ex\.|ex\s)/i)) {
      type = 'exercise'
    }

    blocks.push({ id: `block-${blockIdx++}`, type, text })
  })

  // Extraction des images embarquées
  const images: ParsedDocument['images'] = []
  doc.querySelectorAll('img').forEach((img, i) => {
    images.push({ name: `image-${i + 1}`, dataUrl: img.src })
  })

  return { blocks, rawHtml, images }
}

/**
 * Applique les AUs "xml_direct" typographiques au HTML
 * (pour la prévisualisation ; le DOCX réel est généré par buildDocx)
 */
export function applyDirectAUsToHtml(html: string, profile: AUProfile): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  if (profile.au_selections.includes('AU01')) {
    doc.body.style.fontFamily = 'Arial, sans-serif'
    doc.body.style.fontSize = '12pt'
  }
  if (profile.au_selections.includes('AU02')) {
    doc.body.style.lineHeight = '1.5'
  }
  if (profile.au_selections.includes('AU03')) {
    const all = doc.querySelectorAll('p, li, td, th')
    all.forEach((el) => ((el as HTMLElement).style.textAlign = 'left'))
  }
  if (profile.au_selections.includes('AU05')) {
    const underlined = doc.querySelectorAll('[style*="text-decoration"]')
    underlined.forEach((el) => {
      const s = (el as HTMLElement).style
      s.textDecoration = s.textDecoration.replace('underline', '').trim()
    })
  }

  return doc.body.innerHTML
}

/** Génère le HTML de prévisualisation avec pictos injectés */
export function buildPreviewHtml(
  blocks: Array<{ id: string; transformed: string; picto_words: string[] }>,
  pictoMap: Map<string, number>,
  profile: AUProfile
): string {
  const { picto_options } = profile

  let html = '<div class="au-preview">'
  for (const block of blocks) {
    let content = block.transformed

    // Injecter les pictos dans le texte
    if (profile.au_selections.includes('AU16') && pictoMap.size > 0) {
      for (const word of block.picto_words) {
        const id = pictoMap.get(word)
        if (!id) continue

        const size = Math.round(14 * picto_options.size_ratio)
        const imgTag = `<img
          src="https://api.arasaac.org/v1/pictograms/${id}${picto_options.color ? '' : '?color=false'}"
          alt="${word}"
          width="${size}"
          title="${word}"
          style="vertical-align:middle;margin:0 2px;"
        />`

        const label = picto_options.show_label
          ? `<span class="picto-label" style="font-size:0.7em;display:block;text-align:center;">${word}</span>`
          : ''

        const replacement =
          picto_options.position === 'above'
            ? `<span class="picto-wrap" style="display:inline-flex;flex-direction:column;align-items:center;margin:0 2px;">${imgTag}${label}<span>${word}</span></span>`
            : `<span class="picto-wrap" style="display:inline-flex;align-items:center;gap:2px;">${word}${imgTag}</span>`

        // Remplace la première occurrence exacte du mot (insensible à la casse)
        const re = new RegExp(`\\b${word}\\b`, 'i')
        content = content.replace(re, replacement)
      }
    }

    html += `<p data-block-id="${block.id}">${content}</p>`
  }
  html += '</div>'
  return html
}
