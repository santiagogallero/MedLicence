import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, HeartPulse, Laptop, ShieldCheck } from 'lucide-react'
import { ApiError, getLeaveRequest, type LeaveRequest } from './api'
import { formatPeriod } from './format'
import { ErrorNote, ProcessingPanel, StatusBadge } from './shared'
import './App.css'

function WorkerRequest({ token }: { token: string }) {
  const [request, setRequest] = useState<LeaveRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

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

  // No hay ninguna acción de tu lado: mientras el médico no certifique, o
  // la empresa no confirme, esto se actualiza solo.
  useEffect(() => {
    if (request?.status !== 'invited' && request?.status !== 'proven') return
    const id = setInterval(refresh, 5000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.status])

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
          <span>Sin wallet, sin instalar nada — no tenés ninguna acción pendiente.</span>
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
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
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
                <ProcessingPanel
                  messages={[
                    `Esperando certificación de ${request.doctorEmail ?? 'tu médico'}...`,
                    'Tu médico ya tiene tu solicitud.',
                    'Esto se actualiza solo, no hace falta recargar.',
                  ]}
                />
              )}

              {request.status === 'proven' && (
                <div className="success-banner">
                  <Check size={20} />
                  <div>
                    <strong>Certificado listo</strong>
                    <span>
                      Tu médico ya certificó y probó tu licencia. Tu empresa
                      ya puede confirmarla — vos no tenés que hacer nada más.
                    </span>
                  </div>
                </div>
              )}

              {request.status === 'verified' && (
                <div className="success-banner">
                  <Check size={20} />
                  <div>
                    <strong>Tu empresa confirmó el certificado</strong>
                    <span>
                      Período: {formatPeriod(request.periodStart, request.periodEnd)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </motion.article>
        )}
      </div>
    </main>
  )
}

export default WorkerRequest
