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
    const jsonStart = result.indexOf('{')
    const jsonEnd = result.lastIndexOf('}')
    if (jsonStart === -1 || jsonEnd === -1) throw new Error('No JSON in Claude response')
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
    const parsed = JSON.parse(sanitized)
    // (extracted + sanitized)
    return res.json(parsed)
  } catch (e: any) {
    console.error('Rewrite error:', e)
    return res.status(500).json({ error: e.message })
  }
}
