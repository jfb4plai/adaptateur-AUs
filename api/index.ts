/**
 * Vercel Serverless Function — POST /api/rewrite
 * Déployé automatiquement depuis le dossier /api
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleRewrite } from './rewrite.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const result = await handleRewrite(req.body)
    const parsed = JSON.parse(result)
    return res.json(parsed)
  } catch (e: any) {
    console.error('Rewrite error:', e)
    return res.status(500).json({ error: e.message })
  }
}
