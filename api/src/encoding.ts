/**
 * Conversión entre los tipos "humanos" de la interfaz (`api/src/types.ts`) y
 * los `Bytes<32>` que espera el contrato Compact.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

/** UTF-8 → 32 bytes, rellenado con ceros. Tira si no entra. */
export function toBytes32(input: string): Uint8Array {
  const bytes = enc.encode(input);
  if (bytes.length > 32) {
    throw new Error(`"${input}" no entra en Bytes<32> (${bytes.length} bytes)`);
  }
  const out = new Uint8Array(32);
  out.set(bytes);
  return out;
}

/** Inverso de toBytes32: recorta el padding de ceros y decodifica UTF-8. */
export function fromBytes32(bytes: Uint8Array): string {
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) end--;
  return dec.decode(bytes.subarray(0, end));
}

export function randomBytes32(): Uint8Array {
  const out = new Uint8Array(32);
  crypto.getRandomValues(out);
  return out;
}

/** El root de un HistoricMerkleTree es un MerkleTreeDigest = { field: bigint }. */
export function fieldToHex(field: bigint): string {
  const bytes = new Uint8Array(32);
  let value = field;
  for (let i = 31; i >= 0; i--) {
    bytes[i] = Number(value & 0xffn);
    value >>= 8n;
  }
  return toHex(bytes);
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function fromHex(hex: string): Uint8Array {
  const clean = hex.length % 2 === 0 ? hex : `0${hex}`;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * `period` en el contrato es un solo Bytes<32>, pero la interfaz maneja
 * periodStart/periodEnd por separado. Se concatenan con un separador que no
 * puede aparecer en un ISO date. Dos fechas de 10 chars + '|' = 21 bytes,
 * entra cómodo en 32.
 */
export function encodePeriod(periodStart: string, periodEnd: string): Uint8Array {
  return toBytes32(`${periodStart}|${periodEnd}`);
}

export function decodePeriod(bytes: Uint8Array): { periodStart: string; periodEnd: string } {
  const [periodStart, periodEnd] = fromBytes32(bytes).split('|');
  return { periodStart, periodEnd };
}
