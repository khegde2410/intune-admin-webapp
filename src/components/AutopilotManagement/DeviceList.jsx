import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Badge, Spinner } from 'react-bootstrap';
import { useMsal } from '@azure/msal-react';
import autopilotService from '../../services/autopilotService';
import { graphScopes } from '../../utils/authConfig';
import { acquireTokenWithFallback } from '../../utils/msalHelper';

const DeviceList = ({ onRefresh }) => {
  const { instance, accounts } = useMsal();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    loadDevices();
  }, [onRefresh]);

  const loadDevices = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await acquireTokenWithFallback(
        instance,
        graphScopes.autopilot,
        accounts[0]
      );
      const data = await autopilotService.getAutopilotDevices(response.accessToken);
      setDevices(data);
    } catch (error) {
      console.error('Error loading devices:', error);
      console.error('Error details:', error.response?.data || error.message);
      const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to load Autopilot devices';
      setError(`Failed to load Autopilot devices: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (deviceId) => {
    if (!window.confirm('Are you sure you want to delete this device? This action cannot be undone.')) {
      return;
    }

    setDeleting(deviceId);
    setError(''); // Clear previous errors
    console.log('Attempting to delete device:', deviceId);
    
    try {
      const response = await acquireTokenWithFallback(
        instance,
        graphScopes.autopilot,
        accounts[0]
      );
      await autopilotService.deleteAutopilotDevice(response.accessToken, deviceId);
      console.log('Device deletion initiated:', deviceId);
      
      // Poll for device removal (wait up to 30 seconds)
      let attempts = 0;
      const maxAttempts = 6; // 30 seconds (6 * 5 seconds)
      let deviceRemoved = false;
      
      while (attempts < maxAttempts && !deviceRemoved) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        attempts++;
        
        try {
          const devices = await autopilotService.getAutopilotDevices(response.accessToken);
          deviceRemoved = !devices.some(d => d.id === deviceId);
          
          if (deviceRemoved) {
            console.log('Device successfully removed');
            await loadDevices();
            return;
          }
        } catch (pollError) {
          console.error('Error polling for device removal:', pollError);
        }
      }
      
      // If device not removed after polling, show info message
      setError('Device deletion initiated. The device will be removed within 30 minutes. Please refresh to check status.');
      await loadDevices();
      
    } catch (error) {
      console.error('Error deleting device:', error);
      console.error('Error details:', error.response?.data || error.message);
      
      const errorData = error.response?.data;
      const errorPhrase = errorData?.CustomApiErrorPhrase;
      
      // Handle specific error cases with user-friendly messages
      if (errorPhrase === 'ZtdDeviceDeletionInProgess') {
        setError('⚠️ Deletion in progress: This device is already being deleted. Please wait 30 minutes and refresh the page to verify removal.');
      } else if (errorData && typeof errorData === 'object' && errorData.Message) {
        // Extract just the key part of the message
        const msg = String(errorData.Message);
        if (msg.includes('less than 30minutes ago') || msg.includes('currently in progress')) {
          setError('⚠️ Deletion in progress: This device is already being deleted. Please wait 30 minutes and refresh the page.');
        } else {
          setError(`❌ Delete failed: ${msg.split(' - ')[0]}`);
        }
      } else if (typeof errorData === 'string') {
        setError(`❌ Delete failed: ${errorData}`);
      } else {
        const errorMessage = errorData?.error?.message || error.message || 'Unknown error';
        setError(`❌ Delete failed: ${String(errorMessage)}`);
      }
    } finally {
      setDeleting(null);
    }
  };

  const getStatusBadge = (status) => {
    // windowsAutopilotDeviceIdentity uses deploymentProfileAssignmentStatus
    const statusStr = status ? String(status).toLowerCase() : '';
    switch (statusStr) {
      case 'assigned':
        return <Badge bg="success">Assigned</Badge>;
      case 'pending':
        return <Badge bg="warning">Pending</Badge>;
      case 'notassigned':
        return <Badge bg="secondary">Not Assigned</Badge>;
      case 'failed':
        return <Badge bg="danger">Failed</Badge>;
      default:
        return <Badge bg="secondary">{status || 'Unknown'}</Badge>;
    }
  };

  return (
    <Card>
      <Card.Header className="d-flex justify-content-between align-items-center">
        <h5>Registered Autopilot Devices</h5>
        <Button variant="outline-primary" size="sm" onClick={loadDevices} disabled={loading}>
          {loading ? <Spinner animation="border" size="sm" /> : 'Refresh'}
        </Button>
      </Card.Header>
      <Card.Body>
        {error && (
          <Alert variant="danger" dismissible onClose={() => setError('')}>
            {typeof error === 'string' ? error : JSON.stringify(error)}
          </Alert>
        )}
        
        {loading ? (
          <div className="text-center">
            <Spinner animation="border" />
          </div>
        ) : (
          <div style={{ maxHeight: '500px', overflow: 'auto' }}>
            <Table striped bordered hover>
              <thead>
                <tr>
                  <th>Serial Number</th>
                  <th>Manufacturer</th>
                  <th>Model</th>
                  <th>Group Tag</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {devices.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center text-muted">
                      No Autopilot devices found
                    </td>
                  </tr>
                ) : (
                  devices.map((device) => (
                    <tr key={device.id}>
                      <td>{device.serialNumber}</td>
                      <td>{device.manufacturer || 'N/A'}</td>
                      <td>{device.model || 'N/A'}</td>
                      <td>{device.groupTag || 'N/A'}</td>
                      <td>{getStatusBadge(device.deploymentProfileAssignmentStatus)}</td>
                      <td>
                        <Button 
                          variant="danger" 
                          size="sm"
                          onClick={() => handleDelete(device.id)}
                          disabled={deleting === device.id || deleting !== null}
                        >
                          {deleting === device.id ? (
                            <>
                              <Spinner animation="border" size="sm" className="me-1" />
                              Deleting...
                            </>
                          ) : 'Delete'}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        )}

        <div className="mt-2">
          <small className="text-muted">Total devices: {devices.length}</small>
        </div>
      </Card.Body>
    </Card>
  );
};

export default DeviceList;
