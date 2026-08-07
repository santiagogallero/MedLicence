import { useState } from 'react';
import { api, type Credential, type LicenseType } from '@medlicense/api';

const TIPOS: LicenseType[] = ['MEDICA', 'MATERNIDAD', 'ACCIDENTE_LABORAL', 'FAMILIAR'];

/**
 * PANTALLA 1 — el médico emite la credencial.
 *
 * Punto clave para la demo: el campo de diagnóstico se completa acá y no
 * viaja a ningún lado. Vale la pena que la UI lo diga explícitamente.
 */
export default function ClinicScreen({ onIssued }: { onIssued: (c: Credential) => void }) {
  const [licenseType, setLicenseType] = useState<LicenseType>('MEDICA');
  const [periodStart, setPeriodStart] = useState(today());
  const [periodEnd, setPeriodEnd] = useState(inDays(7));
  const [diagnosis, setDiagnosis] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleIssue() {
    setLoading(true);
    try {
      const cred = await api.issueCredential({
        issuerId: 'MN-12345 · Clínica San Martín',
        licenseType,
        periodStart,
        periodEnd,
        diagnosisNote: diagnosis,
      });
      onIssued(cred);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card">
      <h2>Emitir licencia</h2>
      <p className="muted">Matrícula MN-12345 · Clínica San Martín</p>

      <label>
        Tipo
        <select value={licenseType} onChange={(e) => setLicenseType(e.target.value as LicenseType)}>
          {TIPOS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      <div className="row">
        <label>
          Desde
          <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
        </label>
        <label>
          Hasta
          <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        </label>
      </div>

      <label>
        Diagnóstico
        <textarea
          rows={3}
          value={diagnosis}
          placeholder="Ej. Lumbalgia aguda"
          onChange={(e) => setDiagnosis(e.target.value)}
        />
      </label>
      <p className="warn">
        Este dato se descarta al emitir. No entra al circuito, no va a la blockchain, no lo ve la
        empresa.
      </p>

      <button className="primary" onClick={handleIssue} disabled={loading}>
        {loading ? 'Emitiendo…' : 'Emitir credencial'}
      </button>
    </section>
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function inDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
