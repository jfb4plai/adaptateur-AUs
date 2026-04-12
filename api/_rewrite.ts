/**
 * API endpoint : POST /api/rewrite
 * Proxy sécurisé vers l'API Anthropic — la clé n'est jamais exposée côté client.
 *
 * En dev : lancé par `vite-node api/server.ts`
 * En prod Vercel : Vercel Serverless Function (Edge ou Node)
 */

import Anthropic from '@anthropic-ai/sdk'
import type { TextAdaptation } from '../src/types'
import type { DocumentBlock } from '../src/lib/claudeRewriter'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface RewriteRequest {
  blocks: DocumentBlock[]
  activeAUs: string[]
  textAdaptation: TextAdaptation
  language: string
}

export async function handleRewrite(body: RewriteRequest): Promise<string> {
  const { blocks, activeAUs, textAdaptation, language } = body

  const systemPrompt = buildSystemPrompt(activeAUs, textAdaptation, language)

  const message = await client.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 8192,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: JSON.stringify({ blocks }),
      },
    ],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected Claude response type')
  return content.text
}

function buildSystemPrompt(activeAUs: string[], textAdaptation: TextAdaptation, language: string): string {
  const ausList = activeAUs.join(', ')

  return `Tu es un assistant spécialisé en adaptation pédagogique pour l'enseignement
en Fédération Wallonie-Bruxelles (FWB).

LANGUE DU DOCUMENT : ${language}
PROFIL D'ADAPTATION : ${textAdaptation}
AMÉNAGEMENTS UNIVERSELS ACTIFS : ${ausList}

Tu reçois un document structuré en blocs JSON.
Chaque bloc a un type : 'title' | 'instruction' | 'body' | 'exercise'

RÈGLES ABSOLUES :
- Ne jamais inventer de contenu disciplinaire
- Ne jamais supprimer d'exercices, de questions ou de données
- Conserver la structure globale : même ordre, même nombre de blocs
- Reformuler uniquement — ne pas résumer, ne pas raccourcir abusivement
- Conserver les données chiffrées, dates, noms propres à l'identique

RÈGLES PAR AU ACTIF :
${activeAUs.includes('AU12') ? '- AU12 : identifie le verbe principal de chaque consigne. Retourne-le dans "action_verb".' : ''}
${activeAUs.includes('AU13') ? '- AU13 : reformule les consignes longues/passives/ambiguës. Max 2 phrases.' : ''}
${activeAUs.includes('AU14') ? '- AU14 : si consigne multi-actions, retourne tableau dans "bullet_items". Chaque item commence par un infinitif.' : ''}
${activeAUs.includes('AU15') ? '- AU15 : génère une phrase d\'objectif courte dans "objective_sentence".' : ''}
${activeAUs.includes('AU18') ? '- AU18 : génère 1 exemple dans "example" et 1 contre-exemple dans "counter_example".' : ''}
${activeAUs.includes('AU19') ? '- AU19 : reformate les procédures en liste numérotée dans "steps".' : ''}
${activeAUs.includes('AU21') ? '- AU21 : identifie le niveau Bloom (1-6) de chaque bloc exercice dans "bloom_level".' : ''}
${activeAUs.includes('AU22') ? '- AU22 : retourne le support recommandé dans "recommended_support" : quadrille|lignes|vierge|autre.' : ''}
${activeAUs.includes('AU24') ? '- AU24 : génère une phrase d\'encouragement dans "feedback_sentence" pour les exercices.' : ''}
${activeAUs.includes('AU26') ? '- AU26 : si consignes orales signalées [ORAL], génère leur version écrite dans "written_version".' : ''}

${textAdaptation !== 'none' ? `PROFIL D'ADAPTATION ${textAdaptation} :
${textAdaptation === 'DYS' ? '- Évite les mots avec lettres miroir (b/d/p/q) en début de consigne.' : ''}
${textAdaptation === 'TDAH' ? '- Maximum 1 action par phrase. Ajoute [PAUSE] entre les étapes longues.' : ''}
${textAdaptation === 'FLE' ? '- Vocabulaire B1 max. Glose les termes techniques entre parenthèses.' : ''}
${textAdaptation === 'FALC' ? '- Phrases ≤ 12 mots. 1 idée par phrase. Mots courants uniquement. Pas de métaphores.' : ''}
${textAdaptation === 'HP' ? '- Maintien de la complexité. Ajout de nuances et de vocabulaire précis.' : ''}` : ''}

PICTOGRAMMES — pour chaque bloc retourne "picto_words" : tableau des mots à pictogrammer
(noms communs et/ou verbes selon options de densité). Formes lemmatisées, sans article.

RETOURNE UNIQUEMENT ce JSON (aucun texte autour) :
{
  "blocks": [
    {
      "id": "string",
      "type": "title|instruction|body|exercise",
      "original": "string",
      "transformed": "string",
      "action_verb": "string|null",
      "bullet_items": ["string"]|null,
      "objective_sentence": "string|null",
      "example": "string|null",
      "counter_example": "string|null",
      "steps": ["string"]|null,
      "bloom_level": 1|2|3|4|5|6|null,
      "recommended_support": "string|null",
      "feedback_sentence": "string|null",
      "written_version": "string|null",
      "checkpoints": [number]|null,
      "picto_words": ["string"]
    }
  ],
  "structure_hints": {
    "reorder_instructions_first": boolean,
    "complexity_order": ["block_id"]
  }
}`
}
