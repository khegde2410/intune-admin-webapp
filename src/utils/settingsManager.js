import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = 'intune-admin-app-secret-key-2025';

export const decrypt = (ciphertext) => {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    return '';
  }
};

export const getClientId = () => {
  const encrypted = localStorage.getItem('intune_client_id');
  if (encrypted) {
    return decrypt(encrypted);
  }
  // Fallback to environment variable
  return process.env.REACT_APP_CLIENT_ID || '';
};

export const getTenantId = () => {
  const encrypted = localStorage.getItem('intune_tenant_id');
  if (encrypted) {
    return decrypt(encrypted);
  }
  // Fallback to environment variable
  return process.env.REACT_APP_TENANT_ID || '';
};

export const hasConfiguration = () => {
  const clientId = getClientId();
  const tenantId = getTenantId();
  return !!(clientId && tenantId);
};
