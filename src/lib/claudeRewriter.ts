/**
 * Claude Rewriter — appel API via proxy Supabase Edge Function
 * (la clé Anthropic ne doit jamais être exposée côté client)
 *
 * En développement local, peut pointer vers une Edge Function locale ou
 * un endpoint Express minimal.
 */

import type { TextAdaptation } from '../types'

export interface DocumentBlock {
  id: string
  type: 'title' | 'instruction' | 'body' | 'exercise'
  text: string
}

export interface RewrittenBlock {
  id: string
  type: string
  original: string
  transformed: string
  action_verb: string | null
  bullet_items: string[] | null
  objective_sentence: string | null
  example: string | null
  counter_example: string | null
  steps: string[] | null
  bloom_level: number | null
  recommended_support: string | null
  feedback_sentence: string | null
  written_version: string | null
  checkpoints: number[] | null
  picto_words: string[]
}

export interface RewriteResult {
  blocks: RewrittenBlock[]
  structure_hints: {
    reorder_instructions_first: boolean
    complexity_order: string[]
  }
}

export async function rewriteWithClaude(
  blocks: DocumentBlock[],
  activeAUs: string[],
  textAdaptation: TextAdaptation,
  language: string
): Promise<RewriteResult> {
  const response = await fetch('/api/rewrite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks, activeAUs, textAdaptation, language }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Claude API error: ${err}`)
  }

  return response.json()
}
