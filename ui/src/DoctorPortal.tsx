import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { EyeOff, HeartPulse, KeyRound, ShieldCheck, Stethoscope } from 'lucide-react'
import {
  ApiError,
  certifyLeaveRequest,
  doctorSession,
  getDoctorPending,
  type LeaveRequest,
  type LicenseType,
} from './api'
import { LICENSE_TYPE_LABELS } from './format'
import { ErrorNote, ProcessingPanel } from './shared'
import './App.css'

const CERTIFY_MESSAGES = [
  'Emitiendo la licencia...',
  'Generando la prueba on-chain...',
  'Esto puede tardar unos segundos...',
  'Ya casi termina...',
]

const LICENSE_OPTIONS: LicenseType[] = ['MEDICA', 'MATERNIDAD', 'ACCIDENTE_LABORAL', 'FAMILIAR']

function PendingCard({
  item,
  busy,
  onCertify,
}: {
  item: LeaveRequest
  busy: boolean
  onCertify: (token: string, input: {
    licenseType: LicenseType
    periodStart: string
    periodEnd: string
    diagnosisNote?: string
  }) => void
}) {
  const [licenseType, setLicenseType] = useState<LicenseType>('MEDICA')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [diagnosisNote, setDiagnosisNote] = useState('')

  const canSubmit = !!periodStart && !!periodEnd

  return (
    <div className="panel doctor-card" key={item.token}>
      <div className="panel-content">
        <div className="doctor-card-head">
          <div>
            <small>{item.companyName}</small>
            <h3>{item.employeeName}</h3>
          </div>
        </div>

        {busy ? (
          <ProcessingPanel messages={CERTIFY_MESSAGES} />
        ) : (
          <>
            <div className="form-grid">
              <label className="field full">
                <span>Tipo de licencia</span>
                <select
                  value={licenseType}
                  onChange={(event) => setLicenseType(event.target.value as LicenseType)}
                >
                  {LICENSE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {LICENSE_TYPE_LABELS[option]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Desde</span>
                <input
                  type="date"
                  value={periodStart}
                  onChange={(event) => setPeriodStart(event.target.value)}
                />
              </label>

              <label className="field">
                <span>Hasta</span>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(event) => setPeriodEnd(event.target.value)}
                />
              </label>

              <label className="field full">
                <span>Diagnóstico (solo vos lo ves)</span>
                <textarea
                  value={diagnosisNote}
                  onChange={(event) => setDiagnosisNote(event.target.value)}
                  placeholder="Reposo médico indicado..."
                  rows={2}
                />
              </label>
            </div>

            <motion.button
              className="primary-button panel-action"
              onClick={() =>
                onCertify(item.token, {
                  licenseType,
                  periodStart,
                  periodEnd,
                  diagnosisNote: diagnosisNote.trim() || undefined,
                })
              }
              disabled={!canSubmit}
              whileTap={{ scale: 0.98 }}
            >
              <ShieldCheck size={17} />
              Certificar
            </motion.button>
          </>
        )}
      </div>
    </div>
  )
}

function DoctorPortal() {
  const [gateOpen, setGateOpen] = useState(!doctorSession.key)
  const [keyInput, setKeyInput] = useState('')
  const [gateError, setGateError] = useState('')
  const [checkingGate, setCheckingGate] = useState(!!doctorSession.key)

  const [pending, setPending] = useState<LeaveRequest[]>([])
  const [loadError, setLoadError] = useState('')

  const [certifyingToken, setCertifyingToken] = useState<string | null>(null)
  const [certifyError, setCertifyError] = useState('')

  const loadPending = async () => {
    try {
      const data = await getDoctorPending()
      setPending(data.pending)
      setLoadError('')
      setGateOpen(false)
      return true
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        doctorSession.clear()
        setGateOpen(true)
        setGateError('Clave incorrecta.')
      } else {
        setLoadError(err instanceof ApiError ? err.message : 'No se pudo cargar la lista.')
      }
      return false
    } finally {
      setCheckingGate(false)
    }
  }

  useEffect(() => {
    // Fetch-on-mount: setState happens after the awaited request, not
    // synchronously, so this doesn't cascade — safe to disable.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (doctorSession.key) loadPending()
  }, [])

  const handleEnter = async () => {
    if (!keyInput.trim()) return
    setCheckingGate(true)
    setGateError('')
    doctorSession.save(keyInput.trim())
    await loadPending()
  }

  const handleCertify = async (
    token: string,
    input: { licenseType: LicenseType; periodStart: string; periodEnd: string; diagnosisNote?: string },
  ) => {
    setCertifyingToken(token)
    setCertifyError('')
    try {
      await certifyLeaveRequest(token, input)
      await loadPending()
    } catch (err) {
      setCertifyError(err instanceof ApiError ? err.message : 'No se pudo certificar.')
    } finally {
      setCertifyingToken(null)
    }
  }

  if (gateOpen) {
    return (
      <main className="worker-shell">
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />

        <header className="worker-topbar">
          <span className="brand-mark">
            <HeartPulse size={20} strokeWidth={2.4} />
          </span>
          <span>
            <strong>MedLicence</strong>
            <small>Acceso médico</small>
          </span>
        </header>

        <div className="worker-content">
          <motion.article
            className="panel worker-panel doctor-gate"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="panel-content">
              <span className="company-scan-icon">
                <KeyRound size={22} />
              </span>
              <h2>Acceso médico verificado</h2>
              <p className="section-description">
                Ingresá tu clave de médico para ver las solicitudes pendientes
                de certificación.
              </p>

              <label className="field full">
                <span>Clave de médico</span>
                <input
                  type="password"
                  value={keyInput}
                  onChange={(event) => setKeyInput(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && handleEnter()}
                  placeholder="••••••••"
                  autoFocus
                />
              </label>

              {gateError && <ErrorNote message={gateError} />}

              <div className="panel-action">
                <motion.button
                  className="primary-button"
                  onClick={handleEnter}
                  disabled={checkingGate || !keyInput.trim()}
                  whileTap={{ scale: 0.98 }}
                >
                  {checkingGate ? (
                    <>
                      <span className="spinner" />
                      Verificando...
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={18} />
                      Entrar
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </motion.article>
        </div>
      </main>
    )
  }

  return (
    <main className="worker-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="worker-topbar">
        <span className="brand-mark">
          <Stethoscope size={20} strokeWidth={2.4} />
        </span>
        <span>
          <strong>MedLicence</strong>
          <small>Panel médico</small>
        </span>
      </header>

      <div className="worker-content wide">
        <div className="diagnosis-banner">
          <EyeOff size={16} />
          Vos completás el período y el diagnóstico acá — nadie más los
          escribe, y una vez que certificás, el diagnóstico no queda
          guardado en ningún lado. Ni la empresa ni el trabajador lo reciben.
        </div>

        {loadError && <ErrorNote message={loadError} />}
        {certifyError && <ErrorNote message={certifyError} />}

        {pending.length === 0 && !loadError && (
          <div className="empty-state">No hay solicitudes pendientes de certificación.</div>
        )}

        <div className="doctor-list">
          {pending.map((item) => (
            <PendingCard
              key={item.token}
              item={item}
              busy={certifyingToken === item.token}
              onCertify={handleCertify}
            />
          ))}
        </div>
      </div>
    </main>
  )
}

export default DoctorPortal
