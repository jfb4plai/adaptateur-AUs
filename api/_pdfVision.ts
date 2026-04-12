/**
 * Claude Vision handler — analyse une page PDF (image PNG base64)
 * et retourne les blocs structurés avec les AUs appliquées.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { TextAdaptation } from '../src/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface PdfVisionRequest {
  pageBase64: string
  pageNumber: number
  activeAUs: string[]
  textAdaptation: TextAdaptation
  language: string
}

export async function handlePdfVision(body: PdfVisionRequest): Promise<string> {
  const { pageBase64, pageNumber, activeAUs, textAdaptation, language } = body

  const systemPrompt = buildVisionSystemPrompt(activeAUs, textAdaptation, language)

  const message = await client.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: pageBase64,
            },
          },
          {
            type: 'text',
            text: `Analyse cette page ${pageNumber} du document et retourne le JSON structuré demandé.`,
          },
        ],
      },
    ],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected Claude response type')
  return content.text
}

function buildVisionSystemPrompt(
  activeAUs: string[],
  textAdaptation: TextAdaptation,
  language: string
): string {
  return `Tu es un assistant spécialisé en adaptation pédagogique pour l'enseignement
en Fédération Wallonie-Bruxelles (FWB). Tu analyses des images de pages de documents.

LANGUE DU DOCUMENT : ${language}
PROFIL D'ADAPTATION : ${textAdaptation}
AMÉNAGEMENTS UNIVERSELS ACTIFS : ${activeAUs.join(', ')}

EXTRACTION VISUELLE — depuis l'image de la page :
- Lis tout le texte visible dans l'ordre de lecture naturel (haut→bas, gauche→droite)
- Identifie chaque bloc : titre, consigne, corps de texte, exercice
- Note la présence d'images/schémas : inclus-les comme bloc de type "body" avec [IMAGE: description courte]
- Conserve les tableaux sous forme textuelle simplifiée

RÈGLES ABSOLUES :
- Ne jamais inventer de contenu disciplinaire
- Ne jamais supprimer d'exercices, de questions ou de données
- Conserver toutes les données chiffrées, dates, noms propres

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
- Dans les valeurs textuelles, remplace tout guillemet " par une apostrophe '
- N'utilise jamais de guillemets doubles dans les valeurs des champs
- Les seuls guillemets doubles autorisés sont les délimiteurs de clés et valeurs JSON
- Remplace les tirets longs (—) par des tirets courts (-)

RETOURNE UNIQUEMENT ce JSON :
{
  "blocks": [
    {
      "id": "p${0}-b1",
      "type": "title|instruction|body|exercise",
      "original": "texte extrait de l'image",
      "transformed": "texte adapté selon les AUs",
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
