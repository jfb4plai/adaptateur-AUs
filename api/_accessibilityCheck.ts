/**
 * Passe 3 — Score d'accessibilité AVANT / APRÈS
 * Critères fondés sur le corpus RISS (522 627 articles francophones)
 *
 * Références mobilisées :
 *   hal-02786191  Elguendouze 2020 — longueur de phrase, simplification syntaxique
 *   tel-04807443  Balssa 2024     — FALC en classe élémentaire, règles Inclusion Europe
 *   W4311612447   Schneider-Mizony 2022 — validation psycholinguistique FALC
 *   tel-03431384  Castillan 2020  — charge cognitive, principe d'intégration (Mayer)
 *   dumas-01516365 Kieken 2011    — lisibilité visuelle DYS, longueur de ligne
 */

import Anthropic from '@anthropic-ai/sdk'
import type { TextAdaptation } from '../src/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = 'claude-haiku-4-5-20251001'

export interface AccessibilityCriterion {
  id: string
  label: string
  riss_ref: string          // ID RISS de la source
  status: 'ok' | 'warning' | 'fail'
  detail: string
}

export interface AccessibilityScore {
  score: number
  level: 'excellent' | 'bon' | 'moyen' | 'insuffisant'
  criteria: AccessibilityCriterion[]
}

export interface AccessibilityResult {
  before: AccessibilityScore
  after: AccessibilityScore
  delta: number             // after.score - before.score
  recommendations: string[] // basées sur les critères encore insuffisants après adaptation
  riss_refs: RissRef[]
}

export interface RissRef {
  id: string
  authors: string
  year: number
  title: string
  key_finding: string
  criterion_applied: string
}

interface AccessibilityCheckRequest {
  blocks: Array<{ type: string; original: string; transformed: string }>
  textAdaptation: TextAdaptation
  activeAUs: string[]
  language: string
}

// Références RISS utilisées pour le scoring
const RISS_REFS: RissRef[] = [
  {
    id: 'hal-02786191',
    authors: 'Elguendouze S.',
    year: 2020,
    title: 'Simplification de textes : un état de l\'art',
    key_finding: 'La longueur des phrases est le meilleur prédicteur de compréhension. Subordonnées, passif et structures non canoniques constituent les obstacles principaux.',
    criterion_applied: 'Longueur des phrases & complexité syntaxique',
  },
  {
    id: 'tel-04807443',
    authors: 'Balssa F.',
    year: 2024,
    title: 'FALC et école inclusive',
    key_finding: 'Règles FALC (Inclusion Europe) : phrases ≤ 8 mots, voix active, forme positive, une idée par phrase. Bénéfices documentés pour les élèves en difficulté en classe élémentaire.',
    criterion_applied: 'Structure FALC & instructions',
  },
  {
    id: 'tel-03431384',
    authors: 'Castillan L.',
    year: 2020,
    title: 'Améliorer l\'accessibilité des manuels scolaires pour les élèves déficients visuels',
    key_finding: 'La dispersion spatiale des informations augmente la charge cognitive extrinsèque. Le principe d\'intégration (Mayer 2014) réduit la surcharge et améliore les performances.',
    criterion_applied: 'Structure spatiale & charge cognitive',
  },
  {
    id: 'dumas-01516365',
    authors: 'Kieken M.',
    year: 2011,
    title: 'Impact de l\'écran sur la lecture de l\'adolescent dyslexique',
    key_finding: 'Lignes de 40–70 caractères, éviter majuscules (−12 % vitesse) et italique. Polices sans empattement recommandées pour les supports numériques.',
    criterion_applied: 'Lisibilité visuelle & typographie',
  },
  {
    id: 'W4311612447',
    authors: 'Schneider-Mizony O.',
    year: 2022,
    title: 'Langues faciles à comprendre (FALC) : assises linguistiques et promesses sociales',
    key_finding: 'Validation des règles FALC : bénéfices sur l\'engagement et la satisfaction robustement documentés. Un concept = un mot, pas d\'abréviations ni de métaphores.',
    criterion_applied: 'Vocabulaire & cohérence textuelle',
  },
]

export async function handleAccessibilityCheck(
  body: AccessibilityCheckRequest
): Promise<AccessibilityResult> {
  const { blocks, textAdaptation, activeAUs, language } = body

  const originalText = blocks
    .filter(b => b.original?.trim())
    .map(b => `[${b.type}] ${b.original}`)
    .join('\n\n')

  const transformedText = blocks
    .filter(b => b.transformed?.trim())
    .map(b => `[${b.type}] ${b.transformed}`)
    .join('\n\n')

  const result = await client.messages.create({
    model: MODEL,
    max_tokens: 3000,
    system: buildPrompt(textAdaptation, activeAUs, language),
    messages: [
      {
        role: 'user',
        content: `DOCUMENT ORIGINAL (avant adaptation) :\n\n${originalText}\n\n---\n\nDOCUMENT ADAPTÉ (après adaptation) :\n\n${transformedText}\n\nÉvalue les deux versions et retourne le JSON avant/après.`,
      },
    ],
  })

  const text = result.content[0]
  if (text.type !== 'text') throw new Error('Unexpected response type (accessibility check)')

  const jsonMatch = text.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in accessibility check response')

  const parsed = JSON.parse(jsonMatch[0]) as Omit<AccessibilityResult, 'riss_refs'>

  // Sélectionner les refs RISS pertinentes selon le profil
  const relevantRefs = RISS_REFS.filter(r => {
    if (textAdaptation === 'DYS') return true
    if (textAdaptation === 'FALC') return ['tel-04807443', 'W4311612447', 'hal-02786191'].includes(r.id)
    if (textAdaptation === 'TDAH') return ['hal-02786191', 'tel-03431384'].includes(r.id)
    return ['hal-02786191', 'tel-03431384'].includes(r.id)
  })

  return { ...parsed, riss_refs: relevantRefs }
}

function buildPrompt(
  textAdaptation: TextAdaptation,
  activeAUs: string[],
  language: string
): string {
  const profileCriteria: Record<string, Array<{ id: string; label: string; riss: string; rule: string }>> = {
    DYS: [
      { id: 'sent_length',   label: 'Phrases ≤ 15 mots',              riss: 'hal-02786191',  rule: 'Compter les mots de chaque phrase dans les consignes et le corps du texte' },
      { id: 'syntax',        label: 'Voix active, pas de passif',      riss: 'hal-02786191',  rule: 'Détecter les constructions passives' },
      { id: 'one_idea',      label: 'Une idée par phrase',             riss: 'tel-04807443',  rule: 'Détecter les coordinations multiples et subordonnées imbriquées' },
      { id: 'verb_first',    label: 'Verbe d\'action en tête de consigne', riss: 'tel-04807443', rule: 'Vérifier que chaque consigne commence par un infinitif ou impératif' },
      { id: 'no_negation',   label: 'Pas de double négation',          riss: 'W4311612447',   rule: 'Détecter les constructions "ne ... pas de"' },
      { id: 'spatial',       label: 'Items en colonne (pas en ligne)',  riss: 'tel-03431384',  rule: 'Détecter les listes inline séparées par virgules ou barres' },
    ],
    TDAH: [
      { id: 'sent_length',   label: 'Phrases ≤ 12 mots',              riss: 'hal-02786191',  rule: 'Compter les mots de chaque consigne' },
      { id: 'one_action',    label: 'Une seule action par consigne',   riss: 'tel-04807443',  rule: 'Détecter les consignes avec plusieurs verbes d\'action' },
      { id: 'instr_first',   label: 'Instructions avant les exercices', riss: 'tel-03431384', rule: 'Vérifier la position des blocs instruction vs exercise' },
      { id: 'spatial',       label: 'Items en colonne',                riss: 'tel-03431384',  rule: 'Détecter les listes inline' },
      { id: 'numbered',      label: 'Exercices numérotés',             riss: 'tel-03431384',  rule: 'Vérifier la présence de numérotation' },
    ],
    FALC: [
      { id: 'sent_length',   label: 'Phrases ≤ 8 mots',               riss: 'tel-04807443',  rule: 'Compter strictement les mots' },
      { id: 'vocabulary',    label: 'Vocabulaire courant (pas de jargon)', riss: 'W4311612447', rule: 'Détecter les termes techniques sans explication' },
      { id: 'one_idea',      label: 'Une idée par phrase',             riss: 'tel-04807443',  rule: 'Pas de subordonnées ni de coordinations complexes' },
      { id: 'no_metaphor',   label: 'Pas de métaphores',               riss: 'W4311612447',   rule: 'Détecter les expressions figurées' },
      { id: 'spatial',       label: 'Structure spatiale claire',       riss: 'tel-03431384',  rule: 'Items verticaux, titres visibles' },
    ],
    none: [
      { id: 'sent_length',   label: 'Phrases ≤ 20 mots',              riss: 'hal-02786191',  rule: 'Compter les mots' },
      { id: 'spatial',       label: 'Items en colonne',                riss: 'tel-03431384',  rule: 'Détecter les listes inline' },
      { id: 'instr_first',   label: 'Instructions avant exercices',    riss: 'tel-03431384',  rule: 'Vérifier l\'ordre des blocs' },
    ],
    FLE: [
      { id: 'vocab_b1',      label: 'Vocabulaire ≤ B1',               riss: 'hal-02786191',  rule: 'Détecter les termes avancés sans glose' },
      { id: 'sent_length',   label: 'Phrases ≤ 15 mots',              riss: 'hal-02786191',  rule: 'Compter les mots' },
      { id: 'syntax',        label: 'Structure SVO simple',            riss: 'hal-02786191',  rule: 'Détecter les inversions syntaxiques' },
    ],
    HP: [
      { id: 'precision',     label: 'Précision terminologique',        riss: 'hal-02786191',  rule: 'Vérifier que les termes techniques sont corrects' },
      { id: 'complexity',    label: 'Complexité cognitive maintenue',  riss: 'tel-03649621',  rule: 'Vérifier absence de sur-simplification' },
    ],
  }

  const criteria = profileCriteria[textAdaptation] ?? profileCriteria.none

  return `Tu es un expert en accessibilité pédagogique (FWB). Tu évalues DEUX versions d'un même document :
VERSION 1 = document original (AVANT adaptation)
VERSION 2 = document adapté (APRÈS adaptation AU)

Profil : ${textAdaptation} | AUs actifs : ${activeAUs.join(', ')} | Langue : ${language}

CRITÈRES D'ÉVALUATION (fondés sur corpus RISS) :
${criteria.map((c, i) => `${i + 1}. [${c.riss}] ${c.label} — ${c.rule}`).join('\n')}

CRITÈRES UNIVERSELS (tous profils, source : tel-03431384 + hal-02786191) :
- Items d'exercice en colonne verticale (pas en ligne séparés par | ou virgule)
- Instructions placées AVANT les exercices
- Blancs cohérents (_ _ _)
- Pas de majuscules abusives (> 3 mots consécutifs)

MÉTHODE :
Pour CHAQUE critère, évalue les deux versions séparément (ok / warning / fail).
Score : ok = 2 pts, warning = 1 pt, fail = 0 pt, normalisé sur 100.
Niveau : 85+ = excellent, 70-84 = bon, 50-69 = moyen, <50 = insuffisant.

RETOURNE UNIQUEMENT ce JSON :
{
  "before": {
    "score": 35,
    "level": "insuffisant",
    "criteria": [
      { "id": "sent_length", "label": "Phrases ≤ 15 mots", "riss_ref": "hal-02786191", "status": "fail", "detail": "3 phrases dépassent 15 mots dans le document original" }
    ]
  },
  "after": {
    "score": 78,
    "level": "bon",
    "criteria": [
      { "id": "sent_length", "label": "Phrases ≤ 15 mots", "riss_ref": "hal-02786191", "status": "ok", "detail": "Toutes les phrases respectent la limite après adaptation" }
    ]
  },
  "delta": 43,
  "recommendations": [
    "Le critère X reste insuffisant même après adaptation — action suggérée"
  ]
}`
}
