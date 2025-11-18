import { InteractionRequiredAuthError } from '@azure/msal-browser';

/**
 * Acquires a token silently, falling back to interactive popup if consent is required.
 * @param {PublicClientApplication} instance - MSAL instance
 * @param {Array<string>} scopes - Requested scopes
 * @param {Object} account - User account
 * @returns {Promise<{accessToken: string}>} Token response
 */
export async function acquireTokenWithFallback(instance, scopes, account) {
  const request = { scopes, account };

  try {
    // Try silent first
    const response = await instance.acquireTokenSilent(request);
    return response;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      console.log('Silent token acquisition failed, attempting interactive login...');
      try {
        // Fall back to interactive popup for consent
        const response = await instance.acquireTokenPopup(request);
        return response;
      } catch (popupError) {
        console.error('Interactive token acquisition failed:', popupError);
        throw popupError;
      }
    }
    throw error;
  }
}
