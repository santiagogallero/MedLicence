/**
 * Ciclo de vida operativo alrededor del backend ZK ya existente:
 *
 *   Empresa (login) → pool de empleados → "este empleado va a faltar"
 *     → se genera un link (el "mail" — simulado, ver nota abajo)
 *   Empleado abre el link (sin instalar nada) → carga tipo/período de licencia
 *   Médico (vista aparte, gate simple) → certifica → ACÁ se llama al
 *     issueCredential() real (la emisión ZK de verdad)
 *   Empleado vuelve al link → genera la prueba (llama a generateProof real)
 *   Empresa ve la solicitud lista → verifica (llama a verifyProof real)
 *
 * Todo en memoria (Maps) — se resetea si reiniciás el server. Para el
 * hackathon está bien: es orquestación alrededor de las llamadas reales al
 * contrato, que sí son persistentes on-chain.
 *
 * EMAIL SIMULADO A PROPÓSITO (decisión tomada con el usuario): no hay
 * credenciales de SMTP/Resend, así que en vez de mandar un mail de verdad,
 * `request-leave` devuelve el link directo en la respuesta HTTP y lo loguea
 * server-side. El front (Valen) tiene que mostrar ese link en el dashboard
 * de la empresa como si fuera el contenido del mail.
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

type LeaveStatus = 'invited' | 'submitted' | 'certified' | 'proven' | 'verified';

type LeaveRequest = {
  token: string;
  companyId: string;
  employeeId: string;
  status: LeaveStatus;
  licenseType?: LicenseType;
  periodStart?: string;
  periodEnd?: string;
  diagnosisNote?: string;
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

  /**
   * `forDoctor` incluye el diagnóstico — el médico es la ÚNICA parte que
   * debería verlo, para poder certificar con criterio médico real. La
   * empresa y el propio link del empleado (una vez certificado) NUNCA lo
   * reciben en esta función.
   */
  function publicLeaveRequest(r: LeaveRequest, forDoctor = false) {
    const employee = employees.get(r.employeeId);
    const company = companies.get(r.companyId);
    return {
      token: r.token,
      status: r.status,
      employeeName: employee?.name,
      companyName: company?.name,
      licenseType: r.licenseType,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      ...(forDoctor ? { diagnosisNote: r.diagnosisNote } : {}),
      credential: r.credential,
      proof: r.proof,
      verification: r.verification,
    };
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

  // -- Empresa: "che, subí tu certificado" (mail simulado) --------------------

  router.post('/company/employees/:id/request-leave', (req, res) => {
    try {
      const company = requireCompany(req);
      const employee = employees.get(req.params.id);
      if (!employee || employee.companyId !== company.id) {
        res.status(404).json({ error: 'EMPLOYEE_NOT_FOUND' });
        return;
      }
      const token = hex(16);
      const request: LeaveRequest = {
        token,
        companyId: company.id,
        employeeId: employee.id,
        status: 'invited',
        createdAt: new Date().toISOString(),
      };
      leaveRequests.set(token, request);

      const link = `${process.env.EMPLOYEE_APP_URL ?? 'http://localhost:5173/#/solicitud'}/${token}`;
      // EMAIL SIMULADO: no hay proveedor de correo configurado. Se devuelve
      // el link en la respuesta para que la empresa lo muestre/copie, y se
      // loguea acá como si fuera el contenido del mail que se mandó.
      logger.info(`[mail simulado] Para: ${employee.email} — Asunto: Certificado médico — Link: ${link}`);

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

  // -- Empleado: sin login, sin wallet, solo el link --------------------------

  router.get('/leave-requests/:token', (req, res) => {
    const request = leaveRequests.get(req.params.token);
    if (!request) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    res.json(publicLeaveRequest(request));
  });

  /** El empleado "sube el certificado": en la demo, solo carga los datos (tipo/período), no un archivo real. */
  router.post('/leave-requests/:token/submit', (req, res) => {
    const request = leaveRequests.get(req.params.token);
    if (!request) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    const { licenseType, periodStart, periodEnd, diagnosisNote } = req.body ?? {};
    if (!licenseType || !periodStart || !periodEnd) {
      res.status(400).json({ error: 'MISSING_FIELDS' });
      return;
    }
    request.licenseType = licenseType;
    request.periodStart = periodStart;
    request.periodEnd = periodEnd;
    request.diagnosisNote = diagnosisNote;
    request.status = 'submitted';
    res.json(publicLeaveRequest(request));
  });

  router.post('/leave-requests/:token/generate-proof', async (req, res) => {
    try {
      const request = leaveRequests.get(req.params.token);
      if (!request) {
        res.status(404).json({ error: 'NOT_FOUND' });
        return;
      }
      if (request.status !== 'certified' || !request.credential) {
        res.status(400).json({ error: 'NOT_CERTIFIED_YET' });
        return;
      }
      const employee = employees.get(request.employeeId);
      const proof = await api.generateProof({
        ...request.credential,
        issuerId: 'clinica-demo',
        licenseType: request.licenseType!,
        periodStart: request.periodStart!,
        periodEnd: request.periodEnd!,
      });
      request.proof = proof;
      request.status = 'proven';
      logger.info(`Prueba generada para ${employee?.name ?? request.employeeId}`);
      res.json({ proof });
    } catch (err) {
      logger.error(err);
      res.status(500).json({ error: 'PROVE_FAILED', message: String(err) });
    }
  });

  // -- Médico: certifica (esto SÍ es la emisión ZK real) ----------------------

  router.get('/doctor/pending', (req, res) => {
    try {
      requireDoctor(req);
      const pending = [...leaveRequests.values()]
        .filter((r) => r.status === 'submitted')
        .map((r) => publicLeaveRequest(r, true));
      res.json({ pending });
    } catch (err) {
      res.status((err as { status?: number }).status ?? 500).json({ error: String(err) });
    }
  });

  router.post('/doctor/pending/:token/certify', async (req, res) => {
    try {
      requireDoctor(req);
      const request = leaveRequests.get(req.params.token);
      if (!request || request.status !== 'submitted') {
        res.status(404).json({ error: 'NOT_FOUND_OR_ALREADY_HANDLED' });
        return;
      }
      const credential = await api.issueCredential({
        issuerId: 'clinica-demo',
        licenseType: request.licenseType!,
        periodStart: request.periodStart!,
        periodEnd: request.periodEnd!,
        diagnosisNote: request.diagnosisNote,
      });
      request.credential = {
        secret: credential.secret,
        commitment: credential.commitment,
        issuedAt: credential.issuedAt,
      };
      request.status = 'certified';
      // El diagnóstico ya cumplió su único propósito (que el médico decida).
      // Se borra acá — de este punto en adelante ni la empresa ni el
      // empleado (ni siquiera este mismo server, si alguien mirara la
      // memoria) tienen forma de volver a verlo.
      delete request.diagnosisNote;
      logger.info(`Licencia certificada y emitida on-chain para token ${request.token}`);
      res.json(publicLeaveRequest(request));
    } catch (err) {
      logger.error(err);
      res.status(500).json({ error: 'CERTIFY_FAILED', message: String(err) });
    }
  });

  return router;
}
