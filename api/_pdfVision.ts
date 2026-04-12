/**
 * Claude Vision handler — analyse une page PDF (image PNG base64)
 * Pipeline 2 passes :
 *   Passe 1 — Extraction Sonnet Vision : lecture structurée de la page
 *   Passe 2 — Vérification Sonnet Text  : cohérence phonétique, structure, lacunes
 */

import Anthropic from '@anthropic-ai/sdk'
import type { TextAdaptation } from '../src/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Modèle : Sonnet 4 — Vision + précision sur structures complexes et écriture cursive
const MODEL = 'claude-sonnet-4-20250514'

interface PdfVisionRequest {
  pageBase64: string
  pageNumber: number
  activeAUs: string[]
  textAdaptation: TextAdaptation
  language: string
}

export async function handlePdfVision(body: PdfVisionRequest): Promise<string> {
  const { pageBase64, pageNumber, activeAUs, textAdaptation, language } = body

  // ── PASSE 1 : Extraction Vision ──────────────────────────────────────────
  const extractionResult = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: buildExtractionPrompt(activeAUs, textAdaptation, language, pageNumber),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: pageBase64 },
          },
          {
            type: 'text',
            text: `Extrais et structure le contenu de cette page ${pageNumber}. Retourne le JSON demandé.`,
          },
        ],
      },
    ],
  })

  const pass1Text = extractionResult.content[0]
  if (pass1Text.type !== 'text') throw new Error('Unexpected response type (pass 1)')

  // ── PASSE 2 : Vérification cohérence ─────────────────────────────────────
  const verificationResult = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: buildVerificationPrompt(language),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: pageBase64 },
          },
          {
            type: 'text',
            text: `Voici l'extraction JSON de la passe 1 pour cette page :

${pass1Text.text}

Vérifie et corrige ce JSON en comparant avec l'image. Retourne le JSON corrigé final.`,
          },
        ],
      },
    ],
  })

  const pass2Text = verificationResult.content[0]
  if (pass2Text.type !== 'text') throw new Error('Unexpected response type (pass 2)')
  return pass2Text.text
}

// ── PROMPT PASSE 1 : Extraction ──────────────────────────────────────────────
function buildExtractionPrompt(
  activeAUs: string[],
  textAdaptation: TextAdaptation,
  language: string,
  pageNumber: number
): string {
  return `Tu es un assistant spécialisé en adaptation pédagogique pour la Fédération Wallonie-Bruxelles (FWB).
Tu analyses des images de pages de documents pédagogiques scannés.

LANGUE DU DOCUMENT : ${language}
PROFIL D'ADAPTATION : ${textAdaptation}
AMÉNAGEMENTS UNIVERSELS ACTIFS : ${activeAUs.join(', ')}

── RÈGLES D'EXTRACTION VISUELLE ───────────────────────────────────────────────

LECTURE DU TEXTE :
- Lis chaque mot séparément et soigneusement — ne confonds pas les graphies proches
- Sons du français à distinguer impérativement (ne pas confondre) :
    eu (jeu, bleu) ≠ eur (heure, beurre) ≠ oeu/œu (œuf, cœur) ≠ ou (loup, roue)
    ill (fille, bille) ≠ il (fil) ≠ y (yeux)
    an/en ≠ on ≠ in/ain ≠ un
- Si un mot est ambigu, préfère la forme la plus courante en français

STRUCTURE ET MISE EN PAGE :
- Identifie et conserve la structure spatiale :
    • Listes en colonnes → représente-les avec une colonne par ligne, séparées par " | "
      Exemple : colonne eu | colonne eur | colonne oeu | colonne oeur
    • Tableaux → conserve les lignes et colonnes avec séparateur " | "
    • Exercices en colonnes → chaque item sur sa propre ligne
- Chaque bloc identifié a un type : title | instruction | body | exercise

LACUNES ET EXERCICES À COMPLÉTER :
- Les cases vides / tirets / pointillés dans les exercices → représente-les par "____"
- Les mots avec lettres manquantes (ex: s_l_il) → conserve exactement les lettres présentes et les "_" pour les manquantes
- Ne complète JAMAIS les lacunes toi-même — laisse "____"

IMAGES ET SCHÉMAS :
- Décris brièvement : [IMAGE: description courte en 5 mots max]

RÈGLES PAR AU ACTIF :
${activeAUs.includes('AU12') ? '- AU12 : identifie le verbe principal de chaque consigne dans "action_verb".' : ''}
${activeAUs.includes('AU13') ? '- AU13 : reformule les consignes longues/passives/ambiguës. Max 2 phrases.' : ''}
${activeAUs.includes('AU14') ? '- AU14 : si consigne multi-actions, retourne tableau dans "bullet_items".' : ''}
${activeAUs.includes('AU15') ? '- AU15 : génère une phrase d\'objectif dans "objective_sentence".' : ''}
${activeAUs.includes('AU18') ? '- AU18 : génère exemple dans "example" et contre-exemple dans "counter_example".' : ''}
${activeAUs.includes('AU19') ? '- AU19 : reformate les procédures en liste numérotée dans "steps".' : ''}
${activeAUs.includes('AU21') ? '- AU21 : niveau Bloom (1-6) dans "bloom_level".' : ''}
${activeAUs.includes('AU24') ? '- AU24 : phrase d\'encouragement dans "feedback_sentence".' : ''}

${textAdaptation !== 'none' ? `PROFIL ${textAdaptation} :
${textAdaptation === 'DYS' ? '- Évite les mots avec lettres miroir en début de consigne.' : ''}
${textAdaptation === 'TDAH' ? '- Maximum 1 action par phrase.' : ''}
${textAdaptation === 'FLE' ? '- Vocabulaire B1 max. Glose les termes techniques.' : ''}
${textAdaptation === 'FALC' ? '- Phrases ≤ 12 mots. 1 idée par phrase.' : ''}
${textAdaptation === 'HP' ? '- Maintien complexité. Vocabulaire précis.' : ''}` : ''}

PICTOGRAMMES : pour chaque bloc, "picto_words" = mots à pictogrammer (lemmatisés, sans article).

RÈGLES JSON CRITIQUES :
- Guillemets dans les valeurs textuelles → remplace par apostrophe '
- Tirets longs (—) → tirets courts (-)
- Les seuls guillemets " autorisés sont les délimiteurs JSON

RETOURNE UNIQUEMENT ce JSON (page ${pageNumber}) :
{
  "blocks": [
    {
      "id": "p${pageNumber}-b1",
      "type": "title|instruction|body|exercise",
      "original": "texte extrait fidèlement de l'image",
      "transformed": "texte adapté selon les AUs actifs",
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

// ── PROMPT PASSE 2 : Vérification et correction ──────────────────────────────
function buildVerificationPrompt(language: string): string {
  return `Tu es un correcteur expert en documents pédagogiques pour la Fédération Wallonie-Bruxelles (FWB).
Tu reçois une image de page ET le JSON extrait en passe 1. Tu dois vérifier et corriger.

LANGUE : ${language}

── CE QUE TU DOIS VÉRIFIER ────────────────────────────────────────────────────

1. COHÉRENCE PHONÉTIQUE (critique pour les feuilles d'exercices) :
   - Vérifie chaque son transcrit en comparant avec l'image pixel par pixel
   - Sons à vérifier impérativement :
       eu (jeu, bleu, peu) ← e+u visible
       eur (heure, beurre, fleur) ← e+u+r visible
       oeu/œu (œuf, cœur, sœur) ← o+e+u ou œ visible
       ou (loup, roue) ← o+u visible
       ill (fille, bille, gorille) ← i+l+l visible
   - Si le son extrait en passe 1 est différent de ce que tu vois dans l'image → corrige

2. STRUCTURE ET COLONNES :
   - Si l'image montre un tableau ou des colonnes → vérifie que la structure est préservée
   - Si des items sont sur une même ligne alors qu'ils devraient être en colonne → corrige
   - Format colonnes : chaque item sur sa ligne, colonnes séparées par " | "

3. LACUNES ET EXERCICES À COMPLÉTER :
   - Vérifie que toutes les cases vides / pointillés sont bien représentés par "____"
   - Vérifie que les mots partiels (avec lettres manquantes) sont fidèlement retranscrits
   - Si la passe 1 a complété des lacunes → remets les "____"

4. LECTURE DE MOTS :
   - Vérifie les mots qui semblent incorrects (erreurs de lecture de l'écriture cursive)
   - Concentre-toi sur les verbes des consignes (Lis, Écris, Complète, Entoure, etc.)

5. JSON :
   - Vérifie que le JSON est valide
   - Guillemets dans les valeurs → apostrophes '
   - Lacunes préservées comme "____"

RETOURNE UNIQUEMENT le JSON corrigé complet (même structure que la passe 1).
Si la passe 1 était correcte, retourne-la telle quelle.`
}
