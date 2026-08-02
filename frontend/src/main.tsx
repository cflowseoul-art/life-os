import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import LifeOfficeDemo from './pages/LifeOfficeDemo.tsx'
import RepresentativeComputer from './pages/RepresentativeComputer.tsx'

// Minimal path switch — no router dependency. App stays the default entry.
const path = window.location.pathname.replace(/\/$/, '')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {path === '/computer'
      ? <RepresentativeComputer />
      : path === '/life-office'
        ? <LifeOfficeDemo />
        : <App />}
  </StrictMode>,
)
