import React, { createContext, useContext, useReducer } from 'react'
import type { Teacher, AUProfile, ConversionReport, AppScreen, ConversionStep } from '../types'

interface AppState {
  screen: AppScreen
  teacher: Teacher | null
  profiles: AUProfile[]
  selectedProfile: AUProfile | null
  conversionSteps: ConversionStep[]
  previewHtml: string | null
  docxBlob: Blob | null
  report: ConversionReport | null
  originalFilename: string | null
}

type Action =
  | { type: 'SET_SCREEN'; screen: AppScreen }
  | { type: 'SET_TEACHER'; teacher: Teacher | null }
  | { type: 'SET_PROFILES'; profiles: AUProfile[] }
  | { type: 'SET_SELECTED_PROFILE'; profile: AUProfile | null }
  | { type: 'INIT_STEPS'; steps: ConversionStep[] }
  | { type: 'UPDATE_STEP'; id: string; status: ConversionStep['status'] }
  | { type: 'SET_RESULT'; previewHtml: string; docxBlob: Blob; report: ConversionReport; filename: string }
  | { type: 'RESET_CONVERSION' }

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_SCREEN': return { ...state, screen: action.screen }
    case 'SET_TEACHER': return { ...state, teacher: action.teacher }
    case 'SET_PROFILES': return { ...state, profiles: action.profiles }
    case 'SET_SELECTED_PROFILE': return { ...state, selectedProfile: action.profile }
    case 'INIT_STEPS': return { ...state, conversionSteps: action.steps }
    case 'UPDATE_STEP': return {
      ...state,
      conversionSteps: state.conversionSteps.map(s =>
        s.id === action.id ? { ...s, status: action.status } : s
      ),
    }
    case 'SET_RESULT': return {
      ...state,
      previewHtml: action.previewHtml,
      docxBlob: action.docxBlob,
      report: action.report,
      originalFilename: action.filename,
    }
    case 'RESET_CONVERSION': return {
      ...state,
      conversionSteps: [],
      previewHtml: null,
      docxBlob: null,
      report: null,
    }
    default: return state
  }
}

const initial: AppState = {
  screen: 'login',
  teacher: null,
  profiles: [],
  selectedProfile: null,
  conversionSteps: [],
  previewHtml: null,
  docxBlob: null,
  report: null,
  originalFilename: null,
}

const Ctx = createContext<{ state: AppState; dispatch: React.Dispatch<Action> } | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial)
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>
}

export function useApp() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
