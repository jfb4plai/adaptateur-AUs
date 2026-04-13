/**
 * Score d'accessibilité DÉTERMINISTE
 *
 * Principe : chaque AU sélectionné = un critère d'accessibilité à atteindre.
 * - Avant : aucun AU appliqué → score 0 (document brut sans accommodations)
 * - Après : score basé sur les AUs effectivement appliqués
 *
 * Pas d'analyse LLM du texte : le score reflète ce que l'outil a vraiment fait.
 * La suppression de la police cursive (AU01) est pondérée en conséquence.
 */

import type { AccessibilityResult, AccessibilityScore, AccessibilityCriterion, RissRef } from '../types'
import type { AU } from '../types'

// ── Poids par AU (fondé sur corpus RISS) ─────────────────────────────────────

const AU_WEIGHTS: Record<string, number> = {
  AU01: 20,   // Police Arial — impact majeur DYS (Kieken 2011, Coffin 2023)
  AU02: 12,   // Interligne 1.5 (Klein 2010)
  AU03: 8,    // Alignement gauche (Gala 2020)
  AU04: 4,    // Titres mis en évidence
  AU05: 6,    // Supprimer soulignages (Gala 2020)
  AU06: 3,    // Réduire distracteurs
  AU07: 3,    // Numérotation pages
  AU08: 7,    // Numérotation exercices (Castillan 2020)
  AU09: 4,    // Consignes en premier (Castillan 2020)
  AU11: 7,    // Résolution modèle
  AU12: 8,    // Verbe d'action (Vela 2022)
  AU13: 12,   // Formulation claire (Bennejean 2015, Elguendouze 2020)
  AU14: 8,    // Consignes en puces (Vela 2022)
  AU15: 5,    // Objectif contextualisé
  AU16: 15,   // Pictogrammes Arasaac (Balssa 2024)
  AU17: 4,    // Progression simple→complexe (Bloom)
  AU18: 5,    // Exemples et contre-exemples
  AU19: 5,    // Étapes numérotées
  AU20: 3,    // Validation intermédiaire
  AU21: 3,    // Taxonomie Bloom
  AU22: 3,    // Support adéquat
  AU23: 3,    // Compétence ciblée
  AU24: 3,    // Rétroaction positive
  AU25: 3,    // Codes couleurs
  AU26: 5,    // Version écrite de la consigne orale
}

// AUs toujours appliqués (modifications typographiques directes dans le DOCX)
const ALWAYS_APPLIED = new Set(['AU01','AU02','AU03','AU04','AU05','AU06','AU07','AU08','AU25'])

// AUs appliqués si Claude a réécrit du contenu (blocks_rewritten > 0)
const APPLIED_IF_REWRITTEN = new Set([
  'AU09','AU11','AU12','AU13','AU14','AU15','AU17',
  'AU18','AU19','AU20','AU21','AU22','AU23','AU24','AU26',
])

// ── Calcul ────────────────────────────────────────────────────────────────────

export function computeAccessibilityScore(
  au_selections: string[],
  blocks_rewritten: number,
  picto_words_found: number,
  au_catalog: AU[]
): AccessibilityResult {
  // Filtrer les AUs sélectionnés qui ont un impact sur l'accessibilité du document
  const selected = au_catalog.filter(au =>
    au_selections.includes(au.id) && !au.id.startsWith('AU-ENV') && (AU_WEIGHTS[au.id] ?? 0) > 0
  )

  if (selected.length === 0) {
    const empty: AccessibilityScore = { score: 0, level: 'insuffisant', criteria: [] }
    return { before: empty, after: empty, delta: 0, recommendations: [], riss_refs: [] }
  }

  const criteria_before: AccessibilityCriterion[] = []
  const criteria_after: AccessibilityCriterion[] = []
  const notApplied: string[] = []

  for (const au of selected) {
    const riss_ref = au.riss_refs[0]?.id ?? ''

    // Critère AVANT = toujours 'fail' (le document original n'avait pas cet AU)
    criteria_before.push({
      id: au.id,
      label: au.label,
      riss_ref,
      status: 'fail',
      detail: `Non appliqué dans le document original`,
    })

    // Critère APRÈS = selon application effective
    let applied = false
    let detail = ''

    if (ALWAYS_APPLIED.has(au.id)) {
      applied = true
      detail = `Appliqué (modification typographique directe)`
    } else if (au.id === 'AU16') {
      applied = picto_words_found > 0
      detail = applied
        ? `${picto_words_found} pictogramme(s) Arasaac insérés`
        : `Aucun pictogramme trouvé dans Arasaac pour ce document`
    } else if (APPLIED_IF_REWRITTEN.has(au.id)) {
      applied = blocks_rewritten > 0
      detail = applied
        ? `Appliqué (${blocks_rewritten} bloc(s) adaptés par Claude)`
        : `Aucun contenu adapté — vérifier que des blocs correspondants existent`
    }

    criteria_after.push({
      id: au.id,
      label: au.label,
      riss_ref,
      status: applied ? 'ok' : 'warning',
      detail,
    })

    if (!applied) notApplied.push(`${au.id} — ${au.label} : ${detail}`)
  }

  // Scores normalisés sur 100
  const totalWeight = selected.reduce((s, au) => s + (AU_WEIGHTS[au.id] ?? 3), 0)
  const appliedWeight = criteria_after
    .filter(c => c.status === 'ok')
    .reduce((s, c) => s + (AU_WEIGHTS[c.id] ?? 3), 0)

  const norm = (pts: number) => Math.min(100, Math.round((pts / totalWeight) * 100))

  const beforeScore = 0
  const afterScore = norm(appliedWeight)
  const delta = afterScore - beforeScore

  const level = (s: number): AccessibilityScore['level'] =>
    s >= 85 ? 'excellent' : s >= 70 ? 'bon' : s >= 50 ? 'moyen' : 'insuffisant'

  // Références RISS uniques des AUs sélectionnés
  const riss_refs: RissRef[] = selected
    .flatMap(au => au.riss_refs.map(r => ({ ...r, criterion_applied: au.label })))
    .filter((r, i, arr) => arr.findIndex(x => x.id === r.id) === i)

  return {
    before: { score: beforeScore, level: level(beforeScore), criteria: criteria_before },
    after:  { score: afterScore,  level: level(afterScore),  criteria: criteria_after  },
    delta,
    recommendations: notApplied,
    riss_refs,
  }
}
