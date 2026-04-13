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
    max_tokens: 5000,
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
            text: 'Analyse ce document puis transcris-le selon les règles.',
          },
        ],
      },
    ],
  })

  const text = result.content[0]
  if (text.type !== 'text') throw new Error('Unexpected response type (transcribe)')

  // Extraire uniquement la partie TRANSCRIPTION (après le séparateur)
  const raw = text.text
  const sep = raw.indexOf('---TRANSCRIPTION---')
  return sep >= 0 ? raw.slice(sep + '---TRANSCRIPTION---'.length).trim() : raw
}

const TRANSCRIPTION_PROMPT = `Tu transcris un document pédagogique pour des enseignants de la Fédération Wallonie-Bruxelles.

Ta réponse comporte DEUX parties séparées par ---TRANSCRIPTION--- :

════════════════════════════════════
PARTIE 1 — ANALYSE PÉDAGOGIQUE
════════════════════════════════════

Avant de transcrire, résous mentalement le document :

A. THÈME : Quel phonème, règle grammaticale ou notion est enseigné ?
   Ex : "phonème -ill", "accord sujet-verbe", "vocabulaire des animaux"

B. RÉSOLUTION DES EXERCICES : Pour chaque exercice, liste les réponses attendues.
   Ex : Exercice 1 — bille, fille, brille, chenille, jonquille, aiguille
   Ce n'est pas une correction : tu identifies ce que les élèves doivent écrire.

C. ILLUSTRATIONS ATTENDUES : En tenant compte du thème, liste les images probables.
   Ex : "-ill" → jonquille (fleur), chenille (insecte), aiguille (couture)...
   Ce prior sémantique te permet d'identifier les images avec beaucoup plus de certitude.

---TRANSCRIPTION---

════════════════════════════════════
PARTIE 2 — TRANSCRIPTION MARKDOWN
════════════════════════════════════

Reproduis le contenu EXACTEMENT tel qu'il apparaît.
Utilise l'analyse ci-dessus pour : identifier les illustrations avec confiance,
lire les mots partiels flous, et ne pas confondre lettres imprimées et blancs.

RÈGLES DE FORMAT (obligatoires)
────────────────────────────────

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
   Grâce à l'analyse du thème (Partie 1), tu peux identifier avec confiance.
   → Objet identifié (même avec légère incertitude visuelle) → [IMG: mot_précis]
   → Vraiment impossible à identifier même avec le contexte → NE RIEN ÉCRIRE
   Ex : si thème = "-ill" et image = fleur jaune → [IMG: jonquille] (confiance élevée)

6. LISTES DE MOTS
   Conserver sur lignes séparées précédées de »

7. CHOIX MULTIPLES
   Conserver la forme exacte : (mot1 / mot2)

8. SAUTS DE PAGE
   Chaque changement de page → ligne seule :
   --- SAUT DE PAGE ---
   Ne jamais fusionner deux pages.

9. SÉPARATION ENTRE EXERCICES
   Ligne vide avant chaque ## Exercice

INTERDICTIONS ABSOLUES
────────────────────────────────
✗ Ne jamais reformuler ni "améliorer" le texte
✗ Ne jamais compléter les blancs ___
✗ Ne jamais corriger les fautes apparentes (transcription fidèle)
✗ Ne jamais ajouter d'explications`
