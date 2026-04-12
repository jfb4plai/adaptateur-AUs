/**
 * Serveur Express minimal pour développement local
 * Lance avec : npx tsx api/server.ts
 * Le front Vite proxifie /api → http://localhost:3001
 */

import express from 'express'
import { handleRewrite } from './_rewrite.js'

const app = express()
app.use(express.json({ limit: '5mb' }))

app.post('/api/rewrite', async (req, res) => {
  try {
    const result = await handleRewrite(req.body)
    // Tenter de parser le JSON retourné par Claude
    const parsed = JSON.parse(result)
    res.json(parsed)
  } catch (e: any) {
    console.error('Rewrite error:', e)
    res.status(500).json({ error: e.message })
  }
})

app.listen(3001, () => {
  console.log('AU-Convertisseur API running on http://localhost:3001')
})
