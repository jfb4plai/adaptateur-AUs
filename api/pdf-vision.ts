/**
 * Vercel Serverless Function — POST /api/pdf-vision
 * Analyse une page PDF (PNG base64) via Claude Vision
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handlePdfVision } from './_pdfVision.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const result = await handlePdfVision(req.body)
    // Sanitise les caractères de contrôle dans les valeurs JSON
    const sanitized = result.replace(
      /"(?:[^"\\]|\\.)*"/g,
      (match) => match.replace(/[\x00-\x1F\x7F]/g, (c) => {
        if (c === '\n') return '\\n'
        if (c === '\r') return '\\r'
        if (c === '\t') return '\\t'
        return ''
      })
    )
    const parsed = JSON.parse(sanitized)
    return res.json(parsed)
  } catch (e: any) {
    console.error('PDF Vision error:', e)
    return res.status(500).json({ error: e.message })
  }
}
