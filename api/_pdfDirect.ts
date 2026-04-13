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
- Types : title | instruction | body | exercise

════════════════════════════════════════════════════════════
  STRUCTURE DES EXERCICES — RÈGLE CRITIQUE POUR ÉLÈVES À BESOINS SPÉCIFIQUES
════════════════════════════════════════════════════════════

Un document pédagogique contient généralement plusieurs exercices distincts.
Chaque exercice = une consigne (type "instruction") + des items (type "exercise").

NUMÉROTATION OBLIGATOIRE :
→ Numérote chaque exercice séquentiellement : 1, 2, 3...
→ Renseigne ce numéro dans le champ "exercise_number" du bloc exercise ET du bloc instruction associé
→ Si le document contient 3 exercices distincts → exercise_number 1, 2, 3

ITEMS D'EXERCICE — RÈGLE ABSOLUE :
→ Chaque item = UN ÉLÉMENT SÉPARÉ dans le tableau "exercise_items"
→ JAMAIS mettre plusieurs items dans une seule chaîne
→ Un item = une ligne de travail pour l'élève (un mot à compléter, une phrase à compléter, etc.)

EXEMPLE pour "Ajoute les bonnes lettres" avec 11 mots :
  "exercise_items": [
    "un j ___ ",
    "j ___ di",
    "un p ___ ",
    "ma s ___ r",
    "un n ___ d",
    "un b ___ f",
    "bl ___ ",
    "un vi ___ x",
    "l'h ___ re",
    "un c ___ r",
    "un doct ___ r"
  ]

EXEMPLE pour phrases à compléter :
  "exercise_items": [
    "Elle mange un ___ œuf dur.",
    "Maman dépose les ___ dans un vase.",
    "Milan regarde l'___ à sa montre."
  ]

Le champ "transformed" doit contenir tous les items joints par \\n (pour compatibilité).

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
      "type": "instruction",
      "original": "consigne exacte du document",
      "transformed": "consigne adaptée",
      "exercise_number": 1,
      "exercise_items": null,
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
    },
    {
      "id": "b2",
      "type": "exercise",
      "original": "item1\\nitem2\\nitem3",
      "transformed": "item1 adapté\\nitem2 adapté\\nitem3 adapté",
      "exercise_number": 1,
      "exercise_items": ["item1 adapté", "item2 adapté", "item3 adapté"],
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
