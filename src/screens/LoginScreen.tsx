import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../store/AppContext'

type Mode = 'login' | 'register'

export default function LoginScreen() {
  const { dispatch } = useApp()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (mode === 'login') {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) { setError('Email ou mot de passe incorrect.'); setLoading(false); return }
    } else {
      const { error: err } = await supabase.auth.signUp({ email, password })
      if (err) { setError(err.message); setLoading(false); return }
      // Connexion directe après inscription
      const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password })
      if (loginErr) { setError('Compte créé — connectez-vous maintenant.'); setLoading(false); return }
    }
    setLoading(false)
    // L'auth listener dans App.tsx prend le relais
  }

  // Mode démo
  function handleDemoMode() {
    dispatch({
      type: 'SET_TEACHER',
      teacher: {
        id: 'demo',
        email: 'demo@example.be',
        display_name: 'Enseignant démo',
        school_name: 'École démo FWB',
        language: 'fr',
        created_at: new Date().toISOString(),
      },
    })
    dispatch({ type: 'SET_SCREEN', screen: 'profiles' })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-md">

        {/* Logo / titre */}
        <div className="text-center mb-8">
          <img src="/plai-logo.jpg" alt="PLAI" className="w-48 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-slate-800">Adaptateur AUs</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Adaptation de documents selon les Aménagements Universels — FWB
          </p>
          <p className="text-xs text-purple-600 mt-1 font-medium">
            PLAI — Pôle Liégeois d'Accompagnement vers une École Inclusive
          </p>
        </div>

        {/* Onglets login / inscription */}
        <div className="flex rounded-lg border border-slate-200 mb-6 overflow-hidden">
          <button
            onClick={() => { setMode('login'); setError('') }}
            className={`flex-1 py-2 text-sm font-medium transition ${
              mode === 'login' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Connexion
          </button>
          <button
            onClick={() => { setMode('register'); setError('') }}
            className={`flex-1 py-2 text-sm font-medium transition ${
              mode === 'register' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Créer un compte
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Adresse email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="prenom.nom@monecole.be"
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="6 caractères minimum"
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50"
          >
            {loading ? '…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </form>

        <div className="mt-4 pt-4 border-t border-slate-100 text-center">
          <button
            onClick={handleDemoMode}
            className="text-sm text-slate-500 hover:text-slate-700 underline"
          >
            Essayer sans compte (mode démo)
          </button>
        </div>

      </div>
    </div>
  )
}
