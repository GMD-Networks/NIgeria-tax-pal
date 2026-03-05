import type { IBackendService, BackendType } from './types';
import { cpanelPhpService } from './cpanel-php';

const ACTIVE_BACKEND: BackendType = 'cpanel-php';

export function getBackendService(): IBackendService {
  return ACTIVE_BACKEND === 'cpanel-php' ? cpanelPhpService : cpanelPhpService;
}

export const backendService = getBackendService();

export type { IBackendService, BackendType };
export { cpanelPhpService };
