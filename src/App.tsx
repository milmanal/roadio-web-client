import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import MapScreen from './features/map/MapScreen'
import DailyPage from './routes/DailyPage'
import BabylonPage from './routes/BabylonPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/drive" replace />} />
        <Route path="/drive" element={<MapScreen />} />
        <Route path="/daily" element={<DailyPage />} />
        <Route path="/babylon" element={<BabylonPage />} />
        <Route path="*" element={<Navigate to="/drive" replace />} />
      </Route>
    </Routes>
  )
}
