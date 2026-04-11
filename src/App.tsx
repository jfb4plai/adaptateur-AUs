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

  // Écouter la session Supabase (magic link)
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
    const { data } = await supabase
      .from('teachers')
      .upsert({ email }, { onConflict: 'email' })
      .select()
      .single()

    if (data) {
      dispatch({ type: 'SET_TEACHER', teacher: data })
      dispatch({ type: 'SET_SCREEN', screen: 'profiles' })
    }
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
