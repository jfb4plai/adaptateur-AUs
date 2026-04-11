import { useEffect } from 'react'
import { AppProvider, useApp } from './store/AppContext'
import { supabase } from './lib/supabase'
import LoginScreen from './screens/LoginScreen'
import ProfilesScreen from './screens/ProfilesScreen'
import ConvertScreen from './screens/ConvertScreen'
import ReportScreen from './screens/ReportScreen'
import './index.css'

function Router() {
  const { state, dispatch } = useApp()

  // Écouter la session Supabase
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) syncTeacher(session.user.email ?? '')
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        syncTeacher(session.user.email ?? '')
      } else {
        dispatch({ type: 'SET_TEACHER', teacher: null })
        dispatch({ type: 'SET_SCREEN', screen: 'login' })
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function syncTeacher(email: string) {
    // Récupère l'UID Auth réel — toujours disponible si l'user est connecté
    const { data: { user } } = await supabase.auth.getUser()
    const authId = user?.id ?? crypto.randomUUID()

    try {
      const { data, error } = await supabase
        .from('teachers')
        .upsert({ id: authId, email }, { onConflict: 'email' })
        .select()
        .single()

      if (data) {
        dispatch({ type: 'SET_TEACHER', teacher: data })
      } else {
        // Table absente ou RLS bloquant → profil avec vrai UUID pour ne pas bloquer
        console.warn('teachers table error:', error?.message)
        dispatch({
          type: 'SET_TEACHER',
          teacher: { id: authId, email, display_name: null, school_name: null, language: 'fr', created_at: new Date().toISOString() },
        })
      }
    } catch (e) {
      console.error('syncTeacher failed:', e)
      dispatch({
        type: 'SET_TEACHER',
        teacher: { id: authId, email, display_name: null, school_name: null, language: 'fr', created_at: new Date().toISOString() },
      })
    }
    dispatch({ type: 'SET_SCREEN', screen: 'profiles' })
  }

  switch (state.screen) {
    case 'login':    return <LoginScreen />
    case 'profiles': return <ProfilesScreen />
    case 'convert':  return <ConvertScreen />
    case 'report':   return <ReportScreen />
    default:         return <LoginScreen />
  }
}

export default function App() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  )
}
