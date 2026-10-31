import * as api from '../../lib/bridge/mail';

export function accountErrorKey(providerCode: string | null, error: unknown) {
  const code = api.errorCode(error);
  if (providerCode === 'gmail') {
    if (code === 'AUTH_INVALID') return 'gmailAuthenticationFailed';
    if (code === 'NETWORK_FAILED') return 'gmailNetworkFailed';
  }
  return api.errorKeys[code];
}
