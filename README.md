# medlicense

Credenciales médicas verificables en zero-knowledge sobre Midnight Network.

Un médico/clínica emite una credencial (licencia médica) como un commitment
dentro de un Merkle tree propio; solo publica el **root** on-chain. El
trabajador prueba en ZK que posee una credencial válida para un período,
sin revelar diagnóstico ni identidad. Un **nullifier** calculado dentro del
circuito impide el reuso de la misma credencial.

Ver pitch completo en [`../pitch-midnight.md`](../pitch-midnight.md).

## Estructura

Inspirada en [midnightntwrk/example-bboard](https://github.com/midnightntwrk/example-bboard)
como referencia de arquitectura (no es un fork — contrato y lógica escritos
desde cero para este caso de uso):

- `contract/` — contrato Compact (`medlicense.compact`): Merkle root del
  emisor + verificación de membership + nullifier set anti-reuso.
- `api/` — wrapper TS sobre el contrato compilado (providers, wallet, deploy/join).
- `cli/` — CLI para emitir credenciales (rol médico) y generar/enviar pruebas (rol trabajador/empresa).
- `ui/` — interfaz mínima de demo.

## Setup local

Requisitos: Node 22+, `compact` (compiler, pineado a la versión de la
[matriz de compatibilidad](https://docs.midnight.network) vigente), `yarn`,
Docker con `midnightntwrk/proof-server:8.0.3` corriendo en `:6300`, Lace
Wallet en modo Preprod con tDUST del faucet.

```bash
docker run -d -p 6300:6300 midnightntwrk/proof-server:8.0.3 -- midnight-proof-server -v
compact --version   # confirmar versión del compiler
yarn install
```

## Estado

Scaffold inicial — MVP en construcción (hackathon, tiempo real acotado).
