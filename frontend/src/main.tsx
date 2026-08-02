import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import LifeOfficeDemo from './pages/LifeOfficeDemo.tsx'

// Minimal path switch — no router dependency. App stays the default entry.
const isDemo = window.location.pathname.replace(/\/$/, '') === '/life-office'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isDemo ? <LifeOfficeDemo /> : <App />}
  </StrictMode>,
)
