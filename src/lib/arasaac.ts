/**
 * Arasaac API wrapper
 * Docs: https://arasaac.org/developers/api
 * Licence: CC BY-NC-SA — https://arasaac.org
 */

const BASE = 'https://api.arasaac.org/v1'

export interface ArasaacResult {
  _id: number
  keywords: Array<{ keyword: string }>
}

/** Cherche le premier picto correspondant à un mot */
export async function searchPicto(
  word: string,
  lang = 'fr'
): Promise<number | null> {
  try {
    const res = await fetch(`${BASE}/pictograms/${lang}/search/${encodeURIComponent(word)}`)
    if (!res.ok) return null
    const data: ArasaacResult[] = await res.json()
    return data?.[0]?._id ?? null
  } catch {
    return null
  }
}

/** Construit l'URL de l'image d'un picto avec options */
export function buildPictoUrl(
  id: number,
  opts: {
    color?: boolean
    backgroundColor?: string
    border?: boolean
    borderColor?: string
    plural?: boolean
    tense?: boolean
  } = {}
): string {
  const params = new URLSearchParams()
  if (opts.color === false) params.set('color', 'false')
  if (opts.backgroundColor && opts.backgroundColor !== 'transparent') {
    // Arasaac attend une couleur hex sans #
    params.set('backgroundColor', opts.backgroundColor.replace('#', ''))
  }
  if (opts.border) params.set('border', 'true')
  const qs = params.toString()
  return `${BASE}/pictograms/${id}${qs ? '?' + qs : ''}`
}

/** Recherche en batch et retourne Map<mot, id_picto> */
export async function fetchPictosBatch(
  words: string[],
  lang = 'fr'
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  await Promise.all(
    words.map(async (word) => {
      const id = await searchPicto(word, lang)
      if (id !== null) map.set(word, id)
    })
  )
  return map
}
