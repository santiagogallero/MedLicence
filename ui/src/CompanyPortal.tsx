import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  Building2,
  Check,
  Copy,
  HeartPulse,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Plus,
  ReceiptText,
  ShieldCheck,
  UserRound,
  UserPlus,
} from 'lucide-react'
import {
  ApiError,
  companySession,
  createEmployee,
  listEmployees,
  listLeaveRequests,
  loginCompany,
  registerCompany,
  requestLeave,
  verifyLeaveRequest,
  type Company,
  type Employee,
  type LeaveRequest,
  type VerificationResult,
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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const VERIFY_MESSAGES = [
  'Confirmando el certificado...',
  'Esto puede tardar unos segundos...',
  'Ya casi termina...',
]

function goTo(hash: string) {
  window.location.hash = hash
  window.location.reload()
}

function CompanyPortal() {
  const [company, setCompany] = useState<Company | null>(companySession.company)

  return company ? <Dashboard company={company} onLogout={() => { companySession.clear(); setCompany(null) }} /> : <Auth onAuthed={setCompany} />
}

// -- Pantalla de login / registro --------------------------------------------

function Auth({ onAuthed }: { onAuthed: (company: Company) => void }) {
  const [mode, setMode] = useState<'register' | 'login'>('register')

  const [name, setName] = useState('')
  const [taxId, setTaxId] = useState('')
  const [country, setCountry] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const touch = (field: string) => setTouched((current) => ({ ...current, [field]: true }))

  const emailValid = EMAIL_PATTERN.test(email.trim())
  const errors = {
    name: mode === 'register' && touched.name && !name.trim() ? 'Ingresá el nombre de tu empresa.' : '',
    taxId: mode === 'register' && touched.taxId && !taxId.trim() ? 'Ingresá tu identificador fiscal.' : '',
    country: mode === 'register' && touched.country && !country.trim() ? 'Ingresá el país.' : '',
    email: touched.email && !emailValid ? 'Ingresá un correo válido.' : '',
    password: touched.password && password.length < 6 ? 'Mínimo 6 caracteres.' : '',
  }

  const canSubmit =
    mode === 'login'
      ? emailValid && password.length >= 6
      : name.trim() && taxId.trim() && country.trim() && emailValid && password.length >= 6

  const submit = async () => {
    setFormError('')
    setSubmitting(true)
    try {
      const result =
        mode === 'register'
          ? await registerCompany({ name, taxId, country, email, password })
          : await loginCompany({ email, password })
      companySession.save(result.token, result.company)
      onAuthed(result.company)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_TAKEN') {
        setFormError('Ya existe una cuenta con ese correo. Iniciá sesión.')
      } else if (err instanceof ApiError && err.code === 'INVALID_CREDENTIALS') {
        setFormError('Correo o contraseña incorrectos.')
      } else {
        setFormError(err instanceof ApiError ? err.message : 'No se pudo completar la operación.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="company-shell">
      <div className="company-grid-background" />

      <header className="company-topbar">
        <button className="brand" onClick={() => goTo('/')}>
          <span className="brand-mark">
            <HeartPulse size={21} strokeWidth={2.4} />
          </span>
          <span>
            <strong>MedLicence</strong>
            <small>Panel de empresa</small>
          </span>
        </button>
      </header>

      <button className="company-back-floating" onClick={() => goTo('/')}>
        <ArrowLeft size={15} />
        Volver
      </button>

      <motion.section
        className="company-registration"
        initial={SCREEN_ENTER_FROM}
        animate={SCREEN_ENTER_TO}
        transition={SCREEN_TRANSITION}
      >
        <div className="registration-copy">
          <span className="eyebrow">
            <Building2 size={13} />
            {mode === 'register' ? 'ALTA EMPRESARIAL' : 'INICIAR SESIÓN'}
          </span>
          <h1>{mode === 'register' ? 'Registrá tu organización' : 'Bienvenida de nuevo'}</h1>
          <p>
            {mode === 'register'
              ? 'Invitá empleados y confirmá certificados médicos sin ver información médica.'
              : 'Entrá con tu correo y contraseña para ver tus empleados y solicitudes.'}
          </p>
        </div>

        <div className="registration-form-card">
          <div className="company-card-heading">
            <span className="company-card-icon">
              <Building2 size={20} />
            </span>
            <div>
              <h2>{mode === 'register' ? 'Datos de la organización' : 'Iniciar sesión'}</h2>
              <p>
                {mode === 'register'
                  ? 'Se usan para verificar tu identidad como empleador.'
                  : 'Usá el correo y la contraseña con los que te registraste.'}
              </p>
            </div>
          </div>

          <div className="company-card-body">
            {mode === 'register' && (
              <>
                <label className={`company-field ${errors.name ? 'has-error' : ''}`}>
                  <span>
                    Nombre de la empresa
                    <span className="required-mark">*</span>
                  </span>
                  <div>
                    <Building2 size={16} />
                    <input
                      value={name}
                      placeholder="Empresa Demo LATAM"
                      onChange={(event) => setName(event.target.value)}
                      onBlur={() => touch('name')}
                      disabled={submitting}
                    />
                  </div>
                  {errors.name && <span className="company-field-error">{errors.name}</span>}
                </label>

                <label className={`company-field ${errors.taxId ? 'has-error' : ''}`}>
                  <span>
                    Identificador fiscal
                    <span className="required-mark">*</span>
                  </span>
                  <div>
                    <ReceiptText size={16} />
                    <input
                      value={taxId}
                      placeholder="CUIT / RUT / CNPJ"
                      onChange={(event) => setTaxId(event.target.value)}
                      onBlur={() => touch('taxId')}
                      disabled={submitting}
                    />
                  </div>
                  {errors.taxId && <span className="company-field-error">{errors.taxId}</span>}
                </label>

                <label className={`company-field ${errors.country ? 'has-error' : ''}`}>
                  <span>
                    País
                    <span className="required-mark">*</span>
                  </span>
                  <div>
                    <MapPin size={16} />
                    <input
                      value={country}
                      placeholder="Argentina"
                      onChange={(event) => setCountry(event.target.value)}
                      onBlur={() => touch('country')}
                      disabled={submitting}
                    />
                  </div>
                  {errors.country && <span className="company-field-error">{errors.country}</span>}
                </label>
              </>
            )}

            <label
              className={`company-field ${errors.email ? 'has-error' : ''} ${mode === 'login' ? 'full' : ''}`}
            >
              <span>
                Correo corporativo
                <span className="required-mark">*</span>
              </span>
              <div>
                <Mail size={16} />
                <input
                  type="email"
                  value={email}
                  placeholder="empresa@dominio.com"
                  onChange={(event) => setEmail(event.target.value)}
                  onBlur={() => touch('email')}
                  disabled={submitting}
                />
              </div>
              {errors.email && <span className="company-field-error">{errors.email}</span>}
            </label>

            <label className={`company-field full ${errors.password ? 'has-error' : ''}`}>
              <span>
                Contraseña
                <span className="required-mark">*</span>
              </span>
              <div>
                <Lock size={16} />
                <input
                  type="password"
                  value={password}
                  placeholder="••••••••"
                  onChange={(event) => setPassword(event.target.value)}
                  onBlur={() => touch('password')}
                  disabled={submitting}
                />
              </div>
              {errors.password && <span className="company-field-error">{errors.password}</span>}
            </label>

            {formError && <span className="company-field-error">{formError}</span>}

            <motion.button
              className="company-primary-button"
              onClick={submit}
              disabled={submitting || !canSubmit}
              whileTap={{ scale: 0.98 }}
            >
              {submitting ? (
                <>
                  <span className="spinner company-spinner" />
                  {mode === 'register' ? 'Creando cuenta...' : 'Entrando...'}
                </>
              ) : (
                <>
                  <ShieldCheck size={17} />
                  {mode === 'register' ? 'Crear cuenta empresarial' : 'Entrar'}
                </>
              )}
            </motion.button>

            <button
              type="button"
              className="auth-toggle"
              onClick={() => {
                setMode((current) => (current === 'register' ? 'login' : 'register'))
                setFormError('')
                setTouched({})
              }}
            >
              {mode === 'register' ? '¿Ya tenés cuenta? Iniciá sesión' : '¿No tenés cuenta? Registrate'}
            </button>
          </div>
        </div>
      </motion.section>
    </main>
  )
}

// -- Dashboard (empresa ya logueada) -----------------------------------------

function Dashboard({ company, onLogout }: { company: Company; onLogout: () => void }) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loadingEmployees, setLoadingEmployees] = useState(true)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [addingEmployee, setAddingEmployee] = useState(false)
  const [addError, setAddError] = useState('')

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [loadingRequests, setLoadingRequests] = useState(true)

  const [requestingFor, setRequestingFor] = useState<string | null>(null)
  const [mailPreview, setMailPreview] = useState<{ email: string; link: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const [verifyingToken, setVerifyingToken] = useState<string | null>(null)
  const [verifyResults, setVerifyResults] = useState<Record<string, VerificationResult>>({})
  const [dashboardError, setDashboardError] = useState('')

  const loadEmployees = async () => {
    try {
      const data = await listEmployees()
      setEmployees(data.employees)
    } catch (err) {
      handleAuthError(err)
    } finally {
      setLoadingEmployees(false)
    }
  }

  const loadRequests = async () => {
    try {
      const data = await listLeaveRequests()
      setLeaveRequests(data.leaveRequests)
    } catch (err) {
      handleAuthError(err)
    } finally {
      setLoadingRequests(false)
    }
  }

  const handleAuthError = (err: unknown) => {
    if (err instanceof ApiError && err.status === 401) {
      onLogout()
      return
    }
    setDashboardError(err instanceof ApiError ? err.message : 'Ocurrió un error inesperado.')
  }

  useEffect(() => {
    // Fetch-on-mount: setState happens after the awaited request, not
    // synchronously, so this doesn't cascade — safe to disable.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadEmployees()
    loadRequests()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addEmployee = async () => {
    if (!newName.trim() || !newEmail.trim()) return
    setAddingEmployee(true)
    setAddError('')
    try {
      await createEmployee({ name: newName.trim(), email: newEmail.trim() })
      setNewName('')
      setNewEmail('')
      await loadEmployees()
    } catch (err) {
      setAddError(err instanceof ApiError ? err.message : 'No se pudo agregar el empleado.')
    } finally {
      setAddingEmployee(false)
    }
  }

  const askForLeave = async (employee: Employee) => {
    setRequestingFor(employee.id)
    setDashboardError('')
    try {
      const result = await requestLeave(employee.id)
      setMailPreview({ email: employee.email, link: result.link })
      await loadRequests()
    } catch (err) {
      handleAuthError(err)
    } finally {
      setRequestingFor(null)
    }
  }

  const copyLink = async (link: string) => {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const verify = async (token: string) => {
    setVerifyingToken(token)
    try {
      const { result } = await verifyLeaveRequest(token)
      setVerifyResults((current) => ({ ...current, [token]: result }))
      await loadRequests()
    } catch (err) {
      handleAuthError(err)
    } finally {
      setVerifyingToken(null)
    }
  }

  return (
    <main className="company-shell">
      <div className="company-grid-background" />

      <header className="company-topbar">
        <button className="brand" onClick={() => goTo('/')}>
          <span className="brand-mark">
            <HeartPulse size={21} strokeWidth={2.4} />
          </span>
          <span>
            <strong>MedLicence</strong>
            <small>Panel de empresa</small>
          </span>
        </button>

        <div className="company-header-actions">
          <span className="company-account">{company.name}</span>
          <button className="company-logout" onClick={onLogout}>
            <LogOut size={15} />
            Cerrar sesión
          </button>
        </div>
      </header>

      <motion.section
        className="company-dashboard"
        initial={SCREEN_ENTER_FROM}
        animate={SCREEN_ENTER_TO}
        transition={SCREEN_TRANSITION}
      >
        <div className="company-dashboard-heading">
          <div>
            <span className="eyebrow">PANEL EMPRESARIAL</span>
            <h1>{company.name}</h1>
          </div>
        </div>

        {dashboardError && <ErrorNote message={dashboardError} />}

        <div className="dashboard-columns">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="panel-icon">
                  <UserRound size={19} />
                </span>
                <div>
                  <small>EMPLEADOS</small>
                  <h2>Tu equipo</h2>
                </div>
              </div>
            </div>

            <div className="panel-content">
              <div className="add-employee-row">
                <input
                  placeholder="Nombre"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  disabled={addingEmployee}
                />
                <input
                  placeholder="Correo"
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  disabled={addingEmployee}
                />
                <button
                  className="secondary-button"
                  onClick={addEmployee}
                  disabled={addingEmployee || !newName.trim() || !newEmail.trim()}
                >
                  {addingEmployee ? <span className="spinner-light" /> : <UserPlus size={15} />}
                  Agregar
                </button>
              </div>
              {addError && <ErrorNote message={addError} />}

              {loadingEmployees ? (
                <div className="processing-panel"><span className="spinner-light" /><span>Cargando...</span></div>
              ) : employees.length === 0 ? (
                <div className="empty-state">Todavía no agregaste empleados.</div>
              ) : (
                <ul className="employee-list">
                  {employees.map((employee) => (
                    <li key={employee.id} className="employee-row">
                      <div>
                        <strong>{employee.name}</strong>
                        <small>{employee.email}</small>
                      </div>
                      <button
                        className="secondary-button"
                        onClick={() => askForLeave(employee)}
                        disabled={requestingFor === employee.id}
                      >
                        {requestingFor === employee.id ? (
                          <span className="spinner-light" />
                        ) : (
                          <Plus size={14} />
                        )}
                        Pidió licencia
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="panel-icon">
                  <ShieldCheck size={19} />
                </span>
                <div>
                  <small>SOLICITUDES</small>
                  <h2>Certificados</h2>
                </div>
              </div>
            </div>

            <div className="panel-content">
              {loadingRequests ? (
                <div className="processing-panel"><span className="spinner-light" /><span>Cargando...</span></div>
              ) : leaveRequests.length === 0 ? (
                <div className="empty-state">Todavía no pediste ningún certificado.</div>
              ) : (
                <ul className="leave-list">
                  {leaveRequests.map((item) => (
                    <li key={item.token} className="leave-row">
                      <div className="leave-row-head">
                        <div>
                          <strong>{item.employeeName}</strong>
                          <small>
                            {item.licenseType ? LICENSE_TYPE_LABELS[item.licenseType] : 'Tipo sin definir'}
                            {' · '}
                            {formatPeriod(item.periodStart, item.periodEnd)}
                          </small>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>

                      {item.status === 'proven' && (
                        verifyingToken === item.token ? (
                          <ProcessingPanel messages={VERIFY_MESSAGES} />
                        ) : (
                          <button
                            className="primary-button leave-verify-button"
                            onClick={() => verify(item.token)}
                          >
                            <Check size={15} />
                            Verificar
                          </button>
                        )
                      )}

                      {verifyResults[item.token] && (
                        <motion.div
                          className={`verify-result ${verifyResults[item.token].valid ? 'valid' : 'invalid'}`}
                          initial={{ opacity: 0, y: 8, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={SCREEN_TRANSITION}
                        >
                          {verifyResults[item.token].valid
                            ? `Certificado auténtico · ${formatPeriod(verifyResults[item.token].periodStart, verifyResults[item.token].periodEnd)}`
                            : 'No se pudo confirmar este certificado.'}
                        </motion.div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </motion.section>

      <AnimatePresence>
        {mailPreview && (
          <motion.div
            className="mail-preview-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMailPreview(null)}
          >
            <motion.div
              className="mail-preview"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              onClick={(event) => event.stopPropagation()}
            >
              <Mail size={20} />
              <div>
                <strong>Le enviamos esto a {mailPreview.email}:</strong>
                <p>No hay envío de correo real configurado — así se vería el mail.</p>
                <div className="mail-preview-link">
                  <code>{mailPreview.link}</code>
                  <button onClick={() => copyLink(mailPreview.link)}>
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
              <button className="secondary-button" onClick={() => setMailPreview(null)}>
                Cerrar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}

export default CompanyPortal
