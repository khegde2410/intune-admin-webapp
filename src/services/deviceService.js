import graphService from './graphService';
import { endpoints } from '../utils/graphConfig';

class DeviceService {
  async getManagedDevices(accessToken) {
    return await graphService.callMsGraphWithPaging(
      `${endpoints.managedDevices}?$select=id,deviceName,userPrincipalName,operatingSystem,complianceState,lastSyncDateTime,managedDeviceOwnerType,azureADDeviceId`,
      accessToken
    );
  }

  async getDeviceById(accessToken, deviceId) {
    return await graphService.callMsGraph(
      `${endpoints.managedDevices}/${deviceId}`,
      accessToken
    );
  }

  async deleteIntuneDevice(accessToken, deviceId) {
    return await graphService.callMsGraph(
      `${endpoints.managedDevices}/${deviceId}`,
      accessToken,
      'DELETE'
    );
  }

  async getAzureADDevices(accessToken) {
    return await graphService.callMsGraphWithPaging(
      `${endpoints.devices}?$select=id,displayName,operatingSystem,operatingSystemVersion,approximateLastSignInDateTime,accountEnabled,deviceId`,
      accessToken
    );
  }

  async deleteAzureADDevice(accessToken, deviceId) {
    return await graphService.callMsGraph(
      `${endpoints.devices}/${deviceId}`,
      accessToken,
      'DELETE'
    );
  }

  async searchDevice(accessToken, searchTerm) {
    const intuneDevices = await this.getManagedDevices(accessToken);
    const filtered = intuneDevices.filter(device => 
      device.deviceName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      device.userPrincipalName?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return filtered;
  }

  async getStaleDevices(accessToken, daysThreshold = 30) {
    const devices = await this.getManagedDevices(accessToken);
    const now = new Date();
    
    return devices.filter(device => {
      if (!device.lastSyncDateTime) return true;
      const lastSync = new Date(device.lastSyncDateTime);
      const daysDiff = Math.floor((now - lastSync) / (1000 * 60 * 60 * 24));
      return daysDiff > daysThreshold;
    });
  }
}

export default new DeviceService();
