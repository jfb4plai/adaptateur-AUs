/**
 * PDF Direct handler — envoie le PDF brut (base64) à Claude comme document natif
 *
 * L'API Anthropic accepte les PDFs directement (type: "document").
 * Claude lit le PDF tel quel — scan Microsoft Lens, print-to-PDF, etc.
 * Résultat identique à ce que fait la mobile app Claude.
 *
 * Avantage vs Vision page-par-page :
 *   - Qualité parfaite (aucune conversion canvas intermédiaire)
 *   - Un seul appel API pour tout le document
 *   - Lit le texte ET les images nativement
 */

import Anthropic from '@anthropic-ai/sdk'
import type { TextAdaptation } from '../src/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Sonnet 4 — supporte les documents PDF natifs
const MODEL = 'claude-sonnet-4-20250514'

interface PdfDirectRequest {
  pdfBase64: string          // PDF complet en base64
  activeAUs: string[]
  textAdaptation: TextAdaptation
  language: string
}

export async function handlePdfDirect(body: PdfDirectRequest): Promise<string> {
  const { pdfBase64, activeAUs, textAdaptation, language } = body

  const result = await client.messages.create({
    model: MODEL,
    max_tokens: 8096,
    system: buildPrompt(activeAUs, textAdaptation, language),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdfBase64,
            },
          } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
          {
            type: 'text',
            text: 'Analyse ce document pédagogique et retourne le JSON demandé.',
          },
        ],
      },
    ],
  })

  const text = result.content[0]
  if (text.type !== 'text') throw new Error('Unexpected response type')
  return text.text
}

function buildPrompt(
  activeAUs: string[],
  textAdaptation: TextAdaptation,
  language: string
): string {
  return `Tu es un expert en adaptation pédagogique pour la Fédération Wallonie-Bruxelles (FWB).
Tu reçois un document pédagogique (PDF) — scan ou numérique — et tu dois :
1. Extraire fidèlement tout le contenu (texte + structure)
2. L'adapter selon les Aménagements Universels actifs
3. Retourner un JSON structuré

LANGUE : ${language}
PROFIL D'ADAPTATION : ${textAdaptation}
AMÉNAGEMENTS UNIVERSELS ACTIFS : ${activeAUs.join(', ')}

════════════════════════════════════════════════════════════
  EXTRACTION — RÈGLES STRICTES
════════════════════════════════════════════════════════════

- "original" = texte EXACTEMENT tel qu'il apparaît dans le document
- Ne jamais inventer, compléter ou reformuler dans le champ "original"
- Lacunes / blancs à remplir → " ___ " (3 underscores)
- Chaque item d'exercice = UNE LIGNE SÉPARÉE (jamais en ligne avec |)
- Types : title | instruction | body | exercise

════════════════════════════════════════════════════════════
  ADAPTATION (champ "transformed" uniquement)
════════════════════════════════════════════════════════════
${activeAUs.includes('AU12') ? '- AU12 : verbe principal dans "action_verb".' : ''}
${activeAUs.includes('AU13') ? '- AU13 : reformule les consignes dans "transformed".' : ''}
${activeAUs.includes('AU14') ? '- AU14 : consigne multi-actions → "bullet_items".' : ''}
${activeAUs.includes('AU15') ? '- AU15 : objectif dans "objective_sentence".' : ''}
${activeAUs.includes('AU18') ? '- AU18 : exemple dans "example", contre-exemple dans "counter_example".' : ''}
${activeAUs.includes('AU19') ? '- AU19 : procédures → "steps".' : ''}
${activeAUs.includes('AU21') ? '- AU21 : niveau Bloom dans "bloom_level".' : ''}
${activeAUs.includes('AU24') ? '- AU24 : encouragement dans "feedback_sentence".' : ''}

${textAdaptation !== 'none' ? `PROFIL ${textAdaptation} :
${textAdaptation === 'DYS' ? '- Phrases ≤ 15 mots, verbe en début.' : ''}
${textAdaptation === 'TDAH' ? '- 1 action par phrase max.' : ''}
${textAdaptation === 'FALC' ? '- Phrases ≤ 10 mots, vocabulaire courant.' : ''}
${textAdaptation === 'FLE' ? '- Vocabulaire B1, glose les termes techniques.' : ''}
${textAdaptation === 'HP' ? '- Maintien de la complexité, vocabulaire précis.' : ''}` : ''}

PICTOGRAMMES : "picto_words" = mots-clés à pictogrammer (lemmatisés, sans article).
JSON valide : guillemets dans valeurs → apostrophes ', pas de caractères de contrôle.

RETOURNE UNIQUEMENT ce JSON :
{
  "blocks": [
    {
      "id": "b1",
      "type": "title|instruction|body|exercise",
      "original": "texte exact du document",
      "transformed": "texte adapté",
      "action_verb": null,
      "bullet_items": null,
      "objective_sentence": null,
      "example": null,
      "counter_example": null,
      "steps": null,
      "bloom_level": null,
      "recommended_support": null,
      "feedback_sentence": null,
      "written_version": null,
      "checkpoints": null,
      "picto_words": []
    }
  ],
  "structure_hints": {
    "reorder_instructions_first": false,
    "complexity_order": []
  }
}`
}
