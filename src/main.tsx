import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { applyLocale } from './lib/i18n'
import { useSession } from './store/session'
import { useMarkers } from './store/markers'
import './index.css'

applyLocale(useSession.getState().locale)

if (import.meta.env.DEV) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any
  w.__session = useSession
  w.__useMarkers = useMarkers
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
