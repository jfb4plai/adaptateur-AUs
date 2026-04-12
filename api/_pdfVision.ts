/**
 * Claude Vision handler — analyse une page PDF (image PNG base64)
 * Pipeline 2 passes :
 *   Passe 1 — Transcription lettre par lettre (lecture stricte, aucune invention)
 *   Passe 2 — Audit caractère par caractère avec liste de corrections visibles
 */

import Anthropic from '@anthropic-ai/sdk'
import type { TextAdaptation } from '../src/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Sonnet 4 — meilleure Vision disponible, nécessaire pour police cursive scolaire
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

  // ── PASSE 1 : Transcription stricte ──────────────────────────────────────
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
            text: `PASSE 1 — Transcription stricte de la page ${pageNumber}.
Lis chaque caractère visible INDIVIDUELLEMENT. Retourne le JSON demandé.
RAPPEL : le champ "original" = copie EXACTE de ce qui est imprimé, lettre par lettre, sans rien ajouter ni modifier.`,
          },
        ],
      },
    ],
  })

  const pass1Text = extractionResult.content[0]
  if (pass1Text.type !== 'text') throw new Error('Unexpected response type (pass 1)')

  // ── PASSE 2 : Audit caractère par caractère ───────────────────────────────
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
            text: `PASSE 2 — Audit caractère par caractère.

JSON de la passe 1 :
${pass1Text.text}

Pour chaque bloc, relis le champ "original" lettre par lettre en comparant avec l'image.
Liste toutes les corrections dans "pass2_corrections" et tous les caractères encore incertains dans "uncertain_chars".
Retourne le JSON corrigé complet.`,
          },
        ],
      },
    ],
  })

  const pass2Text = verificationResult.content[0]
  if (pass2Text.type !== 'text') throw new Error('Unexpected response type (pass 2)')
  return pass2Text.text
}

// ── PROMPT PASSE 1 : Transcription stricte ───────────────────────────────────
function buildExtractionPrompt(
  activeAUs: string[],
  textAdaptation: TextAdaptation,
  language: string,
  pageNumber: number
): string {
  return `Tu es un transcripteur expert de documents pédagogiques scannés pour la Fédération Wallonie-Bruxelles (FWB).
Ta PREMIÈRE mission est de transcrire EXACTEMENT ce qui est imprimé — avant toute adaptation.

LANGUE DU DOCUMENT : ${language}
PROFIL D'ADAPTATION : ${textAdaptation}
AMÉNAGEMENTS UNIVERSELS ACTIFS : ${activeAUs.join(', ')}

════════════════════════════════════════════════════════════
  RÈGLE ABSOLUE N°1 — TRANSCRIPTION EXACTE
════════════════════════════════════════════════════════════

Le champ "original" doit être la COPIE CONFORME lettre par lettre de ce qui est imprimé.
→ N'AJOUTE JAMAIS un mot, une lettre, une syllabe absente de l'image.
→ N'INTERPRÈTE JAMAIS ce qui "devrait" être là — transcris ce que tu VOIS.
→ Si un caractère est illisible ou ambigu → écris [?] à sa place.
→ JAMAIS de complétion des lacunes (____) — laisse exactement "____".

════════════════════════════════════════════════════════════
  RÈGLE ABSOLUE N°2 — POLICE CURSIVE SCOLAIRE BELGE
════════════════════════════════════════════════════════════

Ce document utilise la POLICE CURSIVE SCOLAIRE belge (écriture attachée imprimée).
Les confusions suivantes sont FRÉQUENTES — vérifie CHAQUE lettre :

CONFUSIONS CRITIQUES (erreurs connues à éviter) :
  ✗ "c" ≠ "o" ≠ "on"  → c est OUVERT à droite, 1 seule lettre
  ✗ "b" ≠ "bam" ≠ "ba" → b est 1 seule lettre (jambe + boucle), ne lis JAMAIS plus d'une lettre
  ✗ "vi" ≠ "r"         → vi = DEUX lettres distinctes (v puis i)
  ✗ "bl" ≠ "ll"        → le b a une boucle FERMÉE en bas, le l est droit
  ✗ "doct" ≠ "dét"     → compte les lettres : d-o-c-t = 4 lettres
  ✗ ne perds JAMAIS les lettres finales : d final (nœud), x final (vieux), t final, s final

MÉTHODE DE LECTURE OBLIGATOIRE pour chaque mot imprimé :
  1. Compte le nombre de jambages/boucles visibles
  2. Identifie chaque lettre individuellement (de gauche à droite)
  3. Vérifie que ton nombre de lettres transcrites = nombre de lettres visibles
  4. Si doute → [?]

════════════════════════════════════════════════════════════
  STRUCTURE ET MISE EN PAGE
════════════════════════════════════════════════════════════

TYPES DE BLOCS : title | instruction | body | exercise

EXERCICES (type = "exercise") — RÈGLE FONDAMENTALE D'ACCESSIBILITÉ :
→ Chaque item d'exercice = UNE LIGNE SÉPARÉE, jamais en ligne avec " | "
→ Format : une entrée par ligne, sans séparateur

  CORRECT :
    un jeu
    jeudi
    un peu
    ma sœur

  INCORRECT (jamais ça) :
    un jeu | jeudi | un peu | ma sœur

Tableaux (type = "body") : colonnes séparées par " | " sont autorisées seulement pour les tableaux structurés avec en-têtes.

LACUNES ET BLANCS À COMPLÉTER :
- Remplacement de toutes les cases vides / tirets / pointillés → " ___ " (3 underscores encadrés d'espaces)
- Mots partiels (lettres imprimées + blanc) : transcris EXACTEMENT les lettres visibles + " ___ "
  Exemple : "un b ___  f" → le b ET le f sont imprimés, le blanc entre = " ___ "
- Longueur du blanc : toujours " ___ " (3 underscores) — jamais plus, jamais moins
  Cela évite la confusion visuelle des longs traits avec des lettres (ex : l, i)
- Ne COMPLÈTE JAMAIS une lacune

IMAGES : [IMAGE: description 5 mots max]

════════════════════════════════════════════════════════════
  RÈGLES PAR AU ACTIF (s'appliquent au champ "transformed" uniquement)
════════════════════════════════════════════════════════════
${activeAUs.includes('AU12') ? '- AU12 : verbe principal de chaque consigne dans "action_verb".' : ''}
${activeAUs.includes('AU13') ? '- AU13 : reformule les consignes dans "transformed". Max 2 phrases.' : ''}
${activeAUs.includes('AU14') ? '- AU14 : consigne multi-actions → "bullet_items" (infinitifs).' : ''}
${activeAUs.includes('AU15') ? '- AU15 : phrase d\'objectif dans "objective_sentence".' : ''}
${activeAUs.includes('AU18') ? '- AU18 : exemple dans "example", contre-exemple dans "counter_example".' : ''}
${activeAUs.includes('AU19') ? '- AU19 : procédures → liste numérotée dans "steps".' : ''}
${activeAUs.includes('AU21') ? '- AU21 : niveau Bloom (1-6) dans "bloom_level".' : ''}
${activeAUs.includes('AU24') ? '- AU24 : phrase d\'encouragement dans "feedback_sentence".' : ''}

${textAdaptation !== 'none' ? `PROFIL ${textAdaptation} (champ "transformed" uniquement) :
${textAdaptation === 'DYS' ? '- Évite les mots avec lettres miroir en début de consigne.' : ''}
${textAdaptation === 'TDAH' ? '- Maximum 1 action par phrase.' : ''}
${textAdaptation === 'FLE' ? '- Vocabulaire B1 max. Glose les termes techniques.' : ''}
${textAdaptation === 'FALC' ? '- Phrases ≤ 12 mots. 1 idée par phrase.' : ''}
${textAdaptation === 'HP' ? '- Maintien complexité. Vocabulaire précis.' : ''}` : ''}

PICTOGRAMMES : "picto_words" = mots à pictogrammer (lemmatisés, sans article).

RÈGLES JSON :
- Guillemets dans les valeurs → apostrophe '
- Tirets longs (—) → tirets courts (-)
- Les seuls " autorisés sont les délimiteurs JSON

RETOURNE UNIQUEMENT ce JSON (page ${pageNumber}) :
{
  "blocks": [
    {
      "id": "p${pageNumber}-b1",
      "type": "title|instruction|body|exercise",
      "original": "transcription EXACTE lettre par lettre — [?] si ambigu",
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

// ── PROMPT PASSE 2 : Audit caractère par caractère ───────────────────────────
function buildVerificationPrompt(language: string): string {
  return `Tu es un auditeur expert de transcriptions de documents scolaires belges (FWB).
Tu reçois l'image ET le JSON de la passe 1. Ta mission : audit caractère par caractère, corrections traçables.

LANGUE : ${language}

════════════════════════════════════════════════════════════
  MÉTHODE D'AUDIT OBLIGATOIRE
════════════════════════════════════════════════════════════

Pour CHAQUE bloc, pour le champ "original" :

ÉTAPE 1 — COMPTAGE :
  → Compte les lettres/caractères visibles dans l'image pour ce bloc
  → Compare avec le nombre de caractères transcrits en passe 1
  → Si différence → corrige

ÉTAPE 2 — LETTRE PAR LETTRE :
  → Relis chaque caractère transcrit en le localisant dans l'image
  → Vérifie sa forme (boucle, jambage, hauteur, ouverture)

ÉTAPE 3 — VÉRIFICATIONS CIBLÉES (confusions connues de la police cursive scolaire belge) :
  ✓ Chaque "c" → est-il vraiment un c (ouvert à droite) ? Pas un o, pas "on" ?
  ✓ Chaque "b" seul → est-il vraiment seul ? Pas "bam", pas "ba", pas "bl" ?
  ✓ Séquences "vi" → sont-elles bien v+i et non r ?
  ✓ Séquences "bl" → le premier caractère est-il bien b (boucle) et non l ?
  ✓ Séquences "doct", "nœud", "pneu", "vieux" → tous les caractères sont-ils présents ?
  ✓ Lettres finales → aucune lettre finale muette ne manque (d, x, t, s) ?

ÉTAPE 4 — CONSIGNES / TITRES :
  ✓ Le texte d'une consigne ou d'un titre est-il EXACTEMENT ce qui est imprimé ?
  ✓ Aucun mot inventé, aucune reformulation dans "original" ?

════════════════════════════════════════════════════════════
  RAPPORT DES CORRECTIONS (obligatoire)
════════════════════════════════════════════════════════════

Dans le JSON final, ajoute ces deux champs au niveau racine :

"pass2_corrections": [
  "bloc p1-b2 : 'bam' → 'b' (b seul visible, pas bam)",
  "bloc p1-b3 : 'r' → 'vi' (deux lettres distinctes visibles)",
  ...
],
"uncertain_chars": [
  "bloc p1-b4 : 3e caractère de 'original' incertain [?]",
  ...
]

Si aucune correction → "pass2_corrections": [], "uncertain_chars": []

════════════════════════════════════════════════════════════
  RÈGLES ABSOLUES
════════════════════════════════════════════════════════════
- Ne complète JAMAIS les lacunes (____) — elles restent "____"
- Ne reformule JAMAIS le champ "original" — seulement corriger les erreurs de lecture
- "transformed" peut rester tel quel si la correction ne l'affecte pas
- JSON valide : guillemets dans valeurs → apostrophes ', contrôles → échappés

RETOURNE UNIQUEMENT le JSON corrigé complet (même structure que passe 1 + pass2_corrections + uncertain_chars).`
}
