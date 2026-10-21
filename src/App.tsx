import { Route, Routes } from 'react-router-dom'
import { ScrollToTop } from './components/ScrollToTop.tsx'
import { RunProvider } from './features/game/RunProvider.tsx'
import { SettingsProvider } from './features/settings/SettingsProvider.tsx'
import HomePage from './pages/HomePage'
import AboutPage from './pages/AboutPage.tsx'
import GlossaryPage from './pages/GlossaryPage.tsx'
import RecordsPage from './pages/RecordsPage.tsx'
import BriefingPage from './pages/BriefingPage.tsx'
import MeetingPage from './pages/MeetingPage.tsx'
import ResultPage from './pages/ResultPage.tsx'
import SetupPage from './pages/SetupPage.tsx'
import MotionLab from './pages/MotionLab.tsx'

function App() {
  return (
    <SettingsProvider>
      <RunProvider>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/glossary" element={<GlossaryPage />} />
          <Route path="/records" element={<RecordsPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/play/setup" element={<SetupPage />} />
          <Route path="/play/briefing" element={<BriefingPage />} />
          <Route path="/play/meeting/:turn" element={<MeetingPage />} />
          <Route path="/play/result/:runId" element={<ResultPage />} />
          {/* A development page, routed like one: reachable by typing it, and
              linked from nowhere. See the comment at the head of MotionLab. */}
          <Route path="/lab" element={<MotionLab />} />
        </Routes>
      </RunProvider>
    </SettingsProvider>
  )
}

export default App
