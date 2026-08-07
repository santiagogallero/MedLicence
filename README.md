# medlicense

Credenciales médicas verificables en zero-knowledge sobre Midnight Network.

Un médico emite una licencia como un **commitment** dentro de un Merkle tree;
solo el **root** va on-chain. El trabajador prueba en ZK que tiene una credencial
válida para un período, sin revelar diagnóstico ni identidad. Un **nullifier**
calculado dentro del circuito impide reusar la misma credencial.

Pitch completo en [`../pitch-midnight.md`](../pitch-midnight.md).

---

## Arrancar (los dos, 2 minutos)

```bash
npm install     # en la raíz — es un monorepo con workspaces
npm run dev     # levanta la UI en http://localhost:5173
```

La demo **ya funciona end-to-end** con un mock: emitir → probar → verificar,
incluido el rechazo por reuso. No hace falta Docker, ni wallet, ni el compiler.

---

## Cómo está dividido

| Carpeta     | Dueño   | Qué hay                                              |
| ----------- | ------- | ---------------------------------------------------- |
| `contract/` | back    | `medlicense.compact` — el circuito ZK                 |
| `api/`      | back    | La interfaz compartida + el mock + (luego) el real    |
| `cli/`      | back    | Scripts de deploy y prueba manual                     |
| `ui/`       | front   | React + Vite, las 3 pantallas de la demo              |

### La regla que hace que esto funcione

**`api/src/types.ts` es la frontera.** El front programa contra la interfaz
`MedLicenseApi` importando `api` desde `@medlicense/api`. El back reemplaza la
implementación (mock → Midnight real) y el front no cambia una línea.

Si algo de `types.ts` tiene que cambiar, se avisa **antes** de tocarlo.

### Front — qué hacer

Las 3 pantallas ya están cableadas al mock en `ui/src/screens/`. El trabajo es
diseño y narrativa, no lógica:

1. `ClinicScreen` — el médico emite. Que se note que el diagnóstico se descarta.
2. `WorkerScreen` — un botón. Que se vea que el trabajador no necesita saber nada de cripto.
3. `CompanyScreen` — **la pantalla que vende el proyecto.** El `✅ Certificado válido` con
   tipo y período, y el hueco donde debería estar el diagnóstico. Acá va el tiempo.

`ui/src/styles.css` es un placeholder feo a propósito. Reemplazalo entero.

Para probar los casos de error, verificá dos veces la misma prueba: el segundo
intento devuelve `ALREADY_USED`.

### Back — qué hacer

1. `compact compile` sobre `contract/src/medlicense.compact` hasta que pase
2. Proof server en Docker (`:6300`)
3. Implementar `MidnightMedLicenseApi` en `api/src/` con la misma interfaz
4. Deploy a Preprod + wallet con tDUST
5. Cambiar la línea de `api/src/index.ts` que elige mock vs real

---

## Requisitos solo para el back

- Node 22+
- `compact` toolchain
- Docker: `docker run -d -p 6300:6300 midnightntwrk/proof-server:8.0.3 -- midnight-proof-server -v`
- Lace Wallet en Preprod con tDUST del faucet

---

## Plan B (importante)

Si el ZK real no llega a tiempo, la demo con mock funciona igual y el contrato
Compact se muestra como código. Nunca quedamos sin nada que presentar.
