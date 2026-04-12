/**
 * PDF Processor — rend chaque page du PDF en image PNG base64
 * via pdfjs-dist (canvas côté navigateur)
 */
import * as pdfjsLib from 'pdfjs-dist'

// Worker inline (évite les problèmes de CORS avec Vite)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

export interface PdfPage {
  pageNumber: number
  base64: string       // PNG base64 sans le préfixe data:image/png;base64,
  width: number
  height: number
}

/**
 * Convertit un fichier PDF en tableau d'images PNG base64
 * Résolution adaptée : 1.5× (bon équilibre qualité/taille)
 */
export async function pdfToImages(file: File, scale = 1.5): Promise<PdfPage[]> {
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

    // Extraire le PNG en base64 (sans le préfixe)
    const dataUrl = canvas.toDataURL('image/png')
    const base64 = dataUrl.replace('data:image/png;base64,', '')

    pages.push({
      pageNumber: i,
      base64,
      width: Math.round(viewport.width),
      height: Math.round(viewport.height),
    })

    // Libérer la mémoire canvas
    canvas.width = 0
    canvas.height = 0
  }

  return pages
}
