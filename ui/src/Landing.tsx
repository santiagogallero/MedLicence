import { useState } from 'react'
import { motion } from 'framer-motion'
import { Briefcase, Check, HeartPulse, ShieldCheck, UserRound } from 'lucide-react'
import { ApiError, selfRequestLeave } from './api'
import { ErrorNote } from './shared'
import './App.css'

function goTo(hash: string) {
  window.location.hash = hash
  window.location.reload()
}

function Landing() {
  const [showWorkerForm, setShowWorkerForm] = useState(false)
  const [email, setEmail] = useState('')
  const [companyOptions, setCompanyOptions] = useState<
    { companyId: string; companyName?: string }[] | null
  >(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const startSelfRequest = async (companyId?: string) => {
    if (!email.trim()) return
    setLoading(true)
    setError('')
    try {
      const result = await selfRequestLeave(email.trim(), companyId)
      if ('needsCompanySelection' in result) {
        setCompanyOptions(result.options)
      } else {
        goTo(`/solicitud/${result.token}`)
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo iniciar el trámite. Probá de nuevo.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="landing-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <div className="landing-brand">
        <span className="brand-mark">
          <HeartPulse size={21} strokeWidth={2.4} />
        </span>
        <strong>MedLicence</strong>
      </div>

      <motion.section
        className="landing-hero"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <span className="landing-pill">
          <ShieldCheck size={13} />
          Confirmación de licencias médicas
        </span>

        <h1>
          Tu empresa confirma que el certificado es real.
          <br />
          <span>Nunca ve el diagnóstico.</span>
        </h1>

        <p>
          El médico certifica la licencia. El trabajador la comparte con un
          link. La empresa confirma que es auténtica y ve el tipo de licencia
          y el período — la información médica la ven solo el trabajador y su
          médico.
        </p>

        <div className="role-cards">
          <motion.div
            className="role-card"
            whileHover={{ y: -4 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          >
            <span className="role-card-icon">
              <UserRound size={22} />
            </span>
            <h2>Soy trabajador</h2>
            <p>
              Recibiste un link de tu empresa para tu certificado médico.
              Abrilo desde ahí para cargar tu licencia.
            </p>
            <button
              className="secondary-button"
              onClick={() => setShowWorkerForm((current) => !current)}
            >
              No tengo un link (urgencia)
            </button>

            {showWorkerForm && (
              <motion.div
                className="role-card-hint"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
              >
                {companyOptions ? (
                  <>
                    <p className="section-description">
                      Ese email está cargado en más de una empresa. ¿En cuál trabajás?
                    </p>
                    {companyOptions.map((option) => (
                      <button
                        key={option.companyId}
                        className="secondary-button"
                        style={{ marginTop: 8 }}
                        disabled={loading}
                        onClick={() => startSelfRequest(option.companyId)}
                      >
                        {option.companyName ?? option.companyId}
                      </button>
                    ))}
                  </>
                ) : (
                  <>
                    <p className="section-description">
                      Si tu empresa ya te cargó como empleado, podés iniciar el
                      trámite vos mismo con tu email — no hace falta esperar el link.
                    </p>
                    <label className="field full">
                      <span>Tu email</span>
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        onKeyDown={(event) => event.key === 'Enter' && startSelfRequest()}
                        placeholder="vos@empresa.com"
                        autoFocus
                      />
                    </label>
                    {error && <ErrorNote message={error} />}
                    <button
                      className="primary-button"
                      style={{ marginTop: 8 }}
                      disabled={loading || !email.trim()}
                      onClick={() => startSelfRequest()}
                    >
                      {loading ? (
                        <>
                          <span className="spinner" />
                          Buscando...
                        </>
                      ) : (
                        'Iniciar trámite'
                      )}
                    </button>
                  </>
                )}
              </motion.div>
            )}
          </motion.div>

          <motion.div
            className="role-card"
            whileHover={{ y: -4 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          >
            <span className="role-card-icon">
              <Briefcase size={22} />
            </span>
            <h2>Soy empresa</h2>
            <p>
              Invitá empleados, pedíles su certificado y confirmá que son
              auténticos sin recibir información médica.
            </p>
            <button
              className="primary-button"
              onClick={() => goTo('/empresa')}
            >
              <Check size={16} />
              Entrar como empresa
            </button>
          </motion.div>
        </div>
      </motion.section>

      <button className="landing-doctor-link" onClick={() => goTo('/medico')}>
        Acceso médico verificado
      </button>
    </main>
  )
}

export default Landing
