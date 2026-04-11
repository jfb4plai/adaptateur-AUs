import { useApp } from '../store/AppContext'
import { AU_CATALOG, AU_ENV_CATALOG } from '../data/auCatalog'

export default function ReportScreen() {
  const { state, dispatch } = useApp()
  const report = state.report

  if (!report) {
    dispatch({ type: 'SET_SCREEN', screen: 'convert' })
    return null
  }

  const appliedAUs = AU_CATALOG.filter(a => report.aus_applied.includes(a.id))
  const envAUs = AU_ENV_CATALOG

  // Collecter toutes les refs RISS uniques pour les AUs appliquées
  const rissRefs = appliedAUs.flatMap(a => a.riss_refs)
  const uniqueRefs = rissRefs.filter((r, i, arr) => arr.findIndex(x => x.id === r.id) === i)

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* En-tête */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-800">📊 Rapport de conversion</h1>
          <button
            onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'convert' })}
            className="text-sm text-slate-500 hover:text-slate-700 border border-slate-300 rounded-lg px-3 py-1.5"
          >
            ← Retour
          </button>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'AUs appliquées', value: report.aus_applied.length, color: 'text-emerald-700 bg-emerald-50' },
            { label: 'Blocs réécrits', value: report.blocks_rewritten, color: 'text-blue-700 bg-blue-50' },
            { label: 'Pictos trouvés', value: report.picto_words_found, color: 'text-purple-700 bg-purple-50' },
            { label: 'Avertissements', value: report.warnings.length, color: 'text-amber-700 bg-amber-50' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl p-4 text-center ${s.color}`}>
              <div className="text-3xl font-bold">{s.value}</div>
              <div className="text-xs mt-1 font-medium">{s.label}</div>
            </div>
          ))}
        </div>

        {/* AUs appliquées */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-800 mb-4">✅ Aménagements appliqués</h2>
          <div className="space-y-2">
            {appliedAUs.map(au => (
              <div key={au.id} className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
                <span className="text-xl">{au.icon}</span>
                <div>
                  <span className="font-medium text-sm text-slate-800">{au.id} — {au.label}</span>
                  <p className="text-xs text-slate-500">{au.description}</p>
                </div>
              </div>
            ))}
            {appliedAUs.length === 0 && (
              <p className="text-sm text-slate-400">Aucun AU appliqué.</p>
            )}
          </div>
        </div>

        {/* AUs environnement */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-800 mb-4">ℹ️ AUs d'environnement — non applicables au document</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {envAUs.map(au => (
              <div key={au.id} className="text-xs text-slate-500 flex items-center gap-1.5">
                <span className="text-slate-400">○</span>
                {au.label}
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Ces aménagements concernent l'environnement physique de la classe et ne peuvent pas être intégrés dans un document.
          </p>
        </div>

        {/* Pictogrammes manquants */}
        {report.picto_words_not_found.length > 0 && (
          <div className="bg-white rounded-2xl border border-amber-200 p-5">
            <h2 className="font-semibold text-amber-800 mb-3">⚠️ Mots sans pictogramme Arasaac</h2>
            <div className="flex flex-wrap gap-2">
              {report.picto_words_not_found.map(w => (
                <span key={w} className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-full">
                  {w}
                </span>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-3">
              Ces termes (souvent disciplinaires) ne figurent pas dans la base Arasaac.
              Vous pouvez les ajouter manuellement dans le DOCX.
            </p>
          </div>
        )}

        {/* Avertissements */}
        {report.warnings.length > 0 && (
          <div className="bg-white rounded-2xl border border-red-200 p-5">
            <h2 className="font-semibold text-red-800 mb-3">🚨 Avertissements</h2>
            <ul className="space-y-1">
              {report.warnings.map((w, i) => (
                <li key={i} className="text-sm text-red-700 flex items-start gap-2">
                  <span>•</span> {w}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Section RISS */}
        {uniqueRefs.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-800 mb-2">📚 Fondements scientifiques (RISS)</h2>
            <p className="text-xs text-slate-500 mb-4">
              Les aménagements appliqués dans ce document s'appuient sur les travaux suivants,
              issus du corpus RISS (522 000+ articles scientifiques francophones).
            </p>
            <div className="space-y-3">
              {uniqueRefs.map(ref => (
                <div key={ref.id} className="border-l-4 border-blue-300 pl-3">
                  <p className="text-sm font-medium text-slate-700">
                    {ref.authors} ({ref.year}) — {ref.title}
                  </p>
                  <p className="text-xs text-slate-500 italic mt-0.5">"{ref.key_finding}"</p>
                  <p className="text-xs text-slate-400">RISS ID: {ref.id}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-400">
              <strong>Corpus de référence</strong> : RISS — 522 000+ articles scientifiques francophones
              (IA, neurosciences, sciences cognitives, sciences de l'éducation)
            </div>
          </div>
        )}

        {/* Notice ARASAAC */}
        <div className="bg-slate-100 rounded-xl p-4 text-xs text-slate-500">
          <p className="font-medium text-slate-700 mb-1">Mentions obligatoires</p>
          <p>Document adapté selon les Aménagements Universels (FWB) | Généré par AU-Convertisseur</p>
          <p className="mt-1">
            Les symboles pictographiques sont la propriété du Gouvernement d'Aragon (ARASAAC),
            créés par Sergio Palao — Licence CC BY-NC-SA —{' '}
            <a href="https://arasaac.org" target="_blank" rel="noopener noreferrer" className="underline">
              https://arasaac.org
            </a>
          </p>
        </div>

        <button
          onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'convert' })}
          className="w-full border border-slate-300 text-slate-600 py-3 rounded-xl hover:bg-white transition text-sm font-medium"
        >
          Fermer le rapport
        </button>
      </div>
    </div>
  )
}
