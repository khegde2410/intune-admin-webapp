export const graphConfig = {
  graphMeEndpoint: 'https://graph.microsoft.com/v1.0/me',
  graphApiVersion: 'v1.0',
  betaApiVersion: 'beta',
};

export const endpoints = {
  // Device Management
  managedDevices: '/deviceManagement/managedDevices',
  
  // Autopilot
  autopilotDevices: '/deviceManagement/windowsAutopilotDeviceIdentities',
  importAutopilotDevices: '/deviceManagement/importedWindowsAutopilotDeviceIdentities',
  
  // Azure AD Devices
  devices: '/devices',
  
  // Applications
  // Intune app management lives under deviceAppManagement
  mobileApps: '/deviceAppManagement/mobileApps',
  appInstallStatus: (appId) => `/deviceAppManagement/mobileApps/${appId}/deviceStatuses`,
  appUserInstallStatus: (appId) => `/deviceAppManagement/mobileApps/${appId}/userStatuses`,
  userMobileAppInstallStatus: (userId) => `/deviceAppManagement/users/${userId}/mobileAppInstallStatus`,
  
  // Users
  users: '/users',
  
  // Azure AD Groups
  groups: '/groups',
  groupMembers: (groupId) => `/groups/${groupId}/members`,
};
