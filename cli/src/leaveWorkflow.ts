/**
 * Ciclo de vida operativo alrededor del backend ZK ya existente:
 *
 *   Se dispara el trámite (empresa, o el propio trabajador en una urgencia)
 *     indicando el email de un médico VALIDADO (ver validDoctorEmails) →
 *     se notifica (simulado) al médico y al trabajador.
 *   Médico (vista con clave compartida — ver nota de alcance abajo) ve el
 *     pendiente, completa él mismo período + diagnóstico, y certifica.
 *     Certificar hace DOS cosas reales en la misma acción: emite la
 *     credencial (issueCredential) Y genera la prueba (generateProof).
 *     El trabajador no escribe nada — el diagnóstico nace del médico, no
 *     de un autoreporte, y nunca se guarda en ningún lado más allá de esa
 *     llamada.
 *   Trabajador ve el resultado (no tiene ninguna acción pendiente).
 *   Empresa verifica.
 *
 * Por qué no hace falta un paso separado de "el trabajador genera la
 * prueba": en esta implementación el secreto de la credencial vive en
 * este server desde que se emite — nunca viaja al navegador del
 * trabajador. Un click del trabajador ahí no aportaba ninguna garantía
 * criptográfica real (eso lo dan el circuito y el nullifier, no quién
 * aprieta un botón), así que certificar y probar se colapsan en un solo
 * paso atómico.
 *
 * ALCANCE: "médico validado" acá es una lista de emails permitidos
 * (VALID_DOCTOR_EMAILS), no un sistema de cuentas/firma por médico — el
 * acceso a la vista sigue siendo una clave compartida (DOCTOR_KEY). Una
 * versión real ataría la firma a cada médico individualmente.
 *
 * Todo en memoria (Maps) — se resetea si reiniciás el server.
 *
 * EMAIL SIMULADO A PROPÓSITO (no hay credenciales de SMTP/Resend): los
 * links se devuelven en la respuesta HTTP y se loguean server-side como si
 * fueran el mail enviado.
 */
import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import type { Logger } from 'pino';

import type { LicenseType, MidnightMedLicenseApi } from '@medlicense/api';

type Company = {
  id: string;
  name: string;
  taxId: string;
  country: string;
  email: string;
  password: string;
};

type Employee = {
  id: string;
  companyId: string;
  name: string;
  email: string;
};

type LeaveStatus = 'invited' | 'proven' | 'verified';

type LeaveRequest = {
  token: string;
  companyId: string;
  employeeId: string;
  doctorEmail: string;
  status: LeaveStatus;
  licenseType?: LicenseType;
  periodStart?: string;
  periodEnd?: string;
  credential?: { secret: string; commitment: string; issuedAt: string };
  proof?: unknown;
  verification?: unknown;
  createdAt: string;
};

const hex = (bytes = 16) => randomBytes(bytes).toString('hex');

export function createLeaveWorkflowRouter(api: MidnightMedLicenseApi, logger: Logger): Router {
  const router = Router();

  const companies = new Map<string, Company>();
  const companyTokens = new Map<string, string>(); // bearer token -> companyId
  const employees = new Map<string, Employee>();
  const leaveRequests = new Map<string, LeaveRequest>(); // keyed by token

  const doctorKey = process.env.DOCTOR_KEY ?? 'medico-demo';
  const validDoctorEmails = (process.env.VALID_DOCTOR_EMAILS ?? 'medico@demo.com')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  function requireCompany(req: { headers: Record<string, unknown> }): Company {
    const auth = String(req.headers.authorization ?? '');
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const companyId = companyTokens.get(token);
    const company = companyId ? companies.get(companyId) : undefined;
    if (!company) {
      throw Object.assign(new Error('No autenticado'), { status: 401 });
    }
    return company;
  }

  function requireDoctor(req: { headers: Record<string, unknown> }): void {
    if (String(req.headers['x-doctor-key'] ?? '') !== doctorKey) {
      throw Object.assign(new Error('Clave de médico inválida'), { status: 401 });
    }
  }

  function publicEmployee(e: Employee) {
    return { id: e.id, name: e.name, email: e.email };
  }

  function publicLeaveRequest(r: LeaveRequest) {
    const employee = employees.get(r.employeeId);
    const company = companies.get(r.companyId);
    return {
      token: r.token,
      status: r.status,
      employeeName: employee?.name,
      companyName: company?.name,
      doctorEmail: r.doctorEmail,
      licenseType: r.licenseType,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      // `credential` (tiene el secreto) NUNCA sale de acá — ni la empresa ni
      // el propio trabajador lo necesitan después de que se generó la
      // prueba. `proof` sí es público: no contiene el secreto, es
      // justamente lo que se comparte entre las partes.
      proof: r.proof,
      verification: r.verification,
    };
  }

  /** Usado tanto por RRHH (request-leave) como por el propio empleado (self-request, urgencias). */
  function createLeaveRequestFor(employee: Employee, doctorEmail: string) {
    const token = hex(16);
    const request: LeaveRequest = {
      token,
      companyId: employee.companyId,
      employeeId: employee.id,
      doctorEmail,
      status: 'invited',
      createdAt: new Date().toISOString(),
    };
    leaveRequests.set(token, request);

    const workerLink = `${process.env.EMPLOYEE_APP_URL ?? 'http://localhost:5173/#/solicitud'}/${token}`;
    // EMAIL SIMULADO: no hay proveedor de correo configurado. Se devuelve
    // el link del trabajador en la respuesta y se loguean acá ambos avisos
    // (médico y trabajador) como si fueran los mails enviados.
    logger.info(`[mail simulado] Para médico ${doctorEmail} — Asunto: Nueva solicitud de certificación — Paciente: ${employee.name}`);
    logger.info(`[mail simulado] Para: ${employee.email} — Asunto: Tu certificado médico — Link: ${workerLink}`);

    return { token, link: workerLink };
  }

  // -- Empresa: registro / login ---------------------------------------------

  router.post('/company/register', (req, res) => {
    const { name, taxId, country, email, password } = req.body ?? {};
    if (!name || !taxId || !country || !email || !password) {
      res.status(400).json({ error: 'MISSING_FIELDS' });
      return;
    }
    if ([...companies.values()].some((c) => c.email === email)) {
      res.status(409).json({ error: 'EMAIL_TAKEN' });
      return;
    }
    const id = hex(8);
    companies.set(id, { id, name, taxId, country, email, password });
    const token = hex(24);
    companyTokens.set(token, id);
    logger.info(`Empresa registrada: ${name} (${email})`);
    res.json({ token, company: { id, name, taxId, country, email } });
  });

  router.post('/company/login', (req, res) => {
    const { email, password } = req.body ?? {};
    const company = [...companies.values()].find((c) => c.email === email && c.password === password);
    if (!company) {
      res.status(401).json({ error: 'INVALID_CREDENTIALS' });
      return;
    }
    const token = hex(24);
    companyTokens.set(token, company.id);
    res.json({
      token,
      company: { id: company.id, name: company.name, taxId: company.taxId, country: company.country, email: company.email },
    });
  });

  // -- Empresa: pool de empleados ---------------------------------------------

  router.get('/company/employees', (req, res) => {
    try {
      const company = requireCompany(req);
      const list = [...employees.values()].filter((e) => e.companyId === company.id).map(publicEmployee);
      res.json({ employees: list });
    } catch (err) {
      res.status((err as { status?: number }).status ?? 500).json({ error: String(err) });
    }
  });

  router.post('/company/employees', (req, res) => {
    try {
      const company = requireCompany(req);
      const { name, email } = req.body ?? {};
      if (!name || !email) {
        res.status(400).json({ error: 'MISSING_FIELDS' });
        return;
      }
      const id = hex(8);
      employees.set(id, { id, companyId: company.id, name, email });
      res.json({ employee: publicEmployee(employees.get(id)!) });
    } catch (err) {
      res.status((err as { status?: number }).status ?? 500).json({ error: String(err) });
    }
  });

  // -- Disparar el trámite (empresa) ------------------------------------------

  router.post('/company/employees/:id/request-leave', (req, res) => {
    try {
      const company = requireCompany(req);
      const employee = employees.get(req.params.id);
      if (!employee || employee.companyId !== company.id) {
        res.status(404).json({ error: 'EMPLOYEE_NOT_FOUND' });
        return;
      }
      const doctorEmail = String(req.body?.doctorEmail ?? '').trim().toLowerCase();
      if (!doctorEmail) {
        res.status(400).json({ error: 'MISSING_FIELDS', message: 'Falta el email del médico.' });
        return;
      }
      if (!validDoctorEmails.includes(doctorEmail)) {
        res.status(400).json({
          error: 'DOCTOR_NOT_VALIDATED',
          message: 'Ese médico no está en la lista de emisores validados.',
        });
        return;
      }
      const { token, link } = createLeaveRequestFor(employee, doctorEmail);
      res.json({ token, link, employee: publicEmployee(employee) });
    } catch (err) {
      res.status((err as { status?: number }).status ?? 500).json({ error: String(err) });
    }
  });

  router.get('/company/leave-requests', (req, res) => {
    try {
      const company = requireCompany(req);
      const list = [...leaveRequests.values()]
        .filter((r) => r.companyId === company.id)
        .map((r) => publicLeaveRequest(r));
      res.json({ leaveRequests: list });
    } catch (err) {
      res.status((err as { status?: number }).status ?? 500).json({ error: String(err) });
    }
  });

  router.post('/company/leave-requests/:token/verify', async (req, res) => {
    try {
      const company = requireCompany(req);
      const request = leaveRequests.get(req.params.token);
      if (!request || request.companyId !== company.id) {
        res.status(404).json({ error: 'NOT_FOUND' });
        return;
      }
      if (!request.proof) {
        res.status(400).json({ error: 'NO_PROOF_YET' });
        return;
      }
      const result = await api.verifyProof(request.proof as Parameters<typeof api.verifyProof>[0]);
      request.verification = result;
      request.status = 'verified';
      res.json({ result });
    } catch (err) {
      logger.error(err);
      res.status(500).json({ error: 'VERIFY_FAILED', message: String(err) });
    }
  });

  // -- Empleado: autogestión para urgencias (sin esperar a que RRHH lo dispare) --

  /**
   * Para cuando el trabajador no puede esperar a que la empresa le mande el
   * link (urgencia médica real). Requiere que RRHH ya lo haya cargado como
   * empleado en algún momento — no es un alta libre, solo salta el paso de
   * "RRHH aprieta el botón". Si el mismo email está en más de una empresa,
   * devuelve las opciones para que el front le pregunte en cuál trabaja.
   */
  router.post('/employees/self-request', (req, res) => {
    const { email, companyId } = req.body ?? {};
    const doctorEmail = String(req.body?.doctorEmail ?? '').trim().toLowerCase();
    if (!email || !doctorEmail) {
      res.status(400).json({ error: 'MISSING_FIELDS' });
      return;
    }
    if (!validDoctorEmails.includes(doctorEmail)) {
      res.status(400).json({
        error: 'DOCTOR_NOT_VALIDATED',
        message: 'Ese médico no está en la lista de emisores validados.',
      });
      return;
    }

    let matches = [...employees.values()].filter((e) => e.email === email);
    if (companyId) matches = matches.filter((e) => e.companyId === companyId);

    if (matches.length === 0) {
      res.status(404).json({
        error: 'EMPLOYEE_NOT_FOUND',
        message: 'Ese email no está cargado como empleado en ninguna empresa. Pedile a RRHH que te agregue primero.',
      });
      return;
    }

    if (matches.length > 1) {
      res.json({
        needsCompanySelection: true,
        options: matches.map((e) => ({ companyId: e.companyId, companyName: companies.get(e.companyId)?.name })),
      });
      return;
    }

    const employee = matches[0];
    const { token, link } = createLeaveRequestFor(employee, doctorEmail);
    logger.info(`Autogestión: ${employee.name} inició su propio trámite (urgencia) — token ${token}`);
    res.json({ token, link, employee: publicEmployee(employee) });
  });

  // -- Trabajador: sin login, sin acción pendiente, solo para ver el estado ---

  router.get('/leave-requests/:token', (req, res) => {
    const request = leaveRequests.get(req.params.token);
    if (!request) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    res.json(publicLeaveRequest(request));
  });

  // -- Médico: certifica Y prueba en un solo paso (emisión + prueba ZK reales) -

  router.get('/doctor/pending', (req, res) => {
    try {
      requireDoctor(req);
      const pending = [...leaveRequests.values()]
        .filter((r) => r.status === 'invited')
        .map((r) => publicLeaveRequest(r));
      res.json({ pending });
    } catch (err) {
      res.status((err as { status?: number }).status ?? 500).json({ error: String(err) });
    }
  });

  router.post('/doctor/pending/:token/certify', async (req, res) => {
    try {
      requireDoctor(req);
      const request = leaveRequests.get(req.params.token);
      if (!request || request.status !== 'invited') {
        res.status(404).json({ error: 'NOT_FOUND_OR_ALREADY_HANDLED' });
        return;
      }
      const { licenseType, periodStart, periodEnd, diagnosisNote } = req.body ?? {};
      if (!licenseType || !periodStart || !periodEnd) {
        res.status(400).json({ error: 'MISSING_FIELDS' });
        return;
      }

      // El diagnóstico solo existe en esta variable local, dentro de esta
      // llamada — nunca se asigna a `request`, así que no hay nada que
      // borrar después: no llega a persistir en ningún lado más allá de
      // este punto.
      const credential = await api.issueCredential({
        issuerId: 'clinica-demo',
        licenseType,
        periodStart,
        periodEnd,
        diagnosisNote,
      });
      const proof = await api.generateProof(credential);

      request.licenseType = licenseType;
      request.periodStart = periodStart;
      request.periodEnd = periodEnd;
      request.credential = {
        secret: credential.secret,
        commitment: credential.commitment,
        issuedAt: credential.issuedAt,
      };
      request.proof = proof;
      request.status = 'proven';

      logger.info(`Certificado y probado on-chain de una: token ${request.token}`);
      res.json(publicLeaveRequest(request));
    } catch (err) {
      logger.error(err);
      res.status(500).json({ error: 'CERTIFY_FAILED', message: String(err) });
    }
  });

  return router;
}
