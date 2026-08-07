import { useState } from 'react'
import { motion } from 'framer-motion'
import { Briefcase, Check, HeartPulse, ShieldCheck, UserRound } from 'lucide-react'
import { SCREEN_ENTER_FROM, SCREEN_ENTER_TO, SCREEN_TRANSITION } from './format'
import './App.css'

function goTo(hash: string) {
  window.location.hash = hash
  window.location.reload()
}

function Landing() {
  const [showWorkerHint, setShowWorkerHint] = useState(false)

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
        initial={SCREEN_ENTER_FROM}
        animate={SCREEN_ENTER_TO}
        transition={SCREEN_TRANSITION}
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
              onClick={() => setShowWorkerHint((current) => !current)}
            >
              No tengo un link
            </button>

            {showWorkerHint && (
              <motion.div
                className="role-card-hint"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
              >
                Tu empresa te lo tiene que enviar primero. Pedile a alguien de
                Recursos Humanos que te invite desde el panel de empresa.
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
