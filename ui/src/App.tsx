import { useState } from 'react';
import type { Credential, LicenseProof } from '@medlicense/api';
import ClinicScreen from './screens/ClinicScreen.js';
import WorkerScreen from './screens/WorkerScreen.js';
import CompanyScreen from './screens/CompanyScreen.js';

type Role = 'clinica' | 'trabajador' | 'empresa';

/**
 * Estado compartido de la demo.
 *
 * En la vida real cada actor corre en un dispositivo distinto: la credencial
 * vive en el celular del trabajador y la prueba viaja a la empresa. Acá los
 * tres roles conviven en una pantalla para poder demostrarlo en 90 segundos.
 */
export default function App() {
  const [role, setRole] = useState<Role>('clinica');
  const [credential, setCredential] = useState<Credential | null>(null);
  const [proof, setProof] = useState<LicenseProof | null>(null);

  return (
    <div className="app">
      <header>
        <h1>MedLicense</h1>
        <p className="tagline">
          Licencias médicas verificables — la empresa confirma que es real sin ver el diagnóstico.
        </p>
      </header>

      <nav className="roles">
        {(['clinica', 'trabajador', 'empresa'] as Role[]).map((r) => (
          <button
            key={r}
            className={role === r ? 'role active' : 'role'}
            onClick={() => setRole(r)}
          >
            {r === 'clinica' && '1 · Clínica'}
            {r === 'trabajador' && '2 · Trabajador'}
            {r === 'empresa' && '3 · Empresa'}
          </button>
        ))}
      </nav>

      <main>
        {role === 'clinica' && (
          <ClinicScreen
            onIssued={(c) => {
              setCredential(c);
              setProof(null);
              setRole('trabajador');
            }}
          />
        )}

        {role === 'trabajador' && (
          <WorkerScreen
            credential={credential}
            onProofReady={(p) => {
              setProof(p);
              setRole('empresa');
            }}
          />
        )}

        {role === 'empresa' && <CompanyScreen proof={proof} />}
      </main>
    </div>
  );
}
