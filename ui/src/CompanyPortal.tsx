import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import {
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  Coins,
  FileCheck2,
  Globe2,
  History,
  LockKeyhole,
  Mail,
  MapPin,
  Network,
  ReceiptText,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'
import type { Language } from './i18n'
import {
  PROOF_PROTOCOL,
  PROOF_TYPE_MEDICAL_LEAVE,
  loadProof as loadStoredProof,
  type ProofPayload,
} from './proof'
import './App.css'

const fallbackPayload: ProofPayload = {
  protocol: PROOF_PROTOCOL,
  proof: '0x7f84a92db764928da35b839a23f1c5582a91d45ef5c93a821d70',
  nullifier:
    '0x29f8310ac45de7717b893ac1f9ed18db29460e77ac892f304116',
  merkleRoot:
    '0xc41bf809a034617b9214b1f05e51bc64710d122401e668e40d72',
  disclosed: {
    type: PROOF_TYPE_MEDICAL_LEAVE,
    startDate: '2026-03-01',
    endDate: '2026-03-10',
  },
}

const copy = {
  es: {
    back: 'Volver al protocolo',
    portal: 'Portal Empresas',
    subtitle: 'Verificación privada de licencias',
    network: 'Relayer activo',
    registrationEyebrow: 'ALTA EMPRESARIAL',
    registrationTitle: 'Registrá tu organización',
    registrationDescription:
      'Las empresas registradas pueden verificar licencias sin exigirle una wallet ni gas al trabajador.',
    formHeading: 'Datos de la organización',
    formSubheading: 'Se usan para verificar tu identidad como empleador.',
    companyName: 'Nombre de la empresa',
    companyPlaceholder: 'Empresa Demo LATAM',
    requiredTag: 'Requerido',
    companyRequiredError: 'Ingresá el nombre de tu empresa para continuar.',
    taxId: 'Identificador fiscal',
    taxPlaceholder: 'CUIT / RUT / CNPJ',
    taxIdRequiredError: 'Ingresá tu identificador fiscal para continuar.',
    country: 'País',
    countryRequiredError: 'Ingresá el país de tu empresa para continuar.',
    email: 'Correo corporativo',
    emailRequiredError: 'Ingresá un correo corporativo válido.',
    register: 'Crear cuenta empresarial',
    registering: 'Validando organización...',
    paymentTitle: '¿Quién paga?',
    paymentDescription:
      'La empresa compra créditos. MedLicence opera el relayer y paga la transacción on-chain.',
    employeePays: 'El trabajador paga',
    zero: '$0',
    dashboard: 'Panel empresarial',
    welcome: 'Organización verificada',
    availableCredits: 'Créditos disponibles',
    verifications: 'Verificaciones',
    relayerStatus: 'Estado del relayer',
    active: 'Activo',
    history: 'Historial',
    emptyHistory: 'Sin verificaciones anteriores',
    verifyTitle: 'Verificar licencia médica',
    verifyDescription:
      'Escaneá el QR o cargá la prueba recibida del trabajador.',
    proofDetected: 'Prueba MedLicence detectada',
    liveProof: 'Prueba real del trabajador',
    sampleProof: 'Datos de muestra (demo)',
    privacyNotice:
      'La prueba revela solamente tipo y período. El diagnóstico permanece oculto.',
    cost: 'Costo de verificación',
    oneCredit: '1 crédito',
    gasIncluded: 'Gas incluido',
    verify: 'Verificar y registrar nullifier',
    verifying: 'Enviando transacción por relayer...',
    verified: 'LICENCIA VERIFICADA',
    authentic: 'Certificado auténtico',
    type: 'Tipo',
    medicalLeave: 'Licencia médica',
    period: 'Período',
    diagnosis: 'Diagnóstico',
    notRevealed: 'No revelado',
    paidBy: 'Pago',
    companyPaid: 'Empresa · 1 crédito',
    transaction: 'Transacción confirmada',
    nullifierBurned: 'Nullifier registrado',
    replayBlocked:
      'La misma credencial ya no puede verificarse nuevamente.',
    remaining: 'Créditos restantes',
    verifyAnother: 'Verificar otra licencia',
  },

  en: {
    back: 'Back to protocol',
    portal: 'Employer Portal',
    subtitle: 'Private medical leave verification',
    network: 'Relayer active',
    registrationEyebrow: 'EMPLOYER ONBOARDING',
    registrationTitle: 'Register your organization',
    registrationDescription:
      'Registered employers can verify medical leave without requiring a wallet or gas from the employee.',
    formHeading: 'Organization details',
    formSubheading: 'Used to verify your identity as an employer.',
    companyName: 'Company name',
    companyPlaceholder: 'LATAM Demo Company',
    requiredTag: 'Required',
    companyRequiredError: 'Enter your company name to continue.',
    taxId: 'Tax identifier',
    taxPlaceholder: 'Tax ID',
    taxIdRequiredError: 'Enter your tax identifier to continue.',
    country: 'Country',
    countryRequiredError: 'Enter your company country to continue.',
    email: 'Corporate email',
    emailRequiredError: 'Enter a valid corporate email.',
    register: 'Create employer account',
    registering: 'Validating organization...',
    paymentTitle: 'Who pays?',
    paymentDescription:
      'The employer purchases credits. MedLicence operates the relayer and pays the on-chain transaction.',
    employeePays: 'Employee pays',
    zero: '$0',
    dashboard: 'Employer dashboard',
    welcome: 'Verified organization',
    availableCredits: 'Available credits',
    verifications: 'Verifications',
    relayerStatus: 'Relayer status',
    active: 'Active',
    history: 'History',
    emptyHistory: 'No previous verifications',
    verifyTitle: 'Verify medical leave',
    verifyDescription:
      'Scan the QR or upload the proof received from the employee.',
    proofDetected: 'MedLicence proof detected',
    liveProof: 'Live proof from the employee',
    sampleProof: 'Sample data (demo)',
    privacyNotice:
      'The proof reveals only type and period. Diagnosis remains hidden.',
    cost: 'Verification cost',
    oneCredit: '1 credit',
    gasIncluded: 'Gas included',
    verify: 'Verify and register nullifier',
    verifying: 'Submitting relayer transaction...',
    verified: 'MEDICAL LEAVE VERIFIED',
    authentic: 'Authentic certificate',
    type: 'Type',
    medicalLeave: 'Medical leave',
    period: 'Period',
    diagnosis: 'Diagnosis',
    notRevealed: 'Not revealed',
    paidBy: 'Payment',
    companyPaid: 'Employer · 1 credit',
    transaction: 'Transaction confirmed',
    nullifierBurned: 'Nullifier registered',
    replayBlocked:
      'The same credential can no longer be verified again.',
    remaining: 'Credits remaining',
    verifyAnother: 'Verify another credential',
  },

  pt: {
    back: 'Voltar ao protocolo',
    portal: 'Portal Empresas',
    subtitle: 'Verificação privada de licenças',
    network: 'Relayer ativo',
    registrationEyebrow: 'CADASTRO EMPRESARIAL',
    registrationTitle: 'Cadastre sua organização',
    registrationDescription:
      'Empresas cadastradas podem verificar licenças sem exigir carteira ou gas do funcionário.',
    formHeading: 'Dados da organização',
    formSubheading: 'Usados para verificar sua identidade como empregador.',
    companyName: 'Nome da empresa',
    companyPlaceholder: 'Empresa Demo LATAM',
    requiredTag: 'Obrigatório',
    companyRequiredError: 'Informe o nome da sua empresa para continuar.',
    taxId: 'Identificador fiscal',
    taxPlaceholder: 'CNPJ / RUT',
    taxIdRequiredError: 'Informe seu identificador fiscal para continuar.',
    country: 'País',
    countryRequiredError: 'Informe o país da sua empresa para continuar.',
    email: 'E-mail corporativo',
    emailRequiredError: 'Informe um e-mail corporativo válido.',
    register: 'Criar conta empresarial',
    registering: 'Validando organização...',
    paymentTitle: 'Quem paga?',
    paymentDescription:
      'A empresa compra créditos. MedLicence opera o relayer e paga a transação on-chain.',
    employeePays: 'O funcionário paga',
    zero: '$0',
    dashboard: 'Painel empresarial',
    welcome: 'Organização verificada',
    availableCredits: 'Créditos disponíveis',
    verifications: 'Verificações',
    relayerStatus: 'Estado do relayer',
    active: 'Ativo',
    history: 'Histórico',
    emptyHistory: 'Sem verificações anteriores',
    verifyTitle: 'Verificar licença médica',
    verifyDescription:
      'Escaneie o QR ou carregue a prova recebida do funcionário.',
    proofDetected: 'Prova MedLicence detectada',
    liveProof: 'Prova real do funcionário',
    sampleProof: 'Dados de amostra (demo)',
    privacyNotice:
      'A prova revela somente tipo e período. O diagnóstico permanece oculto.',
    cost: 'Custo da verificação',
    oneCredit: '1 crédito',
    gasIncluded: 'Gas incluído',
    verify: 'Verificar e registrar nullifier',
    verifying: 'Enviando transação pelo relayer...',
    verified: 'LICENÇA VERIFICADA',
    authentic: 'Certificado autêntico',
    type: 'Tipo',
    medicalLeave: 'Licença médica',
    period: 'Período',
    diagnosis: 'Diagnóstico',
    notRevealed: 'Não revelado',
    paidBy: 'Pagamento',
    companyPaid: 'Empresa · 1 crédito',
    transaction: 'Transação confirmada',
    nullifierBurned: 'Nullifier registrado',
    replayBlocked:
      'A mesma credencial não pode ser verificada novamente.',
    remaining: 'Créditos restantes',
    verifyAnother: 'Verificar outra licença',
  },
} as const

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
}

const staggerItem = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
}

const shortHash = (value: string) =>
  `${value.slice(0, 12)}...${value.slice(-10)}`

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function CompanyPortal() {
  const [language, setLanguage] = useState<Language>('es')
  const [registered, setRegistered] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [company, setCompany] = useState('Empresa Demo LATAM')
  const [companyTouched, setCompanyTouched] = useState(false)
  const [taxId, setTaxId] = useState('')
  const [taxIdTouched, setTaxIdTouched] = useState(false)
  const [country, setCountry] = useState('Argentina')
  const [countryTouched, setCountryTouched] = useState(false)
  const [email, setEmail] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [credits, setCredits] = useState(25)
  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified] = useState(false)

  const t = copy[language]
  // A contract-validated proof persisted by the worker flow (App.tsx) takes
  // priority; falls back to demo data when the portal is opened on its own.
  const storedProof = useMemo(() => loadStoredProof(), [])
  const proof = storedProof ?? fallbackPayload
  const isLiveProof = storedProof !== null
  const companyHasError = companyTouched && company.trim().length === 0
  const taxIdHasError = taxIdTouched && taxId.trim().length === 0
  const countryHasError = countryTouched && country.trim().length === 0
  const emailHasError =
    emailTouched && (email.trim().length === 0 || !EMAIL_PATTERN.test(email.trim()))
  const isFormValid =
    company.trim().length > 0 &&
    taxId.trim().length > 0 &&
    country.trim().length > 0 &&
    EMAIL_PATTERN.test(email.trim())

  const goBack = () => {
    window.location.hash = '/trabajador'
    window.location.reload()
  }

  const registerCompany = async () => {
    setRegistering(true)
    await new Promise((resolve) => setTimeout(resolve, 1100))
    setRegistered(true)
    setRegistering(false)
  }

  const verifyProof = async () => {
    setVerifying(true)
    await new Promise((resolve) => setTimeout(resolve, 1900))
    setCredits((current) => current - 1)
    setVerified(true)
    setVerifying(false)
  }

  return (
    <main className="company-shell">
      <div className="company-grid-background" />

      <header className="company-topbar">
        <button className="brand" onClick={goBack}>
          <span className="brand-mark">
            <HeartPulseIcon />
          </span>
          <span>
            <strong>MedLicence</strong>
            <small>{t.subtitle}</small>
          </span>
        </button>

        <div className="company-header-actions">
          <span className="company-network">
            <span />
            {t.network}
          </span>

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

      <button className="company-back" onClick={goBack}>
        <ArrowLeft size={15} />
        {t.back}
      </button>

      {!registered ? (
        <motion.section
          className="company-registration"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="registration-copy">
            <span className="eyebrow">
              <Sparkles size={13} />
              {t.registrationEyebrow}
            </span>
            <h1>{t.registrationTitle}</h1>
            <p>{t.registrationDescription}</p>

            <div className="company-payment-card">
              <Coins size={22} />
              <div>
                <h3>{t.paymentTitle}</h3>
                <p>{t.paymentDescription}</p>
              </div>
              <div className="employee-zero">
                <span>{t.employeePays}</span>
                <strong>{t.zero}</strong>
              </div>
            </div>
          </div>

          <motion.div
            className="registration-form-card"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            <motion.div className="company-card-heading" variants={staggerItem}>
              <span className="company-card-icon">
                <Building2 size={20} />
              </span>
              <div>
                <h2>{t.formHeading}</h2>
                <p>{t.formSubheading}</p>
              </div>
            </motion.div>

            <div className="company-card-body">
              <motion.label
                className={`company-field ${companyHasError ? 'has-error' : ''}`}
                variants={staggerItem}
              >
                <span>
                  {t.companyName}
                  <b>{t.requiredTag}</b>
                </span>
                <div>
                  <Building2 size={16} />
                  <input
                    value={company}
                    placeholder={t.companyPlaceholder}
                    onChange={(event) => setCompany(event.target.value)}
                    onBlur={() => setCompanyTouched(true)}
                    disabled={registering}
                  />
                </div>
                {companyHasError && (
                  <span className="company-field-error">
                    {t.companyRequiredError}
                  </span>
                )}
              </motion.label>

              <motion.label
                className={`company-field ${taxIdHasError ? 'has-error' : ''}`}
                variants={staggerItem}
              >
                <span>
                  {t.taxId}
                  <b>{t.requiredTag}</b>
                </span>
                <div>
                  <ReceiptText size={16} />
                  <input
                    value={taxId}
                    placeholder={t.taxPlaceholder}
                    onChange={(event) => setTaxId(event.target.value)}
                    onBlur={() => setTaxIdTouched(true)}
                    disabled={registering}
                  />
                </div>
                {taxIdHasError && (
                  <span className="company-field-error">
                    {t.taxIdRequiredError}
                  </span>
                )}
              </motion.label>

              <motion.label
                className={`company-field ${countryHasError ? 'has-error' : ''}`}
                variants={staggerItem}
              >
                <span>
                  {t.country}
                  <b>{t.requiredTag}</b>
                </span>
                <div>
                  <MapPin size={16} />
                  <input
                    value={country}
                    onChange={(event) => setCountry(event.target.value)}
                    onBlur={() => setCountryTouched(true)}
                    disabled={registering}
                  />
                </div>
                {countryHasError && (
                  <span className="company-field-error">
                    {t.countryRequiredError}
                  </span>
                )}
              </motion.label>

              <motion.label
                className={`company-field ${emailHasError ? 'has-error' : ''}`}
                variants={staggerItem}
              >
                <span>
                  {t.email}
                  <b>{t.requiredTag}</b>
                </span>
                <div>
                  <Mail size={16} />
                  <input
                    type="email"
                    value={email}
                    placeholder="empresa@dominio.com"
                    onChange={(event) => setEmail(event.target.value)}
                    onBlur={() => setEmailTouched(true)}
                    disabled={registering}
                  />
                </div>
                {emailHasError && (
                  <span className="company-field-error">
                    {t.emailRequiredError}
                  </span>
                )}
              </motion.label>

              <motion.button
                className="company-primary-button"
                onClick={registerCompany}
                disabled={registering || !isFormValid}
                whileTap={{ scale: 0.98 }}
                whileHover={{ y: -2 }}
                variants={staggerItem}
              >
                {registering ? (
                  <>
                    <span className="spinner company-spinner" />
                    {t.registering}
                  </>
                ) : (
                  <>
                    <ShieldCheck size={17} />
                    {t.register}
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        </motion.section>
      ) : (
        <motion.section
          className="company-dashboard"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="company-dashboard-heading">
            <div>
              <span className="eyebrow">{t.dashboard}</span>
              <h1>{company}</h1>
              <p>
                <CheckCircle2 size={14} />
                {t.welcome}
              </p>
            </div>

            <div className="company-account">
              <span>{company.slice(0, 1).toUpperCase()}</span>
              <div>
                <strong>{company}</strong>
                <small>{country}</small>
              </div>
            </div>
          </div>

          <motion.div
            className="company-metrics"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            <MetricCard
              icon={<Coins />}
              label={t.availableCredits}
              value={String(credits)}
              accent
            />
            <MetricCard
              icon={<FileCheck2 />}
              label={t.verifications}
              value={verified ? '1' : '0'}
            />
            <MetricCard
              icon={<Network />}
              label={t.relayerStatus}
              value={t.active}
              positive
            />
            <MetricCard
              icon={<History />}
              label={t.history}
              value={verified ? '1 TX' : '—'}
            />
          </motion.div>

          <div className="company-verification-card">
            <AnimatePresence mode="wait">
            {!verified ? (
              <motion.div
                key="verify-form"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.3 }}
              >
                <div className="company-verification-copy">
                  <span className="company-scan-icon">
                    <ScanLine size={24} />
                  </span>
                  <div>
                    <h2>{t.verifyTitle}</h2>
                    <p>{t.verifyDescription}</p>
                  </div>
                </div>

                <div className="company-proof-preview">
                  <div className="company-qr">
                    <QRCodeSVG
                      value={JSON.stringify(proof)}
                      size={150}
                      level="M"
                      bgColor="#ffffff"
                      fgColor="#07110f"
                    />
                    <span className="company-scan-line" />
                  </div>

                  <div className="proof-details">
                    <span className="proof-detected">
                      <CheckCircle2 size={15} />
                      {t.proofDetected}
                    </span>

                    <span
                      className={`proof-source ${isLiveProof ? 'live' : 'sample'}`}
                    >
                      {isLiveProof ? t.liveProof : t.sampleProof}
                    </span>

                    <code>{shortHash(proof.proof)}</code>
                    <p>{t.privacyNotice}</p>

                    <div className="verification-preview-grid">
                      <div>
                        <small>{t.type}</small>
                        <strong>{t.medicalLeave}</strong>
                      </div>
                      <div>
                        <small>{t.period}</small>
                        <strong>
                          {proof.disclosed.startDate} →{' '}
                          {proof.disclosed.endDate}
                        </strong>
                      </div>
                      <div>
                        <small>{t.diagnosis}</small>
                        <strong className="company-private">
                          <LockKeyhole size={13} />
                          {t.notRevealed}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="company-payment-summary">
                  <div>
                    <small>{t.cost}</small>
                    <strong>{t.oneCredit}</strong>
                  </div>
                  <span>
                    <Zap size={14} />
                    {t.gasIncluded}
                  </span>
                  <motion.button
                    className="company-primary-button"
                    onClick={verifyProof}
                    disabled={verifying}
                    whileTap={{ scale: 0.98 }}
                  >
                    {verifying ? (
                      <>
                        <span className="spinner company-spinner" />
                        {t.verifying}
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={17} />
                        {t.verify}
                      </>
                    )}
                  </motion.button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="verify-result"
                className="company-verified-result"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.3 }}
              >
                <motion.span
                  className="company-check"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    type: 'spring',
                    stiffness: 220,
                    damping: 14,
                  }}
                >
                  <Check size={34} />
                </motion.span>

                <small>{t.verified}</small>
                <h2>{t.authentic}</h2>

                <div className="company-result-grid">
                  <Result label={t.type} value={t.medicalLeave} />
                  <Result
                    label={t.period}
                    value={`${proof.disclosed.startDate} → ${proof.disclosed.endDate}`}
                  />
                  <Result
                    label={t.diagnosis}
                    value={t.notRevealed}
                    privateValue
                  />
                  <Result label={t.paidBy} value={t.companyPaid} />
                </div>

                <div className="company-transaction">
                  <span>
                    <Network size={19} />
                  </span>
                  <div>
                    <small>{t.transaction}</small>
                    <strong>{t.nullifierBurned}</strong>
                    <code>{shortHash(proof.nullifier)}</code>
                    <p>{t.replayBlocked}</p>
                  </div>
                </div>

                <div className="credits-remaining">
                  <Coins size={17} />
                  <span>{t.remaining}</span>
                  <strong>{credits}</strong>
                </div>

                <button
                  className="company-secondary-button"
                  onClick={() => setVerified(false)}
                >
                  {t.verifyAnother}
                </button>
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        </motion.section>
      )}
    </main>
  )
}

function MetricCard({
  icon,
  label,
  value,
  accent = false,
  positive = false,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent?: boolean
  positive?: boolean
}) {
  return (
    <motion.div
      className={`company-metric ${accent ? 'accent' : ''}`}
      variants={staggerItem}
      whileHover={{ y: -4 }}
    >
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong className={positive ? 'metric-positive' : ''}>
          {value}
        </strong>
      </div>
    </motion.div>
  )
}

function Result({
  label,
  value,
  privateValue = false,
}: {
  label: string
  value: string
  privateValue?: boolean
}) {
  return (
    <div>
      <small>{label}</small>
      <strong className={privateValue ? 'company-private' : ''}>
        {privateValue && <LockKeyhole size={13} />}
        {value}
      </strong>
    </div>
  )
}

function HeartPulseIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
      <path d="M3.22 12H9.5l.5-1 2 4 2-7 1.5 4H21" />
    </svg>
  )
}

export default CompanyPortal