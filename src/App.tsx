import { Route, Routes } from 'react-router-dom'
import { RunProvider } from './features/game/RunProvider.tsx'
import HomePage from './pages/HomePage'
import BriefingPage from './pages/BriefingPage.tsx'
import MeetingPage from './pages/MeetingPage.tsx'
import ResultPage from './pages/ResultPage.tsx'
import SetupPage from './pages/SetupPage.tsx'

function App() {
  return (
    <RunProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/play/setup" element={<SetupPage />} />
        <Route path="/play/briefing" element={<BriefingPage />} />
        <Route path="/play/meeting/:turn" element={<MeetingPage />} />
        <Route path="/play/result/:runId" element={<ResultPage />} />
      </Routes>
    </RunProvider>
  )
}

export default App
