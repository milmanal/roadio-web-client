import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'

// Route-level code splitting. MapScreen + GeoGuessCard pull in mapbox-gl
// (~1.5 MB), so lazy-loading keeps it out of the entry chunk and off the
// non-map routes (daily / games / settings / babylon).
const MapScreen = lazy(() => import('./features/map/MapScreen'))
const DailyPage = lazy(() => import('./routes/DailyPage'))
const BabylonPage = lazy(() => import('./routes/BabylonPage'))
const GamesPage = lazy(() => import('./routes/GamesPage'))
const SettingsPage = lazy(() => import('./routes/SettingsPage'))

export default function App() {
  return (
    <Suspense fallback={<div className="route-fallback" />}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/drive" replace />} />
          <Route path="/drive" element={<MapScreen />} />
          <Route path="/daily" element={<DailyPage />} />
          <Route path="/games" element={<GamesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/babylon" element={<BabylonPage />} />
          <Route path="*" element={<Navigate to="/drive" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
