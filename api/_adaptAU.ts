/**
 * PASSE 2 — Adaptation AU
 * Input  : texte markdown propre (produit par _transcribe.ts)
 * Output : JSON structuré pour le DOCX builder
 *
 * Séparation des responsabilités :
 *   Passe 1 = transcrire fidèlement (qualité mobile app Claude)
 *   Passe 2 = adapter selon les AUs (JSON fiable car input propre)
 */

import Anthropic from '@anthropic-ai/sdk'
import type { TextAdaptation } from '../src/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = 'claude-sonnet-4-20250514'

interface AdaptAURequest {
  transcription: string        // Markdown produit par la passe 1
  activeAUs: string[]
  textAdaptation: TextAdaptation
  language: string
}

export async function handleAdaptAU(body: AdaptAURequest): Promise<string> {
  const { transcription, activeAUs, textAdaptation, language } = body

  const result = await client.messages.create({
    model: MODEL,
    max_tokens: 6000,
    system: buildAdaptPrompt(activeAUs, textAdaptation, language),
    messages: [
      {
        role: 'user',
        content: `Voici la transcription du document pédagogique (passe 1) :\n\n${transcription}\n\nApplique les adaptations demandées et retourne le JSON.`,
      },
    ],
  })

  const text = result.content[0]
  if (text.type !== 'text') throw new Error('Unexpected response type (adapt-au)')
  return text.text
}

function buildAdaptPrompt(
  activeAUs: string[],
  textAdaptation: TextAdaptation,
  language: string
): string {
  return `Tu es un expert en adaptation pédagogique pour la Fédération Wallonie-Bruxelles (FWB).
Tu reçois la transcription fidèle d'un document (format markdown structuré).
Tu dois convertir ce texte en JSON pour générer un DOCX adapté.

LANGUE : ${language}
PROFIL D'ADAPTATION : ${textAdaptation}
AMÉNAGEMENTS UNIVERSELS ACTIFS : ${activeAUs.join(', ')}

════════════════════════════════════════════════
ÉTAPE 1 — VALIDATION DU VOCABULAIRE (OBLIGATOIRE)
════════════════════════════════════════════════

Avant toute conversion, vérifie chaque mot du texte transcrit :
• Si un mot n'existe pas en français mais qu'une correction évidente existe
  (ex : "éable" → "étable", "tabe" → "table"), corrige-le dans "original"
  ET note la correction dans "original" comme : mot_corrigé [CORR: mot_original]
  Ex : "Dans l'étable [CORR: éable], il y a des bœufs"
• Si un mot est ambigu et la correction n'est pas certaine → laisser avec [?]
• Mots techniques, noms propres, régionalismes belges → ne pas "corriger"

════════════════════════════════════════════════
ÉTAPE 2 — CONVERSION MARKDOWN → JSON
════════════════════════════════════════════════

STRUCTURE — ORDRE ABSOLU À RESPECTER :
Pour chaque ## Exercice N, créer ces blocs DANS CET ORDRE EXACT :
  1. bloc type "instruction", exercise_number = N  ← TOUJOURS EN PREMIER
  2. bloc type "exercise", exercise_number = N     ← TOUJOURS APRÈS l'instruction

JAMAIS : items d'exercice avant leur consigne.
JAMAIS : consigne après les items.
JAMAIS : mélanger les items d'exercices différents.

Types de blocs :
• # Titre → "title"
• ## Exercice N — Consigne → "instruction" (exercise_number = N)
• • Items sous une ## → "exercise" (exercise_number = N, exercise_items = [...])
• » Liste de mots → "body"
• Texte courant → "body"

ILLUSTRATIONS [IMG: mot] :
• Conserver [IMG: mot] dans exercise_items[] à sa position exacte
• Collecter tous les mots uniques dans "illustration_words" (racine JSON)

BLANCS ___ :
• Conserver exactement ___ dans "original" ET "transformed"
• Ne jamais compléter les blancs

CHAMPS :
• "original" = texte de la transcription (corrigé si mot inexistant, cf. Étape 1)
• "transformed" = texte adapté selon les AUs (= original si aucun AU applicable)
• "exercise_items" = tableau des items • (obligatoire si type = "exercise")
• "exercise_number" = numéro 1, 2, 3... (obligatoire si instruction ou exercise)

════════════════════════════════════════════════
ADAPTATIONS PAR AU ACTIF (champ "transformed")
════════════════════════════════════════════════
${activeAUs.includes('AU12') ? '• AU12 : verbe principal de chaque consigne → "action_verb"' : ''}
${activeAUs.includes('AU13') ? '• AU13 : reformuler les consignes longues/passives dans "transformed"' : ''}
${activeAUs.includes('AU14') ? '• AU14 : consigne multi-actions → "bullet_items" (infinitifs)' : ''}
${activeAUs.includes('AU15') ? '• AU15 : phrase d\'objectif → "objective_sentence"' : ''}
${activeAUs.includes('AU18') ? '• AU18 : exemple → "example", contre-exemple → "counter_example"' : ''}
${activeAUs.includes('AU19') ? '• AU19 : procédures → liste numérotée → "steps"' : ''}
${activeAUs.includes('AU21') ? '• AU21 : niveau Bloom (1-6) → "bloom_level"' : ''}
${activeAUs.includes('AU24') ? '• AU24 : encouragement → "feedback_sentence"' : ''}

${textAdaptation !== 'none' ? `PROFIL ${textAdaptation} :
${textAdaptation === 'DYS' ? '• Phrases ≤ 15 mots, 1 idée/phrase, verbe en début de consigne' : ''}
${textAdaptation === 'TDAH' ? '• 1 action par phrase max, instructions numérotées si multi-étapes' : ''}
${textAdaptation === 'FALC' ? '• Phrases ≤ 10 mots, vocabulaire courant, 1 idée par phrase' : ''}
${textAdaptation === 'FLE' ? '• Vocabulaire B1 max, gloser les termes techniques' : ''}
${textAdaptation === 'HP' ? '• Maintien de la complexité, vocabulaire précis' : ''}` : ''}

PICTOGRAMMES : "picto_words" = mots du texte à pictogrammer (lemmatisés, sans article).

════════════════════════════════════════════════
RÈGLES JSON
════════════════════════════════════════════════
• Guillemets dans les valeurs → apostrophes '
• Pas de caractères de contrôle non échappés
• exercise_items TOUJOURS présent pour type "exercise" (tableau non vide)

RETOURNE UNIQUEMENT ce JSON :
{
  "blocks": [
    {
      "id": "b1",
      "type": "title|instruction|body|exercise",
      "exercise_number": null,
      "original": "texte exact",
      "transformed": "texte adapté",
      "exercise_items": [],
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
      "picto_words": [],
      "illustrations": []
    }
  ],
  "illustration_words": [],
  "structure_hints": {
    "reorder_instructions_first": false,
    "complexity_order": []
  }
}`
}
