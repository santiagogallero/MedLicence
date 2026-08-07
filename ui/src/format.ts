import type { LeaveStatus, LicenseType } from './api'

export const LICENSE_TYPE_LABELS: Record<LicenseType, string> = {
  MEDICA: 'Licencia médica',
  MATERNIDAD: 'Licencia por maternidad',
  ACCIDENTE_LABORAL: 'Accidente laboral',
  FAMILIAR: 'Licencia familiar',
}

export const STATUS_META: Record<LeaveStatus, { label: string; tone: 'wait' | 'progress' | 'done' }> = {
  invited: { label: 'Esperando al trabajador', tone: 'wait' },
  submitted: { label: 'En revisión médica', tone: 'progress' },
  certified: { label: 'Certificado, falta confirmar', tone: 'progress' },
  proven: { label: 'Listo para confirmar', tone: 'progress' },
  verified: { label: 'Confirmado', tone: 'done' },
}

export function formatPeriod(start?: string, end?: string) {
  if (!start || !end) return '—'
  return `${start} → ${end}`
}
