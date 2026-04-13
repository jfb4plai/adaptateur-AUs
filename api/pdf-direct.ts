/**
 * Vercel Serverless Function — POST /api/pdf-direct
 * Envoie le PDF brut à Claude (document natif) — pour scans Microsoft Lens etc.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handlePdfDirect } from './_pdfDirect.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const result = await handlePdfDirect(req.body)

    const jsonStart = result.indexOf('{')
    const jsonEnd = result.lastIndexOf('}')
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error('No JSON in response')
    }

    const extracted = result.slice(jsonStart, jsonEnd + 1)
    const sanitized = extracted.replace(
      /"(?:[^"\\]|\\.)*"/g,
      (match) => match.replace(/[\x00-\x1F\x7F]/g, (c) => {
        if (c === '\n') return '\\n'
        if (c === '\r') return '\\r'
        if (c === '\t') return '\\t'
        return ''
      })
    )

    return res.json(JSON.parse(sanitized))
  } catch (e: any) {
    console.error('PDF Direct error:', e)
    return res.status(500).json({ error: e.message })
  }
}
