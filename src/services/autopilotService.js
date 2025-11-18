import graphService from './graphService';
import { endpoints } from '../utils/graphConfig';

class AutopilotService {
  async getAutopilotDevices(accessToken) {
    // Get registered Autopilot devices (windowsAutopilotDeviceIdentities)
    // These are devices that have completed registration
    try {
      return await graphService.callMsGraphWithPaging(
        `${endpoints.autopilotDevices}`,
        accessToken
      );
    } catch (error) {
      console.error('Error fetching autopilot devices:', error);
      // If no devices found or endpoint fails, return empty array
      if (error.response?.status === 404 || error.response?.status === 400) {
        return [];
      }
      throw error;
    }
  }

  async getImportedDevices(accessToken) {
    // Get imported devices (upload status)
    return await graphService.callMsGraphWithPaging(
      `${endpoints.importAutopilotDevices}`,
      accessToken
    );
  }

  async uploadAutopilotHash(accessToken, deviceData) {
    // deviceData should be an array of objects with: serialNumber, hardwareIdentifier, groupTag (optional)
    const importData = deviceData.map(device => ({
      '@odata.type': '#microsoft.graph.importedWindowsAutopilotDeviceIdentity',
      serialNumber: device.serialNumber,
      hardwareIdentifier: device.hardwareIdentifier,
      groupTag: device.groupTag || '',
      assignedUserPrincipalName: device.assignedUserPrincipalName || '',
    }));

    const promises = importData.map(data =>
      graphService.callMsGraph(
        endpoints.importAutopilotDevices,
        accessToken,
        'POST',
        data
      )
    );

    return await Promise.allSettled(promises);
  }

  async deleteAutopilotDevice(accessToken, deviceId) {
    return await graphService.callMsGraph(
      `${endpoints.autopilotDevices}/${deviceId}`,
      accessToken,
      'DELETE'
    );
  }

  async getImportStatus(accessToken) {
    return await graphService.callMsGraphWithPaging(
      `${endpoints.importAutopilotDevices}?$select=id,serialNumber,importedDateTime,state`,
      accessToken
    );
  }

  async deleteImportedDevice(accessToken, deviceId) {
    return await graphService.callMsGraph(
      `${endpoints.importAutopilotDevices}/${deviceId}`,
      accessToken,
      'DELETE'
    );
  }
}

export default new AutopilotService();
