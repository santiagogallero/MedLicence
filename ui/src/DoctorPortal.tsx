import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { EyeOff, HeartPulse, KeyRound, ShieldCheck, Stethoscope } from 'lucide-react'
import { ApiError, certifyLeaveRequest, doctorSession, getDoctorPending, type LeaveRequest } from './api'
import {
  LICENSE_TYPE_LABELS,
  SCREEN_ENTER_FROM,
  SCREEN_ENTER_TO,
  SCREEN_TRANSITION,
  formatPeriod,
} from './format'
import { ErrorNote, ProcessingPanel } from './shared'
import './App.css'

const CERTIFY_MESSAGES = [
  'Emitiendo la licencia...',
  'Esto puede tardar unos segundos...',
  'Registrando la certificación...',
]

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

  const handleCertify = async (token: string) => {
    setCertifyingToken(token)
    setCertifyError('')
    try {
      await certifyLeaveRequest(token)
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
            initial={SCREEN_ENTER_FROM}
            animate={SCREEN_ENTER_TO}
            transition={SCREEN_TRANSITION}
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

      <motion.div
        className="worker-content wide"
        initial={SCREEN_ENTER_FROM}
        animate={SCREEN_ENTER_TO}
        transition={SCREEN_TRANSITION}
      >
        <div className="diagnosis-banner">
          <EyeOff size={16} />
          Esta es la única pantalla que muestra el diagnóstico. Ni la empresa
          ni el trabajador lo reciben de acá en adelante.
        </div>

        {loadError && <ErrorNote message={loadError} />}
        {certifyError && <ErrorNote message={certifyError} />}

        {pending.length === 0 && !loadError && (
          <div className="empty-state">No hay solicitudes pendientes de certificación.</div>
        )}

        <div className="doctor-list">
          {pending.map((item) => (
            <div className="panel doctor-card" key={item.token}>
              <div className="panel-content">
                <div className="doctor-card-head">
                  <div>
                    <small>{item.companyName}</small>
                    <h3>{item.employeeName}</h3>
                  </div>
                  <span className="role-badge">
                    {item.licenseType ? LICENSE_TYPE_LABELS[item.licenseType] : '—'}
                  </span>
                </div>

                <div className="doctor-card-body">
                  <div>
                    <small>Período</small>
                    <strong>{formatPeriod(item.periodStart, item.periodEnd)}</strong>
                  </div>
                  <div className="doctor-diagnosis">
                    <small>Diagnóstico</small>
                    <strong>{item.diagnosisNote || 'No se cargó diagnóstico.'}</strong>
                  </div>
                </div>

                {certifyingToken === item.token ? (
                  <ProcessingPanel messages={CERTIFY_MESSAGES} />
                ) : (
                  <motion.button
                    className="primary-button panel-action"
                    onClick={() => handleCertify(item.token)}
                    disabled={certifyingToken !== null}
                    whileTap={{ scale: 0.98 }}
                  >
                    <ShieldCheck size={17} />
                    Certificar
                  </motion.button>
                )}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </main>
  )
}

export default DoctorPortal
