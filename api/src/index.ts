export * from './types.js';
export { MockMedLicenseApi, type MockOptions } from './mock.js';

/**
 * Instancia única compartida por toda la demo.
 *
 * Cuando el back tenga la implementación real, esto pasa a ser algo como:
 *
 *   export const api: MedLicenseApi = import.meta.env.VITE_USE_MOCK === 'true'
 *     ? new MockMedLicenseApi()
 *     : new MidnightMedLicenseApi(providers);
 *
 * El front sigue importando `api` y no cambia nada.
 */
import { MockMedLicenseApi } from './mock.js';
import type { MedLicenseApi } from './types.js';

export const api: MedLicenseApi = new MockMedLicenseApi();
