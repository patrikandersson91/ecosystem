import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router'
import { EcosystemProvider } from './state/ecosystem-context.tsx'
import LandingPage from './pages/LandingPage.tsx'
import SimulationPage from './pages/SimulationPage.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <EcosystemProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/sim" element={<SimulationPage />} />
        </Routes>
      </EcosystemProvider>
    </BrowserRouter>
  </StrictMode>,
)
