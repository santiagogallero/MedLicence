export * from './types.js';
export * from './encoding.js';
export { MockMedLicenseApi, type MockOptions } from './mock.js';
export {
  LicenseAlreadyUsedError,
  MidnightMedLicenseApi,
  type MedLicenseProviders,
} from './midnight.js';

/**
 * Instancia única compartida por toda la demo. Sigue siendo el mock por
 * default: el front importa `api` y no cambia nada hasta que alguien pise
 * esta línea a propósito (avisando antes, por la regla de arriba).
 *
 * La versión real requiere setup async (wallet, providers, dirección del
 * contrato deployado), así que no entra en un `export const` síncrono como
 * este. Usar `MidnightMedLicenseApi.connect(providers, contractAddress)` o
 * `.deploy(...)` desde `cli/` y pasar esa instancia donde haga falta.
 */
import { MockMedLicenseApi } from './mock.js';
import type { MedLicenseApi } from './types.js';

export const api: MedLicenseApi = new MockMedLicenseApi();
