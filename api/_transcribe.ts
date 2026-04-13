/**
 * PASSE 1 — Transcription pure
 * Objectif unique : reproduire le document fidèlement, comme la mobile app Claude.
 * Aucune adaptation, aucune correction, aucun JSON complexe.
 * Output : texte markdown structuré
 */

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = 'claude-sonnet-4-20250514'

interface TranscribeRequest {
  pdfBase64: string
}

export async function handleTranscribe(body: TranscribeRequest): Promise<string> {
  const result = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: TRANSCRIPTION_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: body.pdfBase64 },
          } as any,
          {
            type: 'text',
            text: 'Transcris ce document pédagogique fidèlement en respectant les règles de format.',
          },
        ],
      },
    ],
  })

  const text = result.content[0]
  if (text.type !== 'text') throw new Error('Unexpected response type (transcribe)')
  return text.text
}

const TRANSCRIPTION_PROMPT = `Tu transcris un document pédagogique pour des enseignants de la Fédération Wallonie-Bruxelles.

MISSION UNIQUE : reproduire le contenu EXACTEMENT tel qu'il apparaît — sans adapter, sans corriger, sans reformuler.

════════════════════════════════════
RÈGLES DE FORMAT (obligatoires)
════════════════════════════════════

1. TITRE PRINCIPAL
   # Titre du document

2. CHAQUE EXERCICE
   ## Exercice N — [consigne exacte de l'exercice]
   (N = numéro tel qu'il apparaît, ou numérotation séquentielle si absent)

3. ITEMS D'EXERCICE
   Un item par ligne, précédé de •
   Ex : • un j___
        • j___di

4. BLANCS À COMPLÉTER
   Tous les tirets, pointillés, cases vides → ___
   Mots partiels : garder les lettres visibles + ___
   Ex : "un b___f"  (b et f imprimés, blanc entre = ___)

5. ILLUSTRATIONS (dessins, pictogrammes, images)
   [IMG: mot_précis_en_1_mot]
   → placé sur sa propre ligne, juste avant l'item associé
   → choisir le mot le plus précis possible (ex: bœuf, pneu, cœur, dé)
   → si l'image est trop floue pour être identifiée : [IMG: ?]

6. LISTES DE MOTS
   Conserver sur lignes séparées précédées de »
   Ex : » fleurs
        » œuf
        » heure

7. CHOIX MULTIPLES
   Conserver la forme exacte : (mot1 / mot2)

8. SÉPARATION ENTRE EXERCICES
   Ligne vide avant chaque ## Exercice

════════════════════════════════════
INTERDICTIONS ABSOLUES
════════════════════════════════════
✗ Ne jamais reformuler ni "améliorer" le texte
✗ Ne jamais compléter les blancs ___
✗ Ne jamais corriger les fautes apparentes
✗ Ne jamais ajouter d'explications`
