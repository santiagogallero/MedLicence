import type { LeaveStatus, LicenseType } from './api'

export const LICENSE_TYPE_LABELS: Record<LicenseType, string> = {
  MEDICA: 'Licencia médica',
  MATERNIDAD: 'Licencia por maternidad',
  ACCIDENTE_LABORAL: 'Accidente laboral',
  FAMILIAR: 'Licencia familiar',
}

export const STATUS_META: Record<LeaveStatus, { label: string; tone: 'wait' | 'progress' | 'done' }> = {
  invited: { label: 'Esperando certificación médica', tone: 'wait' },
  proven: { label: 'Listo para confirmar', tone: 'progress' },
  verified: { label: 'Confirmado', tone: 'done' },
}

export function formatPeriod(start?: string, end?: string) {
  if (!start || !end) return '—'
  return `${start} → ${end}`
}

/**
 * Shared entrance animation for every top-level screen (Landing,
 * CompanyPortal, WorkerRequest, DoctorPortal) so the app has one consistent
 * motion language instead of a different duration/easing per screen.
 */
export const SCREEN_ENTER_FROM = { opacity: 0, y: 18 }
export const SCREEN_ENTER_TO = { opacity: 1, y: 0 }
export const SCREEN_TRANSITION = { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const }
