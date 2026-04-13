/**
 * PDF Processor
 *
 * Stratégie "texte d'abord" :
 *   1. Tente d'extraire la couche texte du PDF (pdfjs getTextContent)
 *   2. Si le texte est lisible (PDF numérique) → pipeline texte, comme un DOCX
 *   3. Si le texte est vide ou illisible (scan) → fallback images PNG → Vision
 *
 * Cette approche élimine toutes les erreurs de transcription Vision
 * pour les PDFs créés numériquement (police cursive scolaire incluse).
 */

import * as pdfjsLib from 'pdfjs-dist'
import type { DocumentBlock } from './claudeRewriter'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PdfPage {
  pageNumber: number
  base64: string
  width: number
  height: number
}

export interface PdfTextResult {
  isDigital: boolean          // true = texte lisible → pipeline texte
  blocks: DocumentBlock[]     // blocs texte reconstruits (si isDigital)
  pages: PdfPage[]            // images PNG (fallback Vision legacy)
  pdfBase64: string           // PDF brut base64 (pour rewritePdfDirect)
}

// ── Extraction texte (PDF numérique) ─────────────────────────────────────────

/**
 * Tente d'extraire et reconstruire le texte d'un PDF.
 * Retourne { isDigital: true, blocks } si le PDF est numérique lisible.
 * Retourne { isDigital: false, pages } si c'est un scan → Vision nécessaire.
 */
export async function extractPdfContent(file: File): Promise<PdfTextResult> {
  const arrayBuffer = await file.arrayBuffer()
  // Garder le base64 brut pour l'envoi direct à l'API si besoin
  const pdfBase64 = arrayBufferToBase64(arrayBuffer)
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  let allText = ''
  const rawPages: { pageNum: number; items: Array<{ str: string; y: number; x: number; height: number }> }[] = []

  // Extraire les items texte de chaque page
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()

    const items = content.items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((item: any) => item.str !== undefined)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => ({
        str: item.str as string,
        // transform[5] = y (bas de la ligne), transform[4] = x
        y: Math.round(item.transform[5]),
        x: Math.round(item.transform[4]),
        height: Math.round(item.height ?? 10),
      }))

    rawPages.push({ pageNum: i, items })
    allText += items.map(i => i.str).join(' ')
  }

  // Évaluer la lisibilité : ratio de caractères lisibles
  if (!isReadableText(allText)) {
    // Scan ou PDF image → document natif Claude (pas de conversion canvas)
    return { isDigital: false, blocks: [], pages: [], pdfBase64 }
  }

  // PDF numérique → reconstruire les blocs depuis la couche texte
  const blocks = reconstructBlocks(rawPages)
  return { isDigital: true, blocks, pages: [], pdfBase64 }
}

/**
 * Évalue si le texte extrait est lisible (PDF numérique)
 * vs du bruit (scan avec OCR dégradé ou PDF image sans texte)
 */
function isReadableText(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length < 30) return false  // trop court = probablement vide

  // Ratio lettres + chiffres + ponctuation courante / total
  const readable = (trimmed.match(/[\p{L}\p{N}\s.,;:!?'"\-()«»_]/gu) ?? []).length
  return readable / trimmed.length > 0.75
}

/**
 * Regroupe les items texte par ligne (y proche) puis par paragraphe (gap vertical)
 * et retourne des DocumentBlocks.
 */
function reconstructBlocks(
  rawPages: { pageNum: number; items: Array<{ str: string; y: number; x: number; height: number }> }[]
): DocumentBlock[] {
  const blocks: DocumentBlock[] = []
  let blockId = 0

  for (const { pageNum, items } of rawPages) {
    if (items.length === 0) continue

    // Trier par y décroissant (pdfjs y=0 en bas), puis x croissant
    const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)

    // Regrouper en lignes (même y ± tolérance)
    const lines: string[] = []
    let currentLine = ''
    let lastY = sorted[0].y
    const tolerance = Math.max(...items.map(i => i.height)) * 0.6 || 6

    for (const item of sorted) {
      if (Math.abs(item.y - lastY) > tolerance) {
        if (currentLine.trim()) lines.push(currentLine.trim())
        currentLine = item.str
        lastY = item.y
      } else {
        currentLine += (currentLine && !currentLine.endsWith(' ') ? ' ' : '') + item.str
      }
    }
    if (currentLine.trim()) lines.push(currentLine.trim())

    // Regrouper les lignes en blocs (paragraphes) — une ligne vide = nouveau bloc
    let currentParagraph: string[] = []

    const flushParagraph = () => {
      const text = currentParagraph.join('\n').trim()
      if (!text) return
      blockId++
      blocks.push({
        id: `p${pageNum}-b${blockId}`,
        type: inferBlockType(text),
        text,
      })
      currentParagraph = []
    }

    for (const line of lines) {
      if (line === '') {
        flushParagraph()
      } else {
        currentParagraph.push(line)
      }
    }
    flushParagraph()
  }

  return blocks
}

/**
 * Déduit le type de bloc depuis le contenu textuel.
 */
function inferBlockType(text: string): DocumentBlock['type'] {
  const t = text.trim()
  // Titre court (≤ 6 mots, pas de ponctuation finale)
  if (t.split(/\s+/).length <= 6 && !/[.!?]$/.test(t)) return 'title'
  // Consigne (verbe d'action + impératif)
  if (/^(Lis|Écris|Entoure|Complète|Relie|Choisis|Ajoute|Souligne|Barre|Classe|Associe|Colorie|Observe|Réponds)/i.test(t)) return 'instruction'
  // Exercice (lacunes, tirets, pointillés)
  if (/_{2,}|\.{3,}|\[.*\]/.test(t)) return 'exercise'
  return 'body'
}

// ── Utilitaire ────────────────────────────────────────────────────────────────

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// ── Fallback : rendu PNG pour Vision (scan) ───────────────────────────────────

/**
 * Convertit un PDF en images PNG base64 (fallback pour les scans uniquement).
 * Résolution 3.0× pour lire les polices cursives scolaires.
 */
export async function pdfToImages(file: File, scale = 3.0): Promise<PdfPage[]> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pages: PdfPage[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale })

    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')!

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.render({ canvasContext: ctx, viewport } as any).promise

    const dataUrl = canvas.toDataURL('image/png')
    const base64 = dataUrl.replace('data:image/png;base64,', '')

    pages.push({
      pageNumber: i,
      base64,
      width: Math.round(viewport.width),
      height: Math.round(viewport.height),
    })

    canvas.width = 0
    canvas.height = 0
  }

  return pages
}
