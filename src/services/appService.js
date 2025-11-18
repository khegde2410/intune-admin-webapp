import graphService from './graphService';
import { endpoints } from '../utils/graphConfig';

class AppService {
  async getMobileApps(accessToken) {
    // Try Beta API first - it has more complete app data
    try {
      console.log('Fetching apps from Beta API...');
      const allApps = await graphService.callMsGraphBeta(
        `/deviceAppManagement/mobileApps`,
        accessToken
      );
      
      console.log(`Loaded ${allApps.length} total apps from Beta API`);
      console.log('All apps:', allApps.map(a => ({ 
        name: a.displayName, 
        type: a['@odata.type'],
        id: a.id
      })));
      
      return allApps;
    } catch (error) {
      console.error('Beta API failed, trying v1.0:', error);
      // Fallback to v1.0
      const allApps = await graphService.callMsGraphWithPaging(
        `${endpoints.mobileApps}`,
        accessToken
      );
      
      console.log(`Loaded ${allApps.length} total apps from v1.0 API`);
      console.log('All apps:', allApps.map(a => ({ 
        name: a.displayName, 
        type: a['@odata.type'] 
      })));
      
      return allApps;
    }
  }

  // Returns all mobile apps (no assigned filter) — useful for debugging or listing all app types
  async getAllMobileApps(accessToken) {
    return await graphService.callMsGraphWithPaging(
      `${endpoints.mobileApps}?$select=id,displayName,publisher,createdDateTime`,
      accessToken
    );
  }

  async getAppInstallStatus(accessToken, appId) {
    // Try getting app assignments first to see which devices/groups are targeted
    let assignments = [];
    try {
      console.log('Fetching app assignments for app:', appId);
      assignments = await graphService.callMsGraphBeta(
        `/deviceAppManagement/mobileApps/${appId}/assignments`,
        accessToken
      );
      console.log('App assignments:', assignments?.length);
      if (assignments && assignments.length > 0) {
        console.log('Sample assignment:', assignments[0]);
        console.log('Assignment targets:', assignments.map(a => ({
          intent: a.intent,
          targetType: a.target?.['@odata.type'],
          groupId: a.target?.groupId || 'All devices/users'
        })));
      }
    } catch (assignError) {
      console.log('Failed to fetch assignments:', assignError.response?.status);
    }

    // Try different endpoints based on app type - officeSuiteApp uses different endpoints
    try {
      console.log('Trying reports/getOfficeClientUserDetail for Office apps...');
      const officeReport = await graphService.callMsGraphBeta(
        `/reports/getOfficeClientUserDetail(period='D30')`,
        accessToken
      );
      console.log('Office reports returned:', officeReport?.length, 'records');
      if (officeReport && officeReport.length > 0) {
        // Convert to device status format
        return officeReport.slice(0, 10).map(report => ({
          deviceName: report.machineName || 'Unknown Device',
          deviceDisplayName: report.machineName || 'Unknown Device', 
          userPrincipalName: report.userPrincipalName,
          userName: report.displayName,
          osVersion: report.operatingSystem,
          status: report.isActivated ? 'installed' : 'not_activated',
          installState: report.isActivated ? 'installed' : 'not_activated',
          lastReportedDateTime: report.lastActivatedDate,
          appVersion: report.officeVersion
        }));
      }
    } catch (reportsError) {
      console.log('Office reports failed:', reportsError.response?.status);
      console.log('Error details:', JSON.stringify(reportsError.response?.data, null, 2));
    }

    // For other app types or fallback, try the standard endpoints
    try {
      console.log('Trying Beta API userStatuses for app:', appId);
      const statuses = await graphService.callMsGraphBeta(
        `/deviceAppManagement/mobileApps/${appId}/userStatuses?$expand=deviceStatuses`,
        accessToken
      );
      console.log('Beta userStatuses returned:', statuses?.length, 'records');
      console.log('Sample userStatus:', statuses?.[0]);
      if (statuses && statuses.length > 0) {
        // Flatten user statuses to device statuses
        const deviceStatuses = [];
        statuses.forEach(userStatus => {
          if (userStatus.deviceStatuses) {
            userStatus.deviceStatuses.forEach(deviceStatus => {
              deviceStatuses.push({
                ...deviceStatus,
                userPrincipalName: userStatus.userPrincipalName,
                userName: userStatus.userName
              });
            });
          }
        });
        if (deviceStatuses.length > 0) {
          console.log('Flattened device statuses:', deviceStatuses.length);
          return deviceStatuses;
        }
      }
    } catch (userStatusError) {
      console.log('Beta userStatuses failed with error:', userStatusError.response?.status);
      console.log('Error details:', JSON.stringify(userStatusError.response?.data, null, 2));
    }
  
    try {
      console.log('Trying Beta API deviceInstallStates for app:', appId);
      const statuses = await graphService.callMsGraphBeta(
        `/deviceAppManagement/mobileApps/${appId}/deviceInstallStates`,
        accessToken
      );
      console.log('Beta deviceInstallStates returned:', statuses?.length, 'records');
      console.log('Sample deviceInstallState:', statuses?.[0]);
      if (statuses && statuses.length > 0) {
        return statuses;
      }
    } catch (installStatesError) {
      console.log('Beta deviceInstallStates failed with error:', installStatesError.response?.status);
      console.log('Error details:', JSON.stringify(installStatesError.response?.data, null, 2));
    }

    try {
      // Try Beta API deviceStatuses endpoint
      console.log('Trying Beta API deviceStatuses for app:', appId);
      const statuses = await graphService.callMsGraphBeta(
        `/deviceAppManagement/mobileApps/${appId}/deviceStatuses`,
        accessToken
      );
      console.log('Beta deviceStatuses returned:', statuses?.length, 'records');
      console.log('Sample deviceStatus:', statuses?.[0]);
      if (statuses && statuses.length > 0) {
        return statuses;
      }
    } catch (betaError) {
      console.log('Beta deviceStatuses failed with error:', betaError.response?.status);
      console.log('Error details:', JSON.stringify(betaError.response?.data, null, 2));
    }

    // Try managed devices with detected apps
    try {
      console.log('Trying managed devices with detected apps...');
      
      // First try with a simpler query to see if expansion works
      const devices = await graphService.callMsGraphBeta(
        `/deviceManagement/managedDevices?$select=id,deviceName,userPrincipalName,osVersion,lastSyncDateTime&$expand=detectedApps`,
        accessToken
      );
      console.log('Managed devices with detected apps:', devices?.length);
      console.log('Sample device structure:', devices?.[0] ? {
        deviceName: devices[0].deviceName,
        hasDetectedApps: !!devices[0].detectedApps,
        detectedAppsCount: devices[0].detectedApps?.length || 0,
        detectedAppsStructure: devices[0].detectedApps?.[0]
      } : 'No devices found');
      
      if (devices && devices.length > 0) {
        const deviceStatuses = [];
        devices.forEach(device => {
          console.log(`Device ${device.deviceName}:`, {
            detectedAppsProperty: !!device.detectedApps,
            detectedAppsCount: device.detectedApps?.length || 0,
            detectedAppsData: device.detectedApps?.slice(0, 3) // Show first 3 apps
          });
          
          // Check if this device has Office/Microsoft 365 installed
          const hasOffice = device.detectedApps?.some(app => {
            const appName = (app.displayName || '').toLowerCase();
            return appName.includes('microsoft office') ||
                   appName.includes('microsoft 365') ||
                   appName.includes('office 365') ||
                   appName.includes('word') ||
                   appName.includes('excel') ||
                   appName.includes('powerpoint') ||
                   appName.includes('outlook') ||
                   appName.includes('teams');
          });
          
          console.log(`Device ${device.deviceName} has Office: ${hasOffice}`);
          
          deviceStatuses.push({
            deviceName: device.deviceName,
            deviceDisplayName: device.deviceName,
            userPrincipalName: device.userPrincipalName,
            osVersion: device.osVersion,
            status: hasOffice ? 'installed' : 'not_installed',
            installState: hasOffice ? 'installed' : 'not_installed', 
            lastReportedDateTime: device.lastSyncDateTime
          });
        });
        
        if (deviceStatuses.length > 0) {
          return deviceStatuses;
        }
      }
    } catch (devicesError) {
      console.log('Managed devices approach failed:', devicesError.response?.status);
      console.log('Error details:', JSON.stringify(devicesError.response?.data, null, 2));
    }

    // Last resort: If we have assignments, get all managed devices and return their basic status
    // This is for apps like Microsoft 365 that don't support standard status endpoints
    if (assignments && assignments.length > 0) {
      console.log('Using assignment-based fallback - fetching all managed devices');
      console.warn('Installation status unavailable due to API limitations. Showing assignment status only.');
      try {
        const devices = await graphService.callMsGraphBeta(
          `/deviceManagement/managedDevices?$select=id,deviceName,userPrincipalName,osVersion,lastSyncDateTime,complianceState`,
          accessToken
        );
        console.log(`Found ${devices?.length} managed devices for assignment-based status`);
        
        if (devices && devices.length > 0) {
          // For apps with assignments, show devices as "assigned" status
          // since we can't get actual installation status from the API
          return devices.map(device => ({
            deviceName: device.deviceName,
            deviceDisplayName: device.deviceName,
            userPrincipalName: device.userPrincipalName,
            osVersion: device.osVersion,
            status: 'assigned', // Can't determine actual install status
            installState: 'assigned',
            lastReportedDateTime: device.lastSyncDateTime,
            complianceState: device.complianceState,
            note: 'Assigned - Unable to validate installation status (API limitation)'
          }));
        }
      } catch (fallbackError) {
        console.log('Assignment-based fallback failed:', fallbackError.response?.status);
      }
    }

    console.error('Unable to retrieve installation status for this app. All API endpoints returned errors or no data.');
    throw new Error('Unable to retrieve installation status. This app type may not support status reporting via Microsoft Graph API.');
  }

  // Get detected apps on a specific managed device
  async getDeviceDetectedApps(accessToken, deviceId) {
    return await graphService.callMsGraphWithPaging(
      `/deviceManagement/managedDevices/${deviceId}/detectedApps`,
      accessToken
    );
  }

  // Get user install statuses (alternative to device statuses)
  async getAppUserInstallStatus(accessToken, appId) {
    try {
      console.log('Trying userStatuses endpoint...');
      const statuses = await graphService.callMsGraphBeta(
        `/deviceAppManagement/mobileApps/${appId}/userStatuses`,
        accessToken
      );
      console.log('userStatuses returned:', statuses?.length, 'records');
      return statuses;
    } catch (error) {
      console.error('userStatuses failed:', error.message);
      throw error;
    }
  }

  // Get all managed devices with their detected apps
  async getManagedDevicesWithApps(accessToken) {
    return await graphService.callMsGraphWithPaging(
      '/deviceManagement/managedDevices?$select=id,deviceName,userPrincipalName,operatingSystem,osVersion,lastSyncDateTime',
      accessToken
    );
  }

  // Get install status for an app across all devices (alternative approach)
  async getAppInstallStatusByDevices(accessToken, appId) {
    try {
      // First try the standard deviceStatuses endpoint
      return await this.getAppInstallStatus(accessToken, appId);
    } catch (error) {
      console.log('deviceStatuses failed, trying alternative approach:', error.message);
      // Fallback: get all devices and check detected apps
      const devices = await this.getManagedDevicesWithApps(accessToken);
      const statuses = [];
      
      for (const device of devices) {
        try {
          const detectedApps = await this.getDeviceDetectedApps(accessToken, device.id);
          const appFound = detectedApps.find(app => app.id === appId);
          
          if (appFound) {
            statuses.push({
              deviceName: device.deviceName,
              deviceDisplayName: device.deviceName,
              userPrincipalName: device.userPrincipalName,
              osVersion: device.osVersion,
              status: 'installed',
              installState: 'installed',
              lastReportedDateTime: device.lastSyncDateTime
            });
          }
        } catch (err) {
          console.warn(`Failed to get detected apps for device ${device.deviceName}:`, err.message);
        }
      }
      
      return statuses;
    }
  }

  async getAppInstallSummary(accessToken, appId) {
    const statuses = await this.getAppInstallStatus(accessToken, appId);
    
    const summary = {
      total: statuses.length,
      installed: 0,
      failed: 0,
      pending: 0,
      notApplicable: 0,
      assigned: 0,
      notInstalled: 0,
      unknown: 0,
    };

    statuses.forEach(status => {
      // deviceStatuses may expose `status` instead of `installState` depending on resource type
      const installState = (status.installState || status.status || '').toLowerCase();
      switch (installState) {
        case 'installed':
          summary.installed++;
          break;
        case 'failed':
          summary.failed++;
          break;
        case 'installing':
        case 'pending':
        case 'pendinginstall':
          summary.pending++;
          break;
        case 'assigned':
          summary.assigned++;
          break;
        case 'not_installed':
        case 'notinstalled':
          summary.notInstalled++;
          break;
        case 'notapplicable':
          summary.notApplicable++;
          break;
        default:
          summary.unknown++;
      }
    });

    return summary;
  }
}

export default new AppService();
