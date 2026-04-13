/**
 * Vercel Serverless Function — POST /api/transcribe
 * Passe 1 : transcription pure du PDF (texte markdown)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleTranscribe } from './_transcribe.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const result = await handleTranscribe(req.body)
    return res.status(200).json(result)   // { text, analysis }
  } catch (e: any) {
    console.error('[transcribe]', e)
    return res.status(500).json({ error: e.message })
  }
}
