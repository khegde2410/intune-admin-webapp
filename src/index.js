import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { PublicClientApplication, EventType } from '@azure/msal-browser';
import { msalConfig } from './utils/authConfig';
import { hasConfiguration } from './utils/settingsManager';

import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/App.css';

// Only initialize MSAL if configuration exists
let msalInstance;

if (hasConfiguration()) {
  console.log('MSAL Config:', {
    clientId: msalConfig.auth.clientId,
    authority: msalConfig.auth.authority,
    redirectUri: msalConfig.auth.redirectUri,
  });

  msalInstance = new PublicClientApplication(msalConfig);

  // Default to using the first account if no account is active
  if (!msalInstance.getActiveAccount() && msalInstance.getAllAccounts().length > 0) {
    msalInstance.setActiveAccount(msalInstance.getAllAccounts()[0]);
  }

  // Listen for sign-in event and set active account
  msalInstance.addEventCallback((event) => {
    if (event.eventType === EventType.LOGIN_SUCCESS && event.payload.account) {
      const account = event.payload.account;
      msalInstance.setActiveAccount(account);
    }
  });
} else {
  console.log('No configuration found. MSAL will not be initialized until settings are configured.');
  // Create a minimal MSAL instance for Settings page only
  msalInstance = new PublicClientApplication({
    auth: {
      clientId: 'not-configured',
      authority: 'https://login.microsoftonline.com/common',
      redirectUri: window.location.origin,
    },
    cache: {
      cacheLocation: 'sessionStorage',
      storeAuthStateInCookie: false,
    },
  });
}

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App instance={msalInstance} />
  </React.StrictMode>
);
