// Cliente HTTP centralizado hacia el backend real (server puente en cli/src/server.ts).
// Ningún componente debe llamar a fetch directamente: todo pasa por acá.

const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:4787').replace(/\/$/, '')

const COMPANY_TOKEN_KEY = 'medlicence-company-token'
const COMPANY_PROFILE_KEY = 'medlicence-company-profile'
const DOCTOR_KEY_STORAGE = 'medlicence-doctor-key'

export type LicenseType = 'MEDICA' | 'MATERNIDAD' | 'ACCIDENTE_LABORAL' | 'FAMILIAR'

export type LeaveStatus = 'invited' | 'submitted' | 'certified' | 'proven' | 'verified'

export type Company = {
  id: string
  name: string
  taxId: string
  country: string
  email: string
}

export type Employee = {
  id: string
  name: string
  email: string
}

export type LeaveRequest = {
  token: string
  status: LeaveStatus
  employeeName?: string
  companyName?: string
  licenseType?: LicenseType
  periodStart?: string
  periodEnd?: string
  /** Solo presente cuando lo pide el médico (`x-doctor-key`). Nadie más lo recibe. */
  diagnosisNote?: string
  credential?: unknown
  proof?: unknown
  verification?: VerificationResult
}

export type FailureReason = 'INVALID_PROOF' | 'ALREADY_USED' | 'UNKNOWN_ISSUER' | 'EXPIRED'

export type VerificationResult = {
  valid: boolean
  reason?: FailureReason
  licenseType?: LicenseType
  periodStart?: string
  periodEnd?: string
  txHash?: string
  verifiedAt?: string
}

export class ApiError extends Error {
  status: number
  code?: string

  constructor(status: number, code: string | undefined, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

// -- Sesión de empresa --------------------------------------------------------

export const companySession = {
  get token(): string | null {
    return localStorage.getItem(COMPANY_TOKEN_KEY)
  },
  get company(): Company | null {
    const raw = localStorage.getItem(COMPANY_PROFILE_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as Company
    } catch {
      return null
    }
  },
  save(token: string, company: Company) {
    localStorage.setItem(COMPANY_TOKEN_KEY, token)
    localStorage.setItem(COMPANY_PROFILE_KEY, JSON.stringify(company))
  },
  clear() {
    localStorage.removeItem(COMPANY_TOKEN_KEY)
    localStorage.removeItem(COMPANY_PROFILE_KEY)
  },
}

// -- Sesión de médico -----------------------------------------------------

export const doctorSession = {
  get key(): string | null {
    return localStorage.getItem(DOCTOR_KEY_STORAGE)
  },
  save(key: string) {
    localStorage.setItem(DOCTOR_KEY_STORAGE, key)
  },
  clear() {
    localStorage.removeItem(DOCTOR_KEY_STORAGE)
  },
}

// -- Núcleo del cliente -----------------------------------------------------

type RequestOptions = {
  method?: 'GET' | 'POST'
  body?: unknown
  auth?: 'company' | 'doctor' | 'none'
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = 'none' } = options
  const headers: Record<string, string> = {}

  if (body !== undefined) headers['Content-Type'] = 'application/json'

  if (auth === 'company') {
    const token = companySession.token
    if (token) headers.Authorization = `Bearer ${token}`
  }

  if (auth === 'doctor') {
    const key = doctorSession.key
    if (key) headers['x-doctor-key'] = key
  }

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'No se pudo conectar con el servidor. ¿Está corriendo?')
  }

  const isJson = response.headers.get('content-type')?.includes('application/json')
  const payload = isJson ? await response.json().catch(() => null) : null

  if (!response.ok) {
    const code = payload?.error as string | undefined
    throw new ApiError(response.status, code, payload?.message ?? code ?? `Error ${response.status}`)
  }

  return payload as T
}

// -- Empresa: auth ------------------------------------------------------------

export function registerCompany(input: {
  name: string
  taxId: string
  country: string
  email: string
  password: string
}) {
  return request<{ token: string; company: Company }>('/company/register', {
    method: 'POST',
    body: input,
  })
}

export function loginCompany(input: { email: string; password: string }) {
  return request<{ token: string; company: Company }>('/company/login', {
    method: 'POST',
    body: input,
  })
}

// -- Empresa: empleados ---------------------------------------------------

export function listEmployees() {
  return request<{ employees: Employee[] }>('/company/employees', { auth: 'company' })
}

export function createEmployee(input: { name: string; email: string }) {
  return request<{ employee: Employee }>('/company/employees', {
    method: 'POST',
    body: input,
    auth: 'company',
  })
}

export function requestLeave(employeeId: string) {
  return request<{ token: string; link: string; employee: Employee }>(
    `/company/employees/${employeeId}/request-leave`,
    { method: 'POST', auth: 'company' },
  )
}

// -- Empresa: solicitudes ---------------------------------------------------

export function listLeaveRequests() {
  return request<{ leaveRequests: LeaveRequest[] }>('/company/leave-requests', {
    auth: 'company',
  })
}

export function verifyLeaveRequest(token: string) {
  return request<{ result: VerificationResult }>(`/company/leave-requests/${token}/verify`, {
    method: 'POST',
    auth: 'company',
  })
}

// -- Trabajador (público, sin login) -----------------------------------------

export function getLeaveRequest(token: string) {
  return request<LeaveRequest>(`/leave-requests/${token}`)
}

export function submitLeaveRequest(
  token: string,
  input: {
    licenseType: LicenseType
    periodStart: string
    periodEnd: string
    diagnosisNote?: string
  },
) {
  return request<LeaveRequest>(`/leave-requests/${token}/submit`, {
    method: 'POST',
    body: input,
  })
}

export function generateProofForRequest(token: string) {
  return request<{ proof: unknown }>(`/leave-requests/${token}/generate-proof`, {
    method: 'POST',
  })
}

// -- Médico -------------------------------------------------------------------

export function getDoctorPending() {
  return request<{ pending: LeaveRequest[] }>('/doctor/pending', { auth: 'doctor' })
}

export function certifyLeaveRequest(token: string) {
  return request<LeaveRequest>(`/doctor/pending/${token}/certify`, {
    method: 'POST',
    auth: 'doctor',
  })
}
