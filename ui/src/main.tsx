import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Landing from './Landing.tsx'
import CompanyPortal from './CompanyPortal.tsx'
import DoctorPortal from './DoctorPortal.tsx'
import WorkerRequest from './WorkerRequest.tsx'

function resolveRoute() {
  const hash = window.location.hash

  if (hash.startsWith('#/empresa')) return <CompanyPortal />
  if (hash.startsWith('#/medico')) return <DoctorPortal />

  const workerMatch = hash.match(/^#\/solicitud\/([^/]+)/)
  if (workerMatch) return <WorkerRequest token={decodeURIComponent(workerMatch[1])} />

  return <Landing />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>{resolveRoute()}</StrictMode>,
)
