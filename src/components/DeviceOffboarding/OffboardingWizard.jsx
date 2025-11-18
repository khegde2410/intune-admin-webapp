import React, { useState } from 'react';
import { Card, Form, Button, Alert, Table, Badge, Modal } from 'react-bootstrap';
import { useMsal } from '@azure/msal-react';
import deviceService from '../../services/deviceService';
import autopilotService from '../../services/autopilotService';
import { graphScopes } from '../../utils/authConfig';
import { acquireTokenWithFallback } from '../../utils/msalHelper';
import { FaCheckCircle, FaTimesCircle, FaSpinner } from 'react-icons/fa';

const OffboardingWizard = () => {
  const { instance, accounts } = useMsal();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState(null);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [deviceStatus, setDeviceStatus] = useState(null);
  const [offboarding, setOffboarding] = useState(false);
  const [offboardResults, setOffboardResults] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSearch = async () => {
    setSearchError(null);
    if (!searchTerm.trim()) return;

    console.log('Searching for:', searchTerm);

    try {
      const response = await acquireTokenWithFallback(
        instance,
        graphScopes.deviceManagement,
        accounts[0]
      );
      console.log('Search token scopes:', response.scopes);
      const results = await deviceService.searchDevice(response.accessToken, searchTerm);
      console.log('Search returned count:', results?.length);
      setSearchResults(results || []);
      if (!results || results.length === 0) {
        setSearchError('No devices found matching the search term');
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchError(error.response?.data || error.message || String(error));
    }
  };

  const checkDeviceStatus = async (device) => {
    setSelectedDevice(device);
    setDeviceStatus({ checking: true });

    try {
      const response = await acquireTokenWithFallback(
        instance,
        [...graphScopes.deviceManagement, ...graphScopes.autopilot, ...graphScopes.devices],
        accounts[0]
      );

      console.log('Checking device status for:', device.deviceName, 'ID:', device.id);

      // Check all three systems
      const status = {
        intune: { exists: false, id: null },
        autopilot: { exists: false, id: null },
        azureAD: { exists: false, id: null },
      };

      // Verify Intune device still exists
      try {
        const intuneDevice = await deviceService.getDeviceById(response.accessToken, device.id);
        if (intuneDevice) {
          status.intune = { exists: true, id: device.id, serialNumber: intuneDevice.serialNumber };
          console.log('Intune device found:', intuneDevice.deviceName);
        }
      } catch (error) {
        console.error('Intune verification error:', error);
        if (error.response?.status === 404) {
          console.log('Device not found in Intune');
        }
      }

      // Check Autopilot
      try {
        const autopilotDevices = await autopilotService.getAutopilotDevices(response.accessToken);
        const autopilotMatch = autopilotDevices.find(
          ap => ap.serialNumber === status.intune.serialNumber || ap.serialNumber === device.serialNumber
        );
        if (autopilotMatch) {
          status.autopilot = { exists: true, id: autopilotMatch.id };
          console.log('Autopilot device found:', autopilotMatch.serialNumber);
        }
      } catch (error) {
        console.error('Autopilot check error:', error);
      }

      // Check Azure AD
      if (device.azureADDeviceId) {
        try {
          const aadDevices = await deviceService.getAzureADDevices(response.accessToken);
          const aadMatch = aadDevices.find(
            aad => aad.deviceId === device.azureADDeviceId
          );
          if (aadMatch) {
            status.azureAD = { exists: true, id: aadMatch.id };
            console.log('Azure AD device found:', aadMatch.displayName);
          }
        } catch (error) {
          console.error('Azure AD check error:', error);
        }
      }

      console.log('Device status:', status);
      setDeviceStatus(status);
    } catch (error) {
      console.error('Status check error:', error);
      setDeviceStatus({ error: 'Failed to check device status' });
    }
  };

  const handleOffboard = async () => {
    setShowConfirm(false);
    setOffboarding(true);
    setOffboardResults(null);

    try {
      const response = await acquireTokenWithFallback(
        instance,
        [...graphScopes.deviceManagement, ...graphScopes.autopilot, ...graphScopes.devices],
        accounts[0]
      );
      const results = {
        intune: { status: 'pending' },
        autopilot: { status: 'skipped' },
        azureAD: { status: 'skipped' },
      };

      // Step 1: Delete from Intune
      if (deviceStatus.intune.exists) {
        try {
          console.log('Attempting to delete Intune device with ID:', deviceStatus.intune.id);
          await deviceService.deleteIntuneDevice(response.accessToken, deviceStatus.intune.id);
          results.intune = { status: 'success', message: 'Deleted from Intune' };
          console.log('Intune device deleted successfully');
        } catch (error) {
          console.error('Intune deletion error:', error);
          console.error('Error details:', error.response?.data || error.message);
          const errorMsg = error.response?.status === 404 
            ? 'Device not found in Intune (may have been already deleted)'
            : error.response?.data?.error?.message || error.message;
          results.intune = { status: 'failed', message: errorMsg };
          setOffboardResults(results);
          setOffboarding(false);
          return;
        }
      }

      // Wait a bit for propagation
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 2: Delete from Autopilot
      if (deviceStatus.autopilot.exists) {
        try {
          await autopilotService.deleteAutopilotDevice(response.accessToken, deviceStatus.autopilot.id);
          results.autopilot = { status: 'success', message: 'Deleted from Autopilot' };
        } catch (error) {
          results.autopilot = { status: 'failed', message: error.message };
        }
      }

      // Wait again
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 3: Delete from Azure AD
      if (deviceStatus.azureAD.exists) {
        try {
          await deviceService.deleteAzureADDevice(response.accessToken, deviceStatus.azureAD.id);
          results.azureAD = { status: 'success', message: 'Deleted from Azure AD' };
        } catch (error) {
          results.azureAD = { status: 'failed', message: error.message };
        }
      }

      setOffboardResults(results);
    } catch (error) {
      console.error('Offboarding error:', error);
      setOffboardResults({ error: 'Offboarding process failed' });
    } finally {
      setOffboarding(false);
    }
  };

  const getStatusIcon = (status) => {
    if (status === 'success') return <FaCheckCircle className="text-success" />;
    if (status === 'failed') return <FaTimesCircle className="text-danger" />;
    if (status === 'pending') return <FaSpinner className="text-primary spinner" />;
    return null;
  };

  return (
    <Card>
      <Card.Header>
        <h5>Device Offboarding Wizard</h5>
      </Card.Header>
      <Card.Body>
        <Form.Group className="mb-3">
          <Form.Label>Search Device</Form.Label>
          <div className="d-flex gap-2">
            <Form.Control
              type="text"
              placeholder="Enter device name or user email"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch}>Search</Button>
          </div>
        </Form.Group>

        {searchError && (
          <div className="alert alert-warning">{String(searchError)}</div>
        )}

        {searchResults.length > 0 && (
          <div className="mb-3">
            <Table striped bordered hover size="sm">
              <thead>
                <tr>
                  <th>Device Name</th>
                  <th>User</th>
                  <th>OS</th>
                  <th>Compliance</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.map((device) => (
                  <tr key={device.id}>
                    <td>{device.deviceName}</td>
                    <td>{device.userPrincipalName}</td>
                    <td>{device.operatingSystem}</td>
                    <td>
                      <Badge bg={device.complianceState === 'compliant' ? 'success' : 'danger'}>
                        {device.complianceState}
                      </Badge>
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant="outline-primary"
                        onClick={() => checkDeviceStatus(device)}
                      >
                        Check Status
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}

        {selectedDevice && deviceStatus && !deviceStatus.checking && (
          <Alert variant="info">
            <h6>Device: {selectedDevice.deviceName}</h6>
            <Table size="sm" className="mt-2 mb-0">
              <thead>
                <tr>
                  <th>System</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Intune</td>
                  <td>
                    {deviceStatus.intune.exists ? 
                      <Badge bg="success">Registered</Badge> : 
                      <Badge bg="secondary">Not Found</Badge>
                    }
                  </td>
                </tr>
                <tr>
                  <td>Autopilot</td>
                  <td>
                    {deviceStatus.autopilot.exists ? 
                      <Badge bg="success">Registered</Badge> : 
                      <Badge bg="secondary">Not Found</Badge>
                    }
                  </td>
                </tr>
                <tr>
                  <td>Azure AD</td>
                  <td>
                    {deviceStatus.azureAD.exists ? 
                      <Badge bg="success">Registered</Badge> : 
                      <Badge bg="secondary">Not Found</Badge>
                    }
                  </td>
                </tr>
              </tbody>
            </Table>

            <div className="mt-3">
              <Button
                variant="danger"
                onClick={() => setShowConfirm(true)}
                disabled={offboarding}
              >
                {offboarding ? 'Offboarding...' : 'Offboard Device'}
              </Button>
            </div>
          </Alert>
        )}

        {offboardResults && (
          <Alert variant="success">
            <h6>Offboarding Results</h6>
            <ul className="mb-0">
              <li>{getStatusIcon(offboardResults.intune?.status)} Intune: {offboardResults.intune?.message || offboardResults.intune?.status}</li>
              <li>{getStatusIcon(offboardResults.autopilot?.status)} Autopilot: {offboardResults.autopilot?.message || offboardResults.autopilot?.status}</li>
              <li>{getStatusIcon(offboardResults.azureAD?.status)} Azure AD: {offboardResults.azureAD?.message || offboardResults.azureAD?.status}</li>
            </ul>
          </Alert>
        )}

        <Modal show={showConfirm} onHide={() => setShowConfirm(false)}>
          <Modal.Header closeButton>
            <Modal.Title>Confirm Offboarding</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p>Are you sure you want to offboard this device?</p>
            <p><strong>Device: {selectedDevice?.deviceName}</strong></p>
            <p>This will remove the device from:</p>
            <ul>
              {deviceStatus?.intune?.exists && <li>Microsoft Intune</li>}
              {deviceStatus?.autopilot?.exists && <li>Windows Autopilot</li>}
              {deviceStatus?.azureAD?.exists && <li>Azure Active Directory</li>}
            </ul>
            <Alert variant="warning">
              <strong>Warning:</strong> This action cannot be undone!
            </Alert>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowConfirm(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleOffboard}>
              Confirm Offboard
            </Button>
          </Modal.Footer>
        </Modal>
      </Card.Body>
    </Card>
  );
};

export default OffboardingWizard;
