import { createContext, useContext, useState } from 'react'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [apiKey, setApiKey] = useState(
    localStorage.getItem('bags_api_key') || ''
  )

  const saveApiKey = (key) => {
    setApiKey(key)
    localStorage.setItem('bags_api_key', key)
  }

  return (
    <AppContext.Provider value={{ apiKey, saveApiKey }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
