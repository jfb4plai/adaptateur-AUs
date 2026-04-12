// ─── AU CATALOG TYPES ───────────────────────────────────────────────────────

export type AUMethod = 'xml_direct' | 'claude_rewrite' | 'structure_reorder'

export interface RissRef {
  id: string
  title: string
  authors: string
  year: number
  key_finding: string
}

export interface AU {
  id: string
  category: string
  label: string
  description: string
  method: AUMethod
  icon: string
  riss_refs: RissRef[]
}

export interface AUEnv {
  id: string
  label: string
}

// ─── PICTO OPTIONS ──────────────────────────────────────────────────────────

export type PictoDensity = 'none' | 'all_nouns' | 'all_verbs' | 'nouns_verbs' | 'custom'
export type PictoPosition = 'above' | 'below' | 'inline_right'

export interface PictoAudio {
  enabled: boolean
  engine: 'browser_tts' | 'arasaac_audio'
  voice_language: 'fr-FR' | 'nl-BE' | 'en-GB'
}

export interface PictoOptions {
  density: PictoDensity
  custom_words?: string[]
  position: PictoPosition
  color: boolean
  background_color: string
  border: boolean
  border_color?: string
  show_label: boolean
  label_position: 'below' | 'above'
  label_color?: string
  size_ratio: number
  show_tense_marker: boolean
  show_plural_marker: boolean
  audio: PictoAudio
  fallback: 'silent' | 'highlight'
}

export const DEFAULT_PICTO_OPTIONS: PictoOptions = {
  density: 'nouns_verbs',
  position: 'above',
  color: true,
  background_color: 'transparent',
  border: false,
  show_label: true,
  label_position: 'below',
  size_ratio: 2,
  show_tense_marker: false,
  show_plural_marker: false,
  audio: {
    enabled: false,
    engine: 'browser_tts',
    voice_language: 'fr-FR',
  },
  fallback: 'silent',
}

// ─── TEXT ADAPTATION ────────────────────────────────────────────────────────

export type TextAdaptation = 'none' | 'DYS' | 'TDAH' | 'HP' | 'FLE' | 'FALC'

export const TEXT_ADAPTATION_LABELS: Record<TextAdaptation, { label: string; desc: string }> = {
  none:  { label: 'Aucune', desc: 'Pas d\'adaptation textuelle' },
  DYS:   { label: 'DYS', desc: 'Police, espacement, découpage syllabique optionnel' },
  TDAH:  { label: 'TDAH', desc: 'Consignes ultra-courtes, séquençage renforcé' },
  HP:    { label: 'HP', desc: 'Complexité maintenue, enrichissement lexical' },
  FLE:   { label: 'FLE', desc: 'Syntaxe simple, vocabulaire B1' },
  FALC:  { label: 'FALC', desc: '31 règles FALC : ≤12 mots/phrase, vocabulaire courant' },
}

// ─── SUPABASE MODELS ─────────────────────────────────────────────────────────

export interface Teacher {
  id: string
  email: string
  display_name: string | null
  school_name: string | null
  language: 'fr' | 'nl' | 'en'
  created_at: string
}

export interface AUProfile {
  id: string
  teacher_id: string
  name: string
  is_school_wide: boolean
  au_selections: string[]       // array of AU IDs
  picto_options: PictoOptions
  text_adaptation: TextAdaptation
  language: 'fr' | 'nl' | 'en'
  created_at: string
  updated_at: string
}

export type ConversionStatus = 'pending' | 'processing' | 'done' | 'error'

export interface AccessibilityCriterion {
  id: string
  label: string
  status: 'ok' | 'warning' | 'fail'
  detail: string
}

export interface AccessibilityResult {
  score: number
  level: 'excellent' | 'bon' | 'moyen' | 'insuffisant'
  criteria: AccessibilityCriterion[]
  recommendations: string[]
}

export interface ConversionReport {
  aus_applied: string[]
  aus_not_applicable: string[]
  picto_words_found: number
  picto_words_not_found: string[]
  blocks_rewritten: number
  warnings: string[]
  // Corrections passe 2 Vision (PDF uniquement)
  pass2_corrections?: string[]
  uncertain_chars?: string[]
  // Passe 3 : vérification accessibilité
  accessibility?: AccessibilityResult
}

export interface Conversion {
  id: string
  teacher_id: string
  au_profile_id: string
  original_filename: string
  original_storage_path: string | null
  converted_storage_path: string | null
  status: ConversionStatus
  report: ConversionReport | null
  created_at: string
}

// ─── APP STATE ───────────────────────────────────────────────────────────────

export type AppScreen = 'login' | 'profiles' | 'convert' | 'report'

export interface ConversionStep {
  id: string
  label: string
  status: 'idle' | 'running' | 'done' | 'error'
}
