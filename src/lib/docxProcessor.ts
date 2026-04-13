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
  blocks: Array<{
    id: string
    type?: string
    transformed: string
    picto_words: string[]
    exercise_number?: number | null
    exercise_items?: string[] | null
  }>,
  pictoMap: Map<string, number>,
  profile: AUProfile
): string {
  const { picto_options } = profile

  // Numérotation automatique identique au docxBuilder
  let autoExNum = 0
  const normalized = blocks.map((block, i) => {
    if (block.exercise_number != null) return block
    const isNewGroup =
      block.type === 'instruction' &&
      blocks.slice(i + 1).find(b => b.type === 'exercise') !== undefined
    if (isNewGroup) autoExNum++
    const num = (block.type === 'instruction' || block.type === 'exercise') && autoExNum > 0
      ? autoExNum : null
    return { ...block, exercise_number: num }
  })

  let lastExNum = 0
  let html = '<div class="au-preview" style="font-family:Arial,sans-serif;max-width:700px;">'

  for (const block of normalized) {
    let content = block.transformed

    // Injecter les pictos dans le texte
    if (profile.au_selections.includes('AU16') && pictoMap.size > 0) {
      for (const word of block.picto_words) {
        const id = pictoMap.get(word)
        if (!id) continue
        const size = Math.round(14 * picto_options.size_ratio)
        const imgTag = `<img src="https://api.arasaac.org/v1/pictograms/${id}${picto_options.color ? '' : '?color=false'}" alt="${word}" width="${size}" title="${word}" style="vertical-align:middle;margin:0 2px;" />`
        const label = picto_options.show_label
          ? `<span style="font-size:0.7em;display:block;text-align:center;">${word}</span>` : ''
        const replacement = picto_options.position === 'above'
          ? `<span style="display:inline-flex;flex-direction:column;align-items:center;margin:0 2px;">${imgTag}${label}<span>${word}</span></span>`
          : `<span style="display:inline-flex;align-items:center;gap:2px;">${word}${imgTag}</span>`
        content = content.replace(new RegExp(`\\b${word}\\b`, 'i'), replacement)
      }
    }

    // Bandeau exercice
    if (block.exercise_number && block.exercise_number !== lastExNum && block.type === 'instruction') {
      if (lastExNum > 0) html += '<div style="height:20px;"></div>'
      html += `<div style="background:#EFF6FF;border:2px solid #3B82F6;border-radius:6px;padding:6px 12px;margin:16px 0 8px;font-weight:bold;color:#1D4ED8;font-size:1.05em;">
        Exercice ${block.exercise_number}
      </div>`
      lastExNum = block.exercise_number
    }

    if (block.type === 'exercise') {
      // Items verticaux
      const raw = block.exercise_items?.length ? block.exercise_items : content.split('\n')
      const items = raw.map(s => s.trim()).filter(s => s.length > 0)
      const finalItems = (items.length === 1 && items[0].includes('|'))
        ? items[0].split('|').map(s => s.trim()).filter(s => s.length > 0)
        : items
      html += '<ul style="list-style:none;padding-left:24px;margin:4px 0;">'
      for (const item of finalItems) {
        // Remplacer ___ par un blanc visuel large (4 em, souligné)
        const itemHtml = item.replace(/___/g,
          '<span style="display:inline-block;min-width:4em;border-bottom:1.5px solid #333;margin:0 2px;">&nbsp;&nbsp;&nbsp;&nbsp;</span>'
        )
        html += `<li style="margin:6px 0;"><span style="color:#3B82F6;font-weight:bold;margin-right:6px;">›</span>${itemHtml}</li>`
      }
      html += '</ul>'
    } else if (block.type === 'title') {
      html += `<h2 style="font-size:1.2em;margin:12px 0 4px;" data-block-id="${block.id}">${content}</h2>`
    } else if (block.type === 'instruction') {
      html += `<p style="font-style:italic;margin:4px 0 8px;padding-left:4px;border-left:3px solid #94A3B8;" data-block-id="${block.id}">${content}</p>`
    } else {
      html += `<p style="margin:4px 0;" data-block-id="${block.id}">${content}</p>`
    }
  }

  html += '</div>'
  return html
}
