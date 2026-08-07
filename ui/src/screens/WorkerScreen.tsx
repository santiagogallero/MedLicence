import { useState } from 'react';
import { api, type Credential, type LicenseProof } from '@medlicense/api';

/**
 * PANTALLA 2 — el trabajador genera la prueba desde su celular.
 *
 * No necesita wallet ni criptomonedas: solo aprieta un botón. La prueba se
 * arma localmente contra el proof server.
 */
export default function WorkerScreen({
  credential,
  onProofReady,
}: {
  credential: Credential | null;
  onProofReady: (p: LicenseProof) => void;
}) {
  const [loading, setLoading] = useState(false);

  if (!credential) {
    return (
      <section className="card">
        <h2>Mi licencia</h2>
        <p className="muted">Todavía no tenés ninguna credencial. Emitila desde la pantalla 1.</p>
      </section>
    );
  }

  async function handleGenerate() {
    setLoading(true);
    try {
      onProofReady(await api.generateProof(credential!));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card">
      <h2>Mi licencia</h2>

      <dl className="kv">
        <dt>Tipo</dt>
        <dd>{credential.licenseType}</dd>
        <dt>Período</dt>
        <dd>
          {credential.periodStart} → {credential.periodEnd}
        </dd>
        <dt>Emisor</dt>
        <dd>{credential.issuerId}</dd>
        <dt>Secreto</dt>
        <dd className="mono truncate">{credential.secret}</dd>
      </dl>

      <p className="muted">
        El secreto vive solo en este dispositivo. La empresa nunca lo recibe.
      </p>

      <button className="primary" onClick={handleGenerate} disabled={loading}>
        {loading ? 'Generando prueba…' : 'Solicitar licencia en mi trabajo'}
      </button>
    </section>
  );
}
