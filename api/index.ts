/**
 * Vercel Serverless Function — POST /api/rewrite
 * Déployé automatiquement depuis le dossier /api
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleRewrite } from './_rewrite.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const result = await handleRewrite(req.body)
    // Supprime les caractères de contrôle bruts (tabs, CR, etc.) qui brisent JSON.parse
    const sanitized = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
    const parsed = JSON.parse(sanitized)
    return res.json(parsed)
  } catch (e: any) {
    console.error('Rewrite error:', e)
    return res.status(500).json({ error: e.message })
  }
}
