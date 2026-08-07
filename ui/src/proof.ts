export const PROOF_PROTOCOL = 'MedLicence/1.0' as const
export const PROOF_TYPE_MEDICAL_LEAVE = 'MEDICAL_LEAVE' as const
export const PROOF_STORAGE_KEY = 'medlicence-proof'

export type ProofPayload = {
  protocol: typeof PROOF_PROTOCOL
  proof: string
  nullifier: string
  merkleRoot: string
  disclosed: {
    type: typeof PROOF_TYPE_MEDICAL_LEAVE
    startDate: string
    endDate: string
  }
}

const HEX_PATTERN = /^0x[0-9a-f]+$/i
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const isHex = (value: unknown): value is string =>
  typeof value === 'string' && HEX_PATTERN.test(value)

const isDate = (value: unknown): value is string =>
  typeof value === 'string' && DATE_PATTERN.test(value)

/**
 * Runtime contract for the proof JSON handed to the employer/relayer.
 * There is no external ZK schema in this project (no contract/circuit is
 * wired up yet) — this is the closest thing to one, so every proof crossing
 * the worker -> employer boundary is checked against it before it is trusted.
 */
export function isValidProofPayload(value: unknown): value is ProofPayload {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>

  if (candidate.protocol !== PROOF_PROTOCOL) return false
  if (!isHex(candidate.proof)) return false
  if (!isHex(candidate.nullifier)) return false
  if (!isHex(candidate.merkleRoot)) return false

  if (typeof candidate.disclosed !== 'object' || candidate.disclosed === null) {
    return false
  }
  const disclosed = candidate.disclosed as Record<string, unknown>

  if (disclosed.type !== PROOF_TYPE_MEDICAL_LEAVE) return false
  if (!isDate(disclosed.startDate)) return false
  if (!isDate(disclosed.endDate)) return false
  if (disclosed.startDate > disclosed.endDate) return false

  return true
}

export function saveProof(payload: unknown): payload is ProofPayload {
  if (!isValidProofPayload(payload)) return false

  try {
    localStorage.setItem(PROOF_STORAGE_KEY, JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}

export function loadProof(): ProofPayload | null {
  try {
    const stored = localStorage.getItem(PROOF_STORAGE_KEY)
    if (!stored) return null

    const parsed = JSON.parse(stored)
    return isValidProofPayload(parsed) ? parsed : null
  } catch {
    return null
  }
}
