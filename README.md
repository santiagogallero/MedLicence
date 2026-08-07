# medlicense

**Zero-knowledge verifiable medical leave certificates, on Midnight Network.**

> 🇬🇧 English · [🇪🇸 Español ↓](#español)

---

## English

A company needs to know an employee's medical leave is genuine. Today the only
way to prove it is to hand over a certificate that also exposes the diagnosis —
a health record, which under Argentine law (Ley 25.326) is *sensitive data*
with reinforced protection. So the system fails twice over: it leaks what it
shouldn't, and it still doesn't stop forgery — there is a live black market for
fake medical certificates.

medlicense fixes both with one cryptographic primitive.

A doctor issues a leave certificate as a **commitment** inside their own Merkle
tree; only the **root** goes on-chain. The worker proves in zero-knowledge that
they hold a valid credential for a given period, revealing **neither the
diagnosis nor their identity**. A **nullifier** computed inside the circuit
makes the credential single-use, so it can't be replayed.

The company sees exactly this and nothing more:

```
✅ Valid certificate
   Type:   MEDICAL LEAVE
   Period: 2026-03-01 → 2026-03-07
```

There is no PDF and no stamp to forge — validity lives in the proof, not in the
paper.

### Who pays for what

The company pays only the **gas to verify the proof on-chain** — never the
medical opinion. That separation is deliberate: a company paying the doctor who
decides whether an employee is sick would be a conflict of interest. It also
solves the UX problem that kills most crypto projects: the worker needs no
wallet, no tokens, no understanding of blockchain. One button.

### Quick start (2 minutes, no blockchain setup)

```bash
npm install     # monorepo with npm workspaces
npm run dev     # UI at http://localhost:5173
```

The demo already runs **end-to-end against a mock**: issue → prove → verify,
including replay rejection. No Docker, no wallet, no compiler needed.

### Structure

Architecture inspired by [midnightntwrk/example-bboard](https://github.com/midnightntwrk/example-bboard)
— not a fork; the contract and logic are written from scratch for this use case.

| Folder      | Owner    | Contents                                                     |
| ----------- | -------- | ------------------------------------------------------------ |
| `contract/` | backend  | `medlicense.compact` — issuer Merkle root, membership check, anti-replay nullifier set |
| `api/`      | backend  | Shared interface + in-memory mock + real Midnight wrapper (providers, wallet, deploy/join) |
| `cli/`      | backend  | Issue credentials (doctor role), generate and submit proofs (worker/company roles) |
| `ui/`       | frontend | React + Vite, the three demo screens                          |

### The rule that keeps front and back unblocked

**`api/src/types.ts` is the boundary.** The frontend codes against the
`MedLicenseApi` interface, importing `api` from `@medlicense/api`. The backend
swaps the implementation (mock → real Midnight) and the frontend changes nothing.

If anything in `types.ts` needs to change, tell the other person **before**
touching it.

### Frontend — what to do

The three screens are already wired to the mock in `ui/src/screens/`. The work
is design and narrative, not logic:

1. `ClinicScreen` — the doctor issues. Make it visible that the diagnosis is discarded.
2. `WorkerScreen` — one button. Make it obvious no crypto knowledge is required.
3. `CompanyScreen` — **the screen that sells the project.** The `✅ Valid certificate`
   with type and period, and the conspicuous absence where the diagnosis would be.
   Spend the time here.

`ui/src/styles.css` is a deliberately plain placeholder. Replace it entirely.

To exercise the failure states, verify the same proof twice — the second attempt
returns `ALREADY_USED`.

### Backend — what to do

1. Get `contract/src/medlicense.compact` through `compact compile`
2. Proof server running in Docker on `:6300`
3. Implement `MidnightMedLicenseApi` in `api/src/` behind the same interface
4. Deploy to Preprod with a tDUST-funded wallet
5. Flip the mock/real line in `api/src/index.ts`

### Backend-only requirements

- Node 22+
- `compact` toolchain, pinned to the current [compatibility matrix](https://docs.midnight.network)
- Docker: `docker run -d -p 6300:6300 midnightntwrk/proof-server:8.0.3 -- midnight-proof-server -v`
- Lace Wallet on Preprod, funded from the faucet

```bash
docker run -d -p 6300:6300 midnightntwrk/proof-server:8.0.3 -- midnight-proof-server -v
compact --version
npm install
```

### Fallback plan

If the real ZK stack doesn't land in time, the mock demo still runs end-to-end
and the Compact contract is shown as code. We are never left with nothing to
present.

### Status

Initial scaffold — MVP under construction (hackathon, hard time limit).

---

## Español

Una empresa necesita saber que la licencia médica de un empleado es real. Hoy la
única forma de probarlo es entregar un certificado que además expone el
diagnóstico — un dato de salud, que según la Ley 25.326 es *dato sensible* con
protección reforzada. El sistema falla dos veces: filtra lo que no debería, y
igual no frena el fraude — existe un mercado negro activo de certificados truchos.

medlicense resuelve las dos cosas con una sola pieza criptográfica.

Un médico o clínica emite una licencia como un **commitment** dentro de un Merkle
tree propio; solo publica el **root** on-chain. El trabajador prueba en
zero-knowledge que posee una credencial válida para un período, **sin revelar
diagnóstico ni identidad**. Un **nullifier** calculado dentro del circuito impide
el reuso de la misma credencial.

La empresa ve exactamente esto y nada más:

```
✅ Certificado válido
   Tipo:    LICENCIA MÉDICA
   Período: 2026-03-01 → 2026-03-07
```

No hay PDF ni sello que falsificar — la validez está en la prueba, no en el papel.

### Quién paga qué

La empresa paga solamente el **gas de verificar la prueba on-chain**, nunca el
veredicto médico. Esa separación es deliberada: que la empresa le pague al médico
que decide si el empleado está enfermo sería un conflicto de interés. Además
resuelve el problema de UX que mata a la mayoría de los proyectos cripto: el
trabajador no necesita wallet, ni tokens, ni entender de blockchain. Un botón.

### Arrancar (2 minutos, sin setup de blockchain)

```bash
npm install     # monorepo con npm workspaces
npm run dev     # UI en http://localhost:5173
```

La demo **ya funciona end-to-end contra un mock**: emitir → probar → verificar,
incluido el rechazo por reuso. No hace falta Docker, ni wallet, ni el compiler.

### Estructura

Arquitectura inspirada en [midnightntwrk/example-bboard](https://github.com/midnightntwrk/example-bboard)
— no es un fork; el contrato y la lógica están escritos desde cero para este caso de uso.

| Carpeta     | Dueño   | Contenido                                                     |
| ----------- | ------- | ------------------------------------------------------------- |
| `contract/` | back    | `medlicense.compact` — Merkle root del emisor, verificación de membership, nullifier set anti-reuso |
| `api/`      | back    | Interfaz compartida + mock in-memory + wrapper real de Midnight (providers, wallet, deploy/join) |
| `cli/`      | back    | Emitir credenciales (rol médico), generar y enviar pruebas (roles trabajador/empresa) |
| `ui/`       | front   | React + Vite, las tres pantallas de la demo                    |

### La regla que mantiene a front y back desbloqueados

**`api/src/types.ts` es la frontera.** El front programa contra la interfaz
`MedLicenseApi` importando `api` desde `@medlicense/api`. El back reemplaza la
implementación (mock → Midnight real) y el front no cambia una línea.

Si algo de `types.ts` tiene que cambiar, se avisa al otro **antes** de tocarlo.

### Front — qué hacer

Las tres pantallas ya están cableadas al mock en `ui/src/screens/`. El trabajo es
diseño y narrativa, no lógica:

1. `ClinicScreen` — el médico emite. Que se note que el diagnóstico se descarta.
2. `WorkerScreen` — un botón. Que se vea que el trabajador no necesita saber nada de cripto.
3. `CompanyScreen` — **la pantalla que vende el proyecto.** El `✅ Certificado válido`
   con tipo y período, y el hueco evidente donde debería estar el diagnóstico.
   Acá va el tiempo.

`ui/src/styles.css` es un placeholder plano a propósito. Reemplazalo entero.

Para probar los casos de error, verificá dos veces la misma prueba: el segundo
intento devuelve `ALREADY_USED`.

### Back — qué hacer

1. Pasar `contract/src/medlicense.compact` por `compact compile`
2. Proof server corriendo en Docker en `:6300`
3. Implementar `MidnightMedLicenseApi` en `api/src/` detrás de la misma interfaz
4. Deploy a Preprod con una wallet con tDUST
5. Cambiar la línea de mock/real en `api/src/index.ts`

### Requisitos solo para el back

- Node 22+
- `compact` toolchain, pineado a la [matriz de compatibilidad](https://docs.midnight.network) vigente
- Docker: `docker run -d -p 6300:6300 midnightntwrk/proof-server:8.0.3 -- midnight-proof-server -v`
- Lace Wallet en modo Preprod, con tDUST del faucet

```bash
docker run -d -p 6300:6300 midnightntwrk/proof-server:8.0.3 -- midnight-proof-server -v
compact --version
npm install
```

### Plan B

Si el stack ZK real no llega a tiempo, la demo con mock funciona igual end-to-end
y el contrato Compact se muestra como código. Nunca quedamos sin nada que presentar.

### Estado

Scaffold inicial — MVP en construcción (hackathon, tiempo acotado).
