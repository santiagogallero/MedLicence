import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  Copy,
  Database,
  EyeOff,
  FileCheck2,
  Fingerprint,
  Globe2,
  Hash,
  HeartPulse,
  KeyRound,
  Laptop,
  LockKeyhole,
  Network,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRoundCheck,
  Zap,
} from 'lucide-react'
import { translations, type Language } from './i18n'
import {
  PROOF_PROTOCOL,
  PROOF_TYPE_MEDICAL_LEAVE,
  isValidProofPayload,
  saveProof,
  type ProofPayload,
} from './proof'
import './App.css'

type Phase = 0 | 1 | 2 | 3 | 4 | 5

type CredentialData = {
  secret: string
  secretHash: string
  commitment: string
  merkleRoot: string
  merklePath: string[]
  proof: string
  nullifier: string
}

const emptyCredential: CredentialData = {
  secret: '',
  secretHash: '',
  commitment: '',
  merkleRoot: '',
  merklePath: [],
  proof: '',
  nullifier: '',
}

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

const randomHex = (bytes = 32) => {
  const values = crypto.getRandomValues(new Uint8Array(bytes))
  return `0x${Array.from(values)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`
}

const sha256 = async (value: string) => {
  const encoded = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', encoded)

  return `0x${Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`
}

const shortHash = (value: string) =>
  value ? `${value.slice(0, 12)}...${value.slice(-10)}` : '—'

const phaseIcons = [
  Fingerprint,
  Stethoscope,
  Database,
  FileCheck2,
  Building2,
  LockKeyhole,
]

function App() {
  const [language, setLanguage] = useState<Language>('es')
  const [phase, setPhase] = useState<Phase>(0)
  const [loading, setLoading] = useState('')
  const [copied, setCopied] = useState('')
  const [verified, setVerified] = useState(false)
  const [employee, setEmployee] = useState('Valentino Arias')
  const [company, setCompany] = useState('Empresa demo LATAM')
  const [startDate, setStartDate] = useState('2026-03-01')
  const [endDate, setEndDate] = useState('2026-03-10')
  const [diagnosis, setDiagnosis] = useState('Reposo médico indicado')
  const [credential, setCredential] =
    useState<CredentialData>(emptyCredential)

  const t = translations[language]

  const proofPayload = useMemo<ProofPayload>(
    () => ({
      protocol: PROOF_PROTOCOL,
      proof: credential.proof,
      nullifier: credential.nullifier,
      merkleRoot: credential.merkleRoot,
      disclosed: {
        type: PROOF_TYPE_MEDICAL_LEAVE,
        startDate,
        endDate,
      },
    }),
    [
      credential.merkleRoot,
      credential.nullifier,
      credential.proof,
      startDate,
      endDate,
    ],
  )

  const sharePayload = useMemo(
    () => JSON.stringify(proofPayload),
    [proofPayload],
  )

  // proofPayload only satisfies the contract once proof/nullifier/merkleRoot
  // are populated (hex fields are empty strings until generateProof runs),
  // so this both validates and gates when the copy actually gets persisted.
  const proofValidated = isValidProofPayload(proofPayload)

  useEffect(() => {
    if (proofValidated) saveProof(proofPayload)
  }, [proofValidated, proofPayload])

  const copyValue = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value)
    setCopied(label)
    setTimeout(() => setCopied(''), 1400)
  }

  const generateSecret = async () => {
    setLoading('secret')
    await sleep(700)

    const secret = randomHex()
    const secretHash = await sha256(secret)

    setCredential({
      ...emptyCredential,
      secret,
      secretHash,
    })
    setLoading('')
  }

  const issueCredential = async () => {
    setLoading('issue')

    const commitment = await sha256(
      `${credential.secretHash}|MEDICAL_LEAVE|${startDate}|${endDate}`,
    )

    await sleep(700)

    const merklePath = [
      randomHex(16),
      randomHex(16),
      randomHex(16),
      randomHex(16),
    ]

    const merkleRoot = await sha256(
      `${commitment}|${merklePath.join('|')}`,
    )

    setCredential((current) => ({
      ...current,
      commitment,
      merkleRoot,
      merklePath,
    }))

    await sleep(650)
    setLoading('')
  }

  const generateProof = async () => {
    setLoading('proof')

    const proof = await sha256(
      `${credential.secret}|${credential.commitment}|${credential.merklePath.join('|')}`,
    )

    const nullifier = await sha256(
      `${credential.secret}|${credential.commitment}`,
    )

    await sleep(1250)

    setCredential((current) => ({
      ...current,
      proof: `${proof}${randomHex(32).slice(2)}`,
      nullifier,
    }))

    setLoading('')
  }

  const verifyCredential = async () => {
    setLoading('verify')
    setVerified(false)
    await sleep(1800)
    setVerified(true)
    setPhase(5)
    setLoading('')
  }

  const restartDemo = () => {
    setPhase(0)
    setVerified(false)
    setLoading('')
    setCopied('')
    setCredential(emptyCredential)
  }

  const nextPhase = () =>
    setPhase((current) => Math.min(current + 1, 5) as Phase)

  const goToCompanyPortal = () => {
    window.location.hash = '/empresa'
    window.location.reload()
  }

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <button className="brand" onClick={restartDemo}>
          <span className="brand-mark">
            <HeartPulse size={21} strokeWidth={2.4} />
          </span>
          <span>
            <strong>MedLicence</strong>
            <small>{t.brandSubtitle}</small>
          </span>
        </button>

        <div className="header-actions">
          <div className="network-pill">
            <span className="network-dot" />
            {t.network}
          </div>

          <button
            className="company-portal-cta"
            onClick={goToCompanyPortal}
            aria-label={t.companyPortalCta}
          >
            <Building2 size={14} />
            <span className="company-portal-cta-label">
              {t.companyPortalCta}
            </span>
          </button>

          <label className="language-select">
            <Globe2 size={15} />
            <select
              value={language}
              onChange={(event) =>
                setLanguage(event.target.value as Language)
              }
            >
              <option value="es">ES</option>
              <option value="en">EN</option>
              <option value="pt">PT</option>
            </select>
          </label>
        </div>
      </header>

      <motion.section
        className="hero"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
        }}
      >
        <div className="hero-copy">
          <motion.span
            className="eyebrow"
            variants={{
              hidden: { opacity: 0, y: 14 },
              show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
            }}
          >
            <Sparkles size={13} />
            {t.eyebrow}
          </motion.span>

          <motion.h1
            variants={{
              hidden: { opacity: 0, y: 18 },
              show: { opacity: 1, y: 0, transition: { duration: 0.55 } },
            }}
          >
            {t.heroLine1}
            <br />
            <span>{t.heroLine2}</span>
          </motion.h1>

          <motion.p
            variants={{
              hidden: { opacity: 0, y: 14 },
              show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
            }}
          >
            {t.heroDescription}
          </motion.p>
        </div>

        <motion.div
          className="privacy-card"
          variants={{
            hidden: { opacity: 0, y: 22, scale: 0.97 },
            show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.55 } },
          }}
          whileHover={{ y: -5, scale: 1.01 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        >
          <span className="shield">
            <ShieldCheck size={25} />
          </span>
          <div>
            <small>ZERO-KNOWLEDGE</small>
            <strong>{t.privacyTitle}</strong>
            <p>{t.privacyDescription}</p>
          </div>
        </motion.div>
      </motion.section>

      <section className="lifecycle">
        <div className="lifecycle-line">
          <span
            style={{
              width: `${(phase / 5) * 100}%`,
            }}
          />
        </div>

        {t.stageNames.map((name, index) => {
          const Icon = phaseIcons[index]
          const isActive = phase === index
          const isComplete = phase > index

          return (
            <button
              key={name}
              className={`lifecycle-step ${
                isActive ? 'active' : ''
              } ${isComplete ? 'complete' : ''}`}
              onClick={() => {
                if (index <= phase) setPhase(index as Phase)
              }}
              disabled={index > phase}
            >
              <span>
                {isComplete ? (
                  <Check size={15} strokeWidth={3} />
                ) : (
                  <Icon size={15} />
                )}
              </span>
              <strong>{name}</strong>
              <small>{t.stageDescriptions[index]}</small>
            </button>
          )
        })}
      </section>

      <section className="workspace">
        <AnimatePresence mode="wait">
          {phase === 0 && (
            <motion.article
              key="setup"
              className="panel"
              initial={{ opacity: 0, x: 35 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -35 }}
              transition={{ duration: 0.32 }}
            >
              <PanelHeader
                icon={<Fingerprint />}
                eyebrow={t.setupEyebrow}
                title={t.setupTitle}
                badge={t.local}
              />

              <div className="panel-content setup-layout">
                <div className="intro-block">
                  <p>{t.setupDescription}</p>

                  <div className="security-chip">
                    <Laptop size={17} />
                    <span>{t.browserSecurity}</span>
                    <ShieldCheck size={16} />
                  </div>

                  {!credential.secret ? (
                    <motion.button
                      className="primary-button"
                      onClick={generateSecret}
                      disabled={loading === 'secret'}
                      whileTap={{ scale: 0.98 }}
                    >
                      {loading === 'secret' ? (
                        <>
                          <span className="spinner" />
                          SHA-256...
                        </>
                      ) : (
                        <>
                          <KeyRound size={18} />
                          {t.generateSecret}
                        </>
                      )}
                    </motion.button>
                  ) : (
                    <div className="success-banner">
                      <CheckCircle2 size={20} />
                      <div>
                        <strong>{t.secretGenerated}</strong>
                        <span>{t.secretWarning}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="crypto-terminal">
                  <div className="terminal-bar">
                    <span />
                    <span />
                    <span />
                    <small>LOCAL VAULT</small>
                  </div>

                  <HashRow
                    icon={<LockKeyhole size={16} />}
                    label={t.secretLabel}
                    value={credential.secret}
                    hidden
                    copied={copied === 'secret'}
                    onCopy={() =>
                      copyValue('secret', credential.secret)
                    }
                  />

                  <HashRow
                    icon={<Hash size={16} />}
                    label={t.secretHashLabel}
                    value={credential.secretHash}
                    copied={copied === 'secretHash'}
                    onCopy={() =>
                      copyValue('secretHash', credential.secretHash)
                    }
                  />

                  <div className="terminal-note">
                    <EyeOff size={15} />
                    {t.secretWarning}
                  </div>
                </div>
              </div>

              <PanelFooter
                disabled={!credential.secret}
                label={t.continueConsultation}
                onClick={nextPhase}
              />
            </motion.article>
          )}

          {phase === 1 && (
            <motion.article
              key="consultation"
              className="panel"
              initial={{ opacity: 0, x: 35 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -35 }}
              transition={{ duration: 0.32 }}
            >
              <PanelHeader
                icon={<Stethoscope />}
                eyebrow={t.consultationEyebrow}
                title={t.consultationTitle}
                badge={t.local}
              />

              <div className="panel-content">
                <p className="section-description">
                  {t.consultationDescription}
                </p>

                <div className="consultation-grid">
                  <div className="consult-card shared">
                    <div className="consult-card-title">
                      <UserRoundCheck size={19} />
                      <strong>{t.sharedWithClinic}</strong>
                    </div>

                    <DataLine
                      label={t.secretHash}
                      value={shortHash(credential.secretHash)}
                      status={t.onchain.replace('ON-CHAIN', 'HASH')}
                      positive
                    />
                    <DataLine
                      label={t.leaveType}
                      value={t.medicalLeave}
                      status="CLINICAL"
                      positive
                    />
                  </div>

                  <div className="consult-card blocked">
                    <div className="consult-card-title">
                      <EyeOff size={19} />
                      <strong>{t.notShared}</strong>
                    </div>

                    <DataLine
                      label={t.cryptoIdentity}
                      value="••••••••"
                      status={t.private}
                    />
                    <DataLine
                      label={t.legalIdentity}
                      value="••••••••"
                      status={t.private}
                    />
                    <DataLine
                      label={t.diagnosis}
                      value="••••••••"
                      status={t.private}
                    />
                  </div>
                </div>
              </div>

              <PanelFooter
                label={t.continueIssue}
                onClick={nextPhase}
              />
            </motion.article>
          )}

          {phase === 2 && (
            <motion.article
              key="issue"
              className="panel"
              initial={{ opacity: 0, x: 35 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -35 }}
              transition={{ duration: 0.32 }}
            >
              <PanelHeader
                icon={<Database />}
                eyebrow={t.issueEyebrow}
                title={t.issueTitle}
                badge={t.onchain}
              />

              <div className="panel-content">
                <p className="section-description">
                  {t.issueDescription}
                </p>

                <div className="form-grid">
                  <label className="field full">
                    <span>{t.employee}</span>
                    <input
                      value={employee}
                      onChange={(event) =>
                        setEmployee(event.target.value)
                      }
                    />
                  </label>

                  <label className="field">
                    <span>{t.startDate}</span>
                    <div className="input-icon">
                      <CalendarDays size={16} />
                      <input
                        type="date"
                        value={startDate}
                        onChange={(event) =>
                          setStartDate(event.target.value)
                        }
                      />
                    </div>
                  </label>

                  <label className="field">
                    <span>{t.endDate}</span>
                    <div className="input-icon">
                      <CalendarDays size={16} />
                      <input
                        type="date"
                        value={endDate}
                        onChange={(event) =>
                          setEndDate(event.target.value)
                        }
                      />
                    </div>
                  </label>

                  <label className="field full private-field">
                    <span>
                      {t.diagnosisPrivate}
                      <b>
                        <EyeOff size={12} />
                        {t.private}
                      </b>
                    </span>
                    <input
                      value={diagnosis}
                      onChange={(event) =>
                        setDiagnosis(event.target.value)
                      }
                    />
                    <small>{t.neverPublished}</small>
                  </label>
                </div>

                <div className="formula-card">
                  <div>
                    <small>{t.commitmentFormula}</small>
                    <code>
                      SHA256(secretHash ‖ type ‖ start ‖ end)
                    </code>
                  </div>
                  <ArrowRight size={18} />
                  <div>
                    <small>{t.merkleRoot}</small>
                    <code>
                      {credential.merkleRoot
                        ? shortHash(credential.merkleRoot)
                        : '0x—'}
                    </code>
                  </div>
                </div>

                {!credential.commitment ? (
                  <motion.button
                    className="primary-button panel-action"
                    onClick={issueCredential}
                    disabled={loading === 'issue'}
                    whileTap={{ scale: 0.98 }}
                  >
                    {loading === 'issue' ? (
                      <>
                        <span className="spinner" />
                        {t.issuing}
                      </>
                    ) : (
                      <>
                        <Database size={18} />
                        {t.issueCredential}
                      </>
                    )}
                  </motion.button>
                ) : (
                  <div className="success-banner onchain-success">
                    <Network size={21} />
                    <div>
                      <strong>{t.issuedSuccess}</strong>
                      <span>{t.onlyRootPublished}</span>
                    </div>
                    <span className="tx-badge">TX CONFIRMED</span>
                  </div>
                )}
              </div>

              <PanelFooter
                disabled={!credential.commitment}
                label={t.goToWallet}
                onClick={nextPhase}
              />
            </motion.article>
          )}

          {phase === 3 && (
            <motion.article
              key="presentation"
              className="panel"
              initial={{ opacity: 0, x: 35 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -35 }}
              transition={{ duration: 0.32 }}
            >
              <PanelHeader
                icon={<FileCheck2 />}
                eyebrow={t.presentationEyebrow}
                title={t.presentationTitle}
                badge={t.local}
              />

              <div className="panel-content presentation-layout">
                <div className="credential-card">
                  <div className="credential-top">
                    <span>MEDLICENCE / ZK</span>
                    <span className="valid-dot">
                      <CheckCircle2 size={14} />
                      {t.credentialValid}
                    </span>
                  </div>

                  <div className="credential-person">
                    <span className="avatar">
                      {employee.slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <small>{t.employee}</small>
                      <h3>{employee}</h3>
                    </div>
                  </div>

                  <div className="credential-data">
                    <div>
                      <small>{t.verifiedPeriod}</small>
                      <strong>
                        {startDate} → {endDate}
                      </strong>
                    </div>
                    <div>
                      <small>{t.hiddenDiagnosis}</small>
                      <strong className="redacted">
                        ████████████
                      </strong>
                    </div>
                  </div>

                  <div className="credential-footer">
                    <span>{shortHash(credential.commitment)}</span>
                    <ShieldCheck size={20} />
                  </div>
                </div>

                <div className="proof-panel">
                  <div className="proof-heading">
                    <Zap size={21} />
                    <div>
                      <strong>{t.proofOffline}</strong>
                      <span>{t.proofDescription}</span>
                    </div>
                  </div>

                  {!credential.proof ? (
                    <motion.button
                      className="primary-button"
                      onClick={generateProof}
                      disabled={loading === 'proof'}
                      whileTap={{ scale: 0.98 }}
                    >
                      {loading === 'proof' ? (
                        <>
                          <span className="spinner" />
                          {t.generatingProof}
                        </>
                      ) : (
                        <>
                          <Fingerprint size={18} />
                          {t.generateProof}
                        </>
                      )}
                    </motion.button>
                  ) : (
                    <motion.div
                      className="qr-result"
                      initial={{ opacity: 0, scale: 0.94 }}
                      animate={{ opacity: 1, scale: 1 }}
                    >
                      <div className="qr-frame">
                        <QRCodeSVG
                          value={sharePayload}
                          size={142}
                          level="M"
                          bgColor="#ffffff"
                          fgColor="#07110f"
                        />
                      </div>
                      <div>
                        <strong>{t.proofReady}</strong>
                        <p>{t.qrDescription}</p>
                        <code>
                          {shortHash(credential.nullifier)}
                        </code>
                        {proofValidated && (
                          <div className="contract-check">
                            <ShieldCheck size={13} />
                            {t.proofValidatedSaved}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              <PanelFooter
                disabled={!credential.proof}
                label={t.openVerifier}
                onClick={nextPhase}
              />
            </motion.article>
          )}

          {(phase === 4 || phase === 5) && (
            <motion.article
              key="verification"
              className="panel verification-panel"
              initial={{ opacity: 0, x: 35 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -35 }}
              transition={{ duration: 0.32 }}
            >
              <PanelHeader
                icon={<Building2 />}
                eyebrow={t.verifyEyebrow}
                title={t.verifyTitle}
                badge={t.onchain}
              />

              <div className="panel-content">
                {!verified ? (
                  <div className="verify-layout">
                    <div className="scanner">
                      <span className="scanner-corner corner-one" />
                      <span className="scanner-corner corner-two" />
                      <span className="scanner-corner corner-three" />
                      <span className="scanner-corner corner-four" />
                      <div className="scanner-line" />

                      <QRCodeSVG
                        value={sharePayload}
                        size={190}
                        level="M"
                        bgColor="#ffffff"
                        fgColor="#07110f"
                      />
                    </div>

                    <div className="verify-copy">
                      <span className="eyebrow">
                        <FileCheck2 size={13} />
                        {t.proofReceived}
                      </span>
                      <h3>{t.readyToVerify}</h3>
                      <p>{t.verifyDescription}</p>

                      <div className="relay-card">
                        <Building2 size={18} />
                        <div>
                          <small>{t.company}</small>
                          <input
                            className="company-input"
                            value={company}
                            onChange={(event) => setCompany(event.target.value)}
                            aria-label={t.company}
                          />
                        </div>
                        <span>RELAYER</span>
                      </div>

                      <motion.button
                        className="primary-button"
                        onClick={verifyCredential}
                        disabled={loading === 'verify'}
                        whileTap={{ scale: 0.98 }}
                      >
                        {loading === 'verify' ? (
                          <>
                            <span className="spinner" />
                            {t.verifying}
                          </>
                        ) : (
                          <>
                            <ShieldCheck size={18} />
                            {t.verifyCredential}
                          </>
                        )}
                      </motion.button>
                    </div>
                  </div>
                ) : (
                  <motion.div
                    className="verified-result"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <motion.div
                      className="verified-symbol"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{
                        type: 'spring',
                        stiffness: 220,
                        damping: 13,
                      }}
                    >
                      <Check size={34} strokeWidth={3} />
                    </motion.div>

                    <span className="verified-label">
                      {t.proofVerified}
                    </span>
                    <h2>{t.authenticCertificate}</h2>
                    <p>{t.resultDescription}</p>

                    <div className="result-grid">
                      <ResultItem
                        label={t.status}
                        value={t.valid}
                        positive
                      />
                      <ResultItem
                        label={t.type}
                        value={t.medicalLeave}
                      />
                      <ResultItem
                        label={t.period}
                        value={`${startDate} → ${endDate}`}
                      />
                      <ResultItem
                        label={t.diagnosisResult}
                        value={t.notRevealed}
                        privateValue
                      />
                      <ResultItem
                        label={t.gas}
                        value={t.paidByCompany}
                      />
                    </div>

                    <div className="nullifier-card">
                      <span className="burn-icon">
                        <LockKeyhole size={21} />
                      </span>
                      <div>
                        <small>{t.replayBlocked}</small>
                        <strong>{t.nullifierBurned}</strong>
                        <p>{t.nullifierDescription}</p>
                        <code>
                          {shortHash(credential.nullifier)}
                        </code>
                      </div>
                      <span className="chain-badge">
                        <Network size={13} />
                        ON-CHAIN
                      </span>
                    </div>

                    <button
                      className="secondary-button"
                      onClick={restartDemo}
                    >
                      <RefreshCcw size={16} />
                      {t.restartDemo}
                    </button>
                  </motion.div>
                )}
              </div>
            </motion.article>
          )}
        </AnimatePresence>
      </section>

      <section className="architecture-strip">
        <div className="architecture-title">
          <Network size={18} />
          <span>{t.architecture}</span>
        </div>

        <div className="architecture-group private-architecture">
          <EyeOff size={17} />
          <div>
            <strong>{t.privateData}</strong>
            <span>{t.privateItems}</span>
          </div>
        </div>

        <ArrowRight size={17} className="architecture-arrow" />

        <div className="architecture-group public-architecture">
          <Database size={17} />
          <div>
            <strong>{t.publicData}</strong>
            <span>{t.publicItems}</span>
          </div>
        </div>
      </section>

      <footer>
        <span>MedLicence © 2026</span>
        <span>Privacy infrastructure for LATAM</span>
        <span>Built on Midnight Network</span>
      </footer>
    </main>
  )
}

function PanelHeader({
  icon,
  eyebrow,
  title,
  badge,
}: {
  icon: React.ReactNode
  eyebrow: string
  title: string
  badge: string
}) {
  return (
    <div className="panel-heading">
      <div>
        <span className="panel-icon">{icon}</span>
        <div>
          <small>{eyebrow}</small>
          <h2>{title}</h2>
        </div>
      </div>
      <span className="role-badge">{badge}</span>
    </div>
  )
}

function PanelFooter({
  label,
  disabled = false,
  onClick,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <div className="panel-footer">
      <motion.button
        className="primary-button"
        onClick={onClick}
        disabled={disabled}
        whileTap={{ scale: 0.98 }}
      >
        {label}
        <ArrowRight size={17} />
      </motion.button>
    </div>
  )
}

function HashRow({
  icon,
  label,
  value,
  hidden = false,
  copied,
  onCopy,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hidden?: boolean
  copied: boolean
  onCopy: () => void
}) {
  return (
    <div className="hash-row">
      <div className="hash-label">
        {icon}
        <span>{label}</span>
      </div>
      <div className="hash-value">
        <code>
          {!value
            ? '—'
            : hidden
              ? `${value.slice(0, 8)}••••••••••••••••••${value.slice(-6)}`
              : shortHash(value)}
        </code>
        <button onClick={onCopy} disabled={!value}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  )
}

function DataLine({
  label,
  value,
  status,
  positive = false,
}: {
  label: string
  value: string
  status: string
  positive?: boolean
}) {
  return (
    <div className="data-line">
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
      <span className={positive ? 'positive' : ''}>{status}</span>
    </div>
  )
}

function ResultItem({
  label,
  value,
  positive = false,
  privateValue = false,
}: {
  label: string
  value: string
  positive?: boolean
  privateValue?: boolean
}) {
  return (
    <div>
      <small>{label}</small>
      <strong
        className={
          positive ? 'positive-text' : privateValue ? 'private-text' : ''
        }
      >
        {privateValue && <EyeOff size={14} />}
        {value}
      </strong>
    </div>
  )
}

export default App