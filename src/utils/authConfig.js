import { LogLevel } from '@azure/msal-browser';
import { getClientId, getTenantId } from './settingsManager';

export const msalConfig = {
  auth: {
    clientId: getClientId() || process.env.REACT_APP_CLIENT_ID || 'not-configured',
    authority: `https://login.microsoftonline.com/${getTenantId() || process.env.REACT_APP_TENANT_ID || 'common'}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: '/',
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        switch (level) {
          case LogLevel.Error:
            console.error(message);
            return;
          case LogLevel.Info:
            console.info(message);
            return;
          case LogLevel.Verbose:
            console.debug(message);
            return;
          case LogLevel.Warning:
            console.warn(message);
            return;
          default:
            return;
        }
      },
    },
  },
};

export const loginRequest = {
  scopes: ['User.Read'],
};

export const graphScopes = {
  deviceManagement: ['https://graph.microsoft.com/DeviceManagementManagedDevices.ReadWrite.All'],
  autopilot: ['https://graph.microsoft.com/DeviceManagementServiceConfig.ReadWrite.All'],
  deviceApps: ['https://graph.microsoft.com/DeviceManagementApps.Read.All'],
  devices: ['https://graph.microsoft.com/Device.ReadWrite.All'],
  directory: ['https://graph.microsoft.com/Directory.Read.All'],
  azureAD: ['https://graph.microsoft.com/Device.ReadWrite.All'],
  groups: ['https://graph.microsoft.com/Group.Read.All', 'https://graph.microsoft.com/GroupMember.ReadWrite.All'],
};
