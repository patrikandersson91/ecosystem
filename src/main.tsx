import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router'
import { EcosystemProvider } from './state/ecosystem-context.tsx'
import { SimulationLogProvider } from './state/simulation-log.tsx'
import SimulationPage from './pages/SimulationPage.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SimulationLogProvider>
        <EcosystemProvider>
          <Routes>
            <Route path="*" element={<SimulationPage />} />
          </Routes>
        </EcosystemProvider>
      </SimulationLogProvider>
    </BrowserRouter>
  </StrictMode>,
)
