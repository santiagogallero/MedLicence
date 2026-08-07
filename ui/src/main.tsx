import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import CompanyPortal from './CompanyPortal.tsx'

const isCompanyPortal = window.location.hash.startsWith('#/empresa')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isCompanyPortal ? <CompanyPortal /> : <App />}
  </StrictMode>,
)