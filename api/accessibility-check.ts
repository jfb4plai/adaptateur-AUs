/**
 * Vercel serverless function — POST /api/accessibility-check
 * Passe 3 : vérifie l'accessibilité du document adapté (profil DYS/TDAH/FALC...)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleAccessibilityCheck } from './_accessibilityCheck.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const result = await handleAccessibilityCheck(req.body)
    return res.status(200).json(result)
  } catch (err) {
    console.error('[accessibility-check]', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return res.status(500).json({ error: message })
  }
}
