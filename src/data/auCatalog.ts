import type { AU, AUEnv } from '../types'

export const AU_CATALOG: AU[] = [
  // ── TYPOGRAPHIE ──────────────────────────────────────────────────────────
  {
    id: 'AU01', category: 'Typographie', label: 'Police Arial 12', icon: '🔤',
    description: 'Remplace toutes les polices par Arial 12pt',
    method: 'xml_direct',
    riss_refs: [
      { id: 'hal-03962468', title: 'L\'accessibilité numérique au service des étudiants dyslexiques', authors: 'Coffin, Goulet, Piquard-Kipffer', year: 2023, key_finding: 'Arial 12 sans empattement avec interligne augmenté améliore significativement l\'accès au sens pour les apprenants dyslexiques.' },
      { id: 'dumas-01302521', title: 'Influence de la typographie sur l\'aisance de lecture d\'une population d\'enfants dyslexiques', authors: 'Klein Virginia', year: 2010, key_finding: 'Un interligne légèrement supérieur à la hauteur de la police est recommandé pour améliorer la lisibilité chez les enfants dyslexiques.' },
      { id: 'hal-03198905', title: 'Recommandations pour des transformations de textes français afin d\'améliorer leur lisibilité et leur compréhension', authors: 'Gala, Todirascu, Javourey-Drevet et al.', year: 2020, key_finding: 'La police en italique nuit à la lisibilité ; les polices sans empattement sont recommandées pour les apprenants avec difficultés de lecture.' },
    ],
  },
  {
    id: 'AU02', category: 'Typographie', label: 'Interligne 1,5', icon: '↕️',
    description: 'Applique un interligne de 1,5 à tout le document',
    method: 'xml_direct',
    riss_refs: [
      { id: 'dumas-01302521', title: 'Influence de la typographie sur l\'aisance de lecture', authors: 'Klein Virginia', year: 2010, key_finding: 'Un interligne légèrement supérieur à la hauteur de la police est recommandé pour améliorer la lisibilité chez les enfants dyslexiques.' },
    ],
  },
  {
    id: 'AU03', category: 'Typographie', label: 'Alignement à gauche', icon: '⬅️',
    description: 'Supprime la justification, aligne tout à gauche',
    method: 'xml_direct',
    riss_refs: [
      { id: 'hal-03198905', title: 'Recommandations pour des transformations de textes français', authors: 'Gala et al.', year: 2020, key_finding: 'La justification crée des espaces irréguliers qui perturbent la lecture fluide des apprenants dyslexiques.' },
    ],
  },
  {
    id: 'AU04', category: 'Typographie', label: 'Titres mis en évidence', icon: '📌',
    description: 'Titres en gras, taille augmentée de 2pt',
    method: 'xml_direct',
    riss_refs: [],
  },
  {
    id: 'AU05', category: 'Typographie', label: 'Supprimer les soulignages', icon: '🚫',
    description: 'Retire tous les soulignages du texte courant',
    method: 'xml_direct',
    riss_refs: [
      { id: 'hal-03198905', title: 'Recommandations pour des transformations de textes français', authors: 'Gala et al.', year: 2020, key_finding: 'Le soulignage nuit à la reconnaissance des lettres et à la fluidité de lecture chez les apprenants avec dyslexie.' },
    ],
  },
  {
    id: 'AU06', category: 'Typographie', label: 'Réduire les distracteurs', icon: '🧹',
    description: 'Supprime les images décoratives et commentaires superflus',
    method: 'xml_direct',
    riss_refs: [],
  },

  // ── STRUCTURE ─────────────────────────────────────────────────────────────
  {
    id: 'AU07', category: 'Structure', label: 'Numéroter les pages', icon: '📄',
    description: 'Ajoute la numérotation de page en pied de page',
    method: 'xml_direct',
    riss_refs: [],
  },
  {
    id: 'AU08', category: 'Structure', label: 'Numéroter les exercices', icon: '🔢',
    description: 'Numérote chaque exercice dans l\'ordre',
    method: 'xml_direct',
    riss_refs: [],
  },
  {
    id: 'AU09', category: 'Structure', label: 'Consignes en premier', icon: '🔝',
    description: 'Déplace les consignes/questions en tête de document',
    method: 'structure_reorder',
    riss_refs: [],
  },
  {
    id: 'AU10', category: 'Structure', label: 'Éviter la scission de tâche', icon: '🔗',
    description: 'Signale (commentaire) les tâches scindées sur plusieurs pages',
    method: 'xml_direct',
    riss_refs: [],
  },
  {
    id: 'AU11', category: 'Structure', label: 'Résolution modèle', icon: '💡',
    description: 'Ajoute un encadré "Exemple de résolution" avant le premier exercice',
    method: 'claude_rewrite',
    riss_refs: [],
  },

  // ── CONSIGNES ────────────────────────────────────────────────────────────
  {
    id: 'AU12', category: 'Consignes', label: 'Verbe d\'action en gras', icon: '▶️',
    description: 'Identifie et met en gras le verbe d\'action en début de consigne',
    method: 'claude_rewrite',
    riss_refs: [
      { id: 'dumas-04041687', title: 'La compréhension de la consigne écrite chez les élèves turcophones', authors: 'Vela, Lentini', year: 2022, key_finding: 'La reformulation et l\'exemplification des consignes sont les stratégies les plus favorables à leur compréhension.' },
      { id: 'dumas-03274025', title: 'La question des consignes dans la mise en activité des élèves en classe de langue', authors: 'Chupin, Cornuaud', year: 2021, key_finding: 'La reformulation des consignes par les élèves eux-mêmes est un indicateur fiable de leur compréhension réelle.' },
    ],
  },
  {
    id: 'AU13', category: 'Consignes', label: 'Formulation Claire / Concise / Consistante', icon: '✏️',
    description: 'Reformule les consignes pour les rendre claires et courtes',
    method: 'claude_rewrite',
    riss_refs: [
      { id: 'dumas-01196970', title: 'Des obstacles à la passation des consignes', authors: 'Bennejean, Boutonnet', year: 2015, key_finding: 'La reformulation et l\'explicitation sont indissociables de la consigne pour en assurer la compréhension par tous les élèves.' },
    ],
  },
  {
    id: 'AU14', category: 'Consignes', label: 'Consignes en puces', icon: '•',
    description: 'Convertit les consignes en liste à puces (un verbe = une puce)',
    method: 'claude_rewrite',
    riss_refs: [
      { id: 'dumas-04041687', title: 'La compréhension de la consigne écrite', authors: 'Vela, Lentini', year: 2022, key_finding: 'La reformulation et l\'exemplification des consignes sont les stratégies les plus favorables à leur compréhension.' },
    ],
  },
  {
    id: 'AU15', category: 'Consignes', label: 'Contextualiser l\'objectif', icon: '🎯',
    description: 'Ajoute une phrase d\'objectif au début de chaque activité',
    method: 'claude_rewrite',
    riss_refs: [],
  },

  // ── PÉDAGOGIE ────────────────────────────────────────────────────────────
  {
    id: 'AU16', category: 'Pédagogie', label: 'Pictogrammes Arasaac', icon: '🖼️',
    description: 'Ajoute des pictogrammes Arasaac selon les options configurées',
    method: 'xml_direct',
    riss_refs: [
      { id: 'tel-04807443', title: 'Facile à Lire et à Comprendre (FALC) et école inclusive', authors: 'Balssa Floriane', year: 2024, key_finding: 'L\'association pictogrammes Arasaac + texte simplifié FALC améliore la compréhension des consignes pour tous les profils d\'apprenants en difficulté.' },
      { id: 'hal-03962468', title: 'L\'accessibilité numérique au service des étudiants dyslexiques', authors: 'Coffin, Goulet, Piquard-Kipffer', year: 2023, key_finding: 'La synthèse vocale couplée au maintien du texte sous les yeux réduit la fatigue et le temps de lecture chez les apprenants dyslexiques.' },
    ],
  },
  {
    id: 'AU17', category: 'Pédagogie', label: 'Progression simple → complexe', icon: '📈',
    description: 'Réorganise les exercices du plus simple au plus complexe',
    method: 'structure_reorder',
    riss_refs: [
      { id: 'dumas-04269704', title: 'Développement d\'un outil pédagogique vidéo pour l\'enseignement de l\'anatomie vétérinaire', authors: 'Sold Emma', year: 2023, key_finding: 'La taxonomie de Bloom structure efficacement la progression pédagogique ; le concept d\'étayage y est directement lié.' },
    ],
  },
  {
    id: 'AU18', category: 'Pédagogie', label: 'Exemples et contre-exemples', icon: '⚖️',
    description: 'Ajoute un encadré d\'exemples et contre-exemples avant les exercices',
    method: 'claude_rewrite',
    riss_refs: [],
  },
  {
    id: 'AU19', category: 'Pédagogie', label: 'Démonstration étape par étape', icon: '🪜',
    description: 'Reformate les procédures en étapes numérotées',
    method: 'claude_rewrite',
    riss_refs: [],
  },
  {
    id: 'AU20', category: 'Pédagogie', label: 'Validation intermédiaire', icon: '✅',
    description: 'Ajoute des points de vérification signalés visuellement',
    method: 'claude_rewrite',
    riss_refs: [],
  },
  {
    id: 'AU21', category: 'Pédagogie', label: 'Taxonomie de Bloom', icon: '🧠',
    description: 'Annote chaque tâche avec son niveau Bloom et réorganise si possible',
    method: 'claude_rewrite',
    riss_refs: [
      { id: 'dumas-04269704', title: 'Développement d\'un outil pédagogique vidéo', authors: 'Sold Emma', year: 2023, key_finding: 'La taxonomie de Bloom structure efficacement la progression pédagogique.' },
    ],
  },

  // ── ÉVALUATION ────────────────────────────────────────────────────────────
  {
    id: 'AU22', category: 'Évaluation', label: 'Support adéquat signalé', icon: '📋',
    description: 'Ajoute une note indiquant le support recommandé (quadrillage, lignes...)',
    method: 'claude_rewrite',
    riss_refs: [],
  },
  {
    id: 'AU23', category: 'Évaluation', label: 'Évaluation centrée compétence', icon: '🎓',
    description: 'Ajoute une en-tête précisant la compétence unique évaluée',
    method: 'claude_rewrite',
    riss_refs: [],
  },
  {
    id: 'AU24', category: 'Évaluation', label: 'Rétroaction positive', icon: '⭐',
    description: 'Ajoute des zones de feedback encourageant après chaque exercice',
    method: 'claude_rewrite',
    riss_refs: [],
  },

  // ── CODES COULEURS ────────────────────────────────────────────────────────
  {
    id: 'AU25', category: 'Codes couleurs', label: 'Universalisation des codes couleurs', icon: '🎨',
    description: 'Applique les codes couleurs définis par l\'établissement (configurable)',
    method: 'xml_direct',
    riss_refs: [],
  },

  // ── VERSION ACCESSIBLE ────────────────────────────────────────────────────
  {
    id: 'AU26', category: 'Version accessible', label: 'Version écrite de la consigne orale', icon: '🗣️',
    description: 'Ajoute en italique la transcription écrite des consignes données oralement',
    method: 'claude_rewrite',
    riss_refs: [
      { id: 'hal-03962468', title: 'L\'accessibilité numérique au service des étudiants dyslexiques', authors: 'Coffin, Goulet, Piquard-Kipffer', year: 2023, key_finding: 'La synthèse vocale couplée au maintien du texte sous les yeux réduit la fatigue et le temps de lecture.' },
    ],
  },
]

export const AU_ENV_CATALOG: AUEnv[] = [
  { id: 'AU-ENV01', label: 'Casques anti-bruit' },
  { id: 'AU-ENV02', label: 'Numabib TBI' },
  { id: 'AU-ENV03', label: 'Endroit d\'isolement' },
  { id: 'AU-ENV04', label: 'Planning semaine' },
  { id: 'AU-ENV05', label: 'Signalisation spatiale' },
  { id: 'AU-ENV06', label: 'Farde témoin' },
  { id: 'AU-ENV07', label: 'Journal de classe témoin' },
  { id: 'AU-ENV08', label: 'Calculatrice' },
  { id: 'AU-ENV09', label: 'Versions audio des livres' },
  { id: 'AU-ENV10', label: 'Cart\'aide attentionnel' },
  { id: 'AU-ENV11', label: 'Renforcement positif oral' },
  { id: 'AU-ENV12', label: 'Porte-manteaux adaptés' },
]

export const AU_CATEGORIES = [...new Set(AU_CATALOG.map(a => a.category))]
