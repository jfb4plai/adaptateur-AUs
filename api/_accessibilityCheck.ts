/**
 * Passe 3 — Vérification accessibilité
 * Évalue le document adapté selon les critères FALC / DYS / TDAH (FWB)
 * Retourne un score + recommandations actionnables
 */

import Anthropic from '@anthropic-ai/sdk'
import type { TextAdaptation } from '../src/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Haiku : tâche d'évaluation — pas besoin de Vision, coût minimal
const MODEL = 'claude-haiku-4-5-20251001'

export interface AccessibilityResult {
  score: number                    // 0–100
  level: 'excellent' | 'bon' | 'moyen' | 'insuffisant'
  criteria: AccessibilityCriterion[]
  recommendations: string[]
}

export interface AccessibilityCriterion {
  id: string
  label: string
  status: 'ok' | 'warning' | 'fail'
  detail: string
}

interface AccessibilityCheckRequest {
  blocks: Array<{ type: string; original: string; transformed: string }>
  textAdaptation: TextAdaptation
  activeAUs: string[]
  language: string
}

export async function handleAccessibilityCheck(
  body: AccessibilityCheckRequest
): Promise<AccessibilityResult> {
  const { blocks, textAdaptation, activeAUs, language } = body

  // Préparer le texte transformé pour évaluation
  const docText = blocks
    .map(b => `[${b.type}] ${b.transformed}`)
    .join('\n\n')

  const result = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: buildAccessibilityPrompt(textAdaptation, activeAUs, language),
    messages: [
      {
        role: 'user',
        content: `Évalue l'accessibilité de ce document adapté (${blocks.length} blocs) :\n\n${docText}\n\nRetourne le JSON d'évaluation demandé.`,
      },
    ],
  })

  const text = result.content[0]
  if (text.type !== 'text') throw new Error('Unexpected response type (accessibility check)')

  // Extraire le JSON
  const jsonMatch = text.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in accessibility check response')

  return JSON.parse(jsonMatch[0]) as AccessibilityResult
}

function buildAccessibilityPrompt(
  textAdaptation: TextAdaptation,
  activeAUs: string[],
  language: string
): string {
  const profileCriteria = {
    DYS: [
      'Phrases ≤ 15 mots',
      'Une seule idée par phrase',
      'Verbe d\'action en début de consigne',
      'Pas de double négation',
      'Pas de pronoms ambigus (il/elle/ils référence floue)',
      'Pas de synonymes successifs',
    ],
    TDAH: [
      'Phrases ≤ 12 mots',
      'Une seule action par consigne',
      'Consignes numérotées si multi-étapes',
      'Pas de consignes imbriquées',
      'Instructions avant l\'exercice (jamais après)',
    ],
    FALC: [
      'Phrases ≤ 10 mots',
      'Vocabulaire courant uniquement (pas de jargon)',
      'Une idée par phrase',
      'Pas de métaphores ni d\'expressions figurées',
      'Sujet + verbe + complément',
    ],
    FLE: [
      'Vocabulaire niveau B1 max',
      'Explications des termes techniques',
      'Phrases simples (SVO)',
    ],
    HP: [
      'Précision terminologique maintenue',
      'Complexité cognitive préservée',
    ],
    none: [
      'Phrases ≤ 20 mots',
      'Instructions claires',
    ],
  }

  const criteria = profileCriteria[textAdaptation] || profileCriteria.none

  return `Tu es un expert en accessibilité pédagogique pour la Fédération Wallonie-Bruxelles (FWB).
Tu évalues un document adapté selon le profil "${textAdaptation}" et les AUs actifs : ${activeAUs.join(', ')}.
Langue : ${language}

CRITÈRES D'ÉVALUATION pour le profil ${textAdaptation} :
${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

CRITÈRES UNIVERSELS (tous profils) :
- Chaque exercice : items listés verticalement (pas en ligne)
- Blancs à compléter : format " ___ " cohérent (jamais de variation)
- Instructions placées AVANT les exercices
- Verbes d'action en début de consigne (Lis, Écris, Complète, Entoure...)
- Pas de majuscules en continu (> 3 mots en majuscules = erreur)
- Pas de phrases entre parenthèses dans les consignes principales

MÉTHODE :
1. Évalue chaque critère : ok / warning / fail
2. Calcule le score (ok = 2 pts, warning = 1 pt, fail = 0 pt → sur 100)
3. Niveau : 85-100 = excellent, 70-84 = bon, 50-69 = moyen, <50 = insuffisant
4. Formule 3 à 5 recommandations actionnables et spécifiques au document

RETOURNE UNIQUEMENT ce JSON :
{
  "score": 82,
  "level": "bon",
  "criteria": [
    {
      "id": "sentence_length",
      "label": "Longueur des phrases",
      "status": "ok",
      "detail": "Toutes les phrases sont ≤ 15 mots"
    },
    {
      "id": "exercise_format",
      "label": "Format des exercices (vertical)",
      "status": "warning",
      "detail": "Bloc p1-b3 : items sur une seule ligne au lieu de colonnes"
    }
  ],
  "recommendations": [
    "Bloc p1-b3 : reformater les items de l'exercice en liste verticale (un par ligne)",
    "Bloc p2-b1 : la consigne 'Il faut compléter en choisissant...' → reformuler en 'Complète en choisissant...'"
  ]
}`
}
