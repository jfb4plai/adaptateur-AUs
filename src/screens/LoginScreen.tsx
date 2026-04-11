import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../store/AppContext'

export default function LoginScreen() {
  const { dispatch } = useApp()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setSent(true)
  }

  // Mode démo sans Supabase configuré
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
          <img src="/plai-logo.svg" alt="PLAI" className="w-12 h-12 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-slate-800">Adaptateur AUs</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Adaptation de documents selon les Aménagements Universels — FWB
          </p>
          <p className="text-xs text-purple-600 mt-1 font-medium">PLAI — Pôle Liégeois d'Accompagnement vers une École Inclusive</p>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="text-4xl mb-4">📬</div>
            <p className="text-slate-700 font-medium">Vérifiez votre email</p>
            <p className="text-slate-500 text-sm mt-2">
              Un lien de connexion a été envoyé à <strong>{email}</strong>
            </p>
          </div>
        ) : (
          <>
            <form onSubmit={handleLogin} className="space-y-4">
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
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50"
              >
                {loading ? 'Envoi…' : 'Recevoir le lien de connexion'}
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
          </>
        )}
      </div>
    </div>
  )
}
