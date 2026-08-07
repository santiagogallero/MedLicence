import { useState } from 'react';
import { api, type LicenseProof, type VerificationResult } from '@medlicense/api';

/**
 * PANTALLA 3 — la empresa verifica.
 *
 * Es la pantalla que vende el proyecto: se ve un ✅ con tipo y período,
 * y NADA más. Vale la pena invertir el tiempo de diseño acá.
 */
export default function CompanyScreen({ proof }: { proof: LicenseProof | null }) {
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);

  if (!proof) {
    return (
      <section className="card">
        <h2>Verificación de licencia</h2>
        <p className="muted">No hay ninguna solicitud pendiente.</p>
      </section>
    );
  }

  async function handleVerify() {
    setLoading(true);
    try {
      setResult(await api.verifyProof(proof!));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card">
      <h2>Verificación de licencia</h2>
      <p className="muted">Solicitud recibida de un empleado. Verificar en la red.</p>

      <button className="primary" onClick={handleVerify} disabled={loading}>
        {loading ? 'Verificando on-chain…' : 'Verificar'}
      </button>

      {result && !result.valid && (
        <div className="result invalid">
          <strong>❌ No válida</strong>
          <p>{motivo(result.reason)}</p>
        </div>
      )}

      {result?.valid && (
        <div className="result valid">
          <strong>✅ Certificado válido</strong>
          <dl className="kv">
            <dt>Tipo</dt>
            <dd>{result.licenseType}</dd>
            <dt>Período</dt>
            <dd>
              {result.periodStart} → {result.periodEnd}
            </dd>
            <dt>Tx</dt>
            <dd className="mono truncate">{result.txHash}</dd>
          </dl>
          <p className="muted">
            Diagnóstico: no disponible — y no hay forma de obtenerlo desde acá.
          </p>
        </div>
      )}
    </section>
  );
}

function motivo(reason?: VerificationResult['reason']) {
  switch (reason) {
    case 'ALREADY_USED':
      return 'Esta credencial ya fue presentada antes. No se puede reutilizar.';
    case 'UNKNOWN_ISSUER':
      return 'El emisor no está registrado en la red.';
    case 'EXPIRED':
      return 'El período de la licencia ya venció.';
    default:
      return 'La prueba criptográfica no es válida.';
  }
}
