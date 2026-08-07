import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  CalendarDays,
  Check,
  EyeOff,
  Laptop,
  HeartPulse,
  ShieldCheck,
} from 'lucide-react'
import {
  ApiError,
  generateProofForRequest,
  getLeaveRequest,
  submitLeaveRequest,
  type LeaveRequest,
  type LicenseType,
} from './api'
import {
  LICENSE_TYPE_LABELS,
  SCREEN_ENTER_FROM,
  SCREEN_ENTER_TO,
  SCREEN_TRANSITION,
  formatPeriod,
} from './format'
import { ErrorNote, ProcessingPanel, StatusBadge } from './shared'
import './App.css'

const GENERATE_MESSAGES = [
  'Preparando tu certificado...',
  'Esto puede tardar unos segundos...',
  'Confirmando los datos con el médico...',
  'Ya casi termina...',
]

const LICENSE_OPTIONS: LicenseType[] = ['MEDICA', 'MATERNIDAD', 'ACCIDENTE_LABORAL', 'FAMILIAR']

function WorkerRequest({ token }: { token: string }) {
  const [request, setRequest] = useState<LeaveRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [licenseType, setLicenseType] = useState<LicenseType>('MEDICA')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [diagnosisNote, setDiagnosisNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')

  const refresh = async () => {
    try {
      const data = await getLeaveRequest(token)
      setRequest(data)
      setLoadError('')
    } catch (err) {
      setLoadError(
        err instanceof ApiError
          ? err.status === 404
            ? 'Este link no es válido o ya venció.'
            : err.message
          : 'No se pudo cargar tu certificado.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Fetch-on-mount: the setState happens after the awaited request, not
    // synchronously, so this doesn't cascade — safe to disable.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // Mientras se espera a otra persona (médico o empresa), se consulta el
  // estado solo — nadie tiene que quedarse apretando "actualizar".
  useEffect(() => {
    if (request?.status !== 'submitted' && request?.status !== 'proven') return
    const id = setInterval(refresh, 5000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.status])

  const handleSubmit = async () => {
    if (!periodStart || !periodEnd) {
      setSubmitError('Completá el período de la licencia.')
      return
    }
    setSubmitting(true)
    setSubmitError('')
    try {
      const updated = await submitLeaveRequest(token, {
        licenseType,
        periodStart,
        periodEnd,
        diagnosisNote: diagnosisNote.trim() || undefined,
      })
      setRequest(updated)
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'No se pudo enviar la información.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setGenerateError('')
    try {
      await generateProofForRequest(token)
      await refresh()
    } catch (err) {
      setGenerateError(err instanceof ApiError ? err.message : 'No se pudo confirmar el certificado.')
    } finally {
      setGenerating(false)
    }
  }

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
          <small>Certificado médico</small>
        </span>
      </header>

      <div className="worker-content">
        <div className="security-chip worker-note">
          <Laptop size={17} />
          <span>Sin wallet, sin instalar nada — es un formulario web normal.</span>
          <ShieldCheck size={16} />
        </div>

        {loading && <div className="processing-panel"><span className="spinner-light" /><span>Cargando...</span></div>}

        {!loading && loadError && (
          <div className="panel worker-panel">
            <div className="panel-content">
              <ErrorNote message={loadError} />
            </div>
          </div>
        )}

        {!loading && !loadError && request && (
          <motion.article
            className="panel worker-panel"
            initial={SCREEN_ENTER_FROM}
            animate={SCREEN_ENTER_TO}
            transition={SCREEN_TRANSITION}
          >
            <div className="panel-heading">
              <div>
                <div>
                  <small>{request.companyName ?? 'Tu empresa'}</small>
                  <h2>Tu certificado médico</h2>
                </div>
              </div>
              <StatusBadge status={request.status} />
            </div>

            <div className="panel-content">
              {request.status === 'invited' && (
                <>
                  <p className="section-description">
                    Cargá los datos de tu licencia. La empresa solo va a ver el
                    tipo y el período — nunca el diagnóstico.
                  </p>

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
                      <span>Inicio</span>
                      <div className="input-icon">
                        <CalendarDays size={16} />
                        <input
                          type="date"
                          value={periodStart}
                          onChange={(event) => setPeriodStart(event.target.value)}
                        />
                      </div>
                    </label>

                    <label className="field">
                      <span>Finalización</span>
                      <div className="input-icon">
                        <CalendarDays size={16} />
                        <input
                          type="date"
                          value={periodEnd}
                          onChange={(event) => setPeriodEnd(event.target.value)}
                        />
                      </div>
                    </label>

                    <label className="field full private-field">
                      <span>
                        Diagnóstico (opcional)
                        <b>
                          <EyeOff size={12} />
                          Privado
                        </b>
                      </span>
                      <textarea
                        rows={3}
                        value={diagnosisNote}
                        onChange={(event) => setDiagnosisNote(event.target.value)}
                        placeholder="Ej: reposo indicado por 7 días"
                      />
                      <small>Esto lo ve solo el médico, nunca tu empresa.</small>
                    </label>
                  </div>

                  {submitError && <ErrorNote message={submitError} />}

                  <div className="panel-action">
                    <motion.button
                      className="primary-button"
                      onClick={handleSubmit}
                      disabled={submitting}
                      whileTap={{ scale: 0.98 }}
                    >
                      {submitting ? (
                        <>
                          <span className="spinner" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Check size={18} />
                          Enviar al médico
                        </>
                      )}
                    </motion.button>
                  </div>
                </>
              )}

              {request.status === 'submitted' && (
                <ProcessingPanel
                  messages={[
                    'Esperando certificación médica...',
                    'Tu médico ya tiene tu solicitud.',
                    'Esto se actualiza solo, no hace falta recargar.',
                  ]}
                />
              )}

              {request.status === 'certified' && (
                <>
                  <p className="section-description">
                    Tu médico ya certificó la licencia. Confirmá tu
                    certificado para que tu empresa pueda validarlo.
                  </p>

                  {generateError && <ErrorNote message={generateError} />}

                  {generating ? (
                    <ProcessingPanel messages={GENERATE_MESSAGES} />
                  ) : (
                    <motion.button
                      className="primary-button"
                      onClick={handleGenerate}
                      whileTap={{ scale: 0.98 }}
                    >
                      <ShieldCheck size={18} />
                      Confirmar mi certificado
                    </motion.button>
                  )}
                </>
              )}

              {request.status === 'proven' && (
                <motion.div
                  className="success-banner"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={SCREEN_TRANSITION}
                >
                  <motion.span
                    className="success-icon"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.1 }}
                  >
                    <Check size={20} strokeWidth={3} />
                  </motion.span>
                  <div>
                    <strong>Certificado listo</strong>
                    <span>
                      Tu empresa ya puede confirmarlo. Te va a llegar tu
                      licencia sin que nadie vea tu diagnóstico.
                    </span>
                  </div>
                </motion.div>
              )}

              {request.status === 'verified' && (
                <motion.div
                  className="success-banner"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={SCREEN_TRANSITION}
                >
                  <motion.span
                    className="success-icon"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.1 }}
                  >
                    <Check size={20} strokeWidth={3} />
                  </motion.span>
                  <div>
                    <strong>Tu empresa confirmó el certificado</strong>
                    <span>
                      Período: {formatPeriod(request.periodStart, request.periodEnd)}
                    </span>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.article>
        )}
      </div>
    </main>
  )
}

export default WorkerRequest
