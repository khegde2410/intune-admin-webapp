import React, { useState, useEffect } from 'react';
import { Card, Table, Form, Button, Badge, Alert } from 'react-bootstrap';
import { useMsal } from '@azure/msal-react';
import deviceService from '../../services/deviceService';
import { graphScopes } from '../../utils/authConfig';
import { acquireTokenWithFallback } from '../../utils/msalHelper';
import { getDaysSinceLastSync, downloadCSV } from '../../utils/helpers';

const StaleDeviceList = () => {
  const { instance, accounts } = useMsal();
  const [devices, setDevices] = useState([]);
  const [filteredDevices, setFilteredDevices] = useState([]);
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [daysThreshold, setDaysThreshold] = useState(30);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteResults, setDeleteResults] = useState(null);

  useEffect(() => {
    loadStaleDevices();
  }, [daysThreshold]);

  const loadStaleDevices = async () => {
    setLoading(true);
    try {
      const response = await acquireTokenWithFallback(
        instance,
        graphScopes.deviceManagement,
        accounts[0]
      );
      const staleDevices = await deviceService.getStaleDevices(
        response.accessToken,
        daysThreshold
      );
      setDevices(staleDevices);
      setFilteredDevices(staleDevices);
    } catch (error) {
      console.error('Error loading stale devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedDevices(filteredDevices.map(d => d.id));
    } else {
      setSelectedDevices([]);
    }
  };

  const handleSelectDevice = (deviceId) => {
    if (selectedDevices.includes(deviceId)) {
      setSelectedDevices(selectedDevices.filter(id => id !== deviceId));
    } else {
      setSelectedDevices([...selectedDevices, deviceId]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedDevices.length === 0) return;

    if (!window.confirm(`Delete ${selectedDevices.length} device(s)?`)) return;

    setDeleting(true);
    setDeleteResults(null);

    try {
      const response = await acquireTokenWithFallback(
        instance,
        graphScopes.deviceManagement,
        accounts[0]
      );
      
      const deletePromises = selectedDevices.map(deviceId =>
        deviceService.deleteIntuneDevice(response.accessToken, deviceId)
          .then(() => ({ id: deviceId, status: 'success' }))
          .catch(error => ({ id: deviceId, status: 'failed', error: error.message }))
      );

      const results = await Promise.all(deletePromises);
      const summary = {
        total: results.length,
        successful: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'failed').length,
      };

      setDeleteResults(summary);
      setSelectedDevices([]);
      loadStaleDevices(); // Refresh list
    } catch (error) {
      console.error('Bulk delete error:', error);
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = () => {
    const exportData = filteredDevices.map(device => ({
      DeviceName: device.deviceName,
      User: device.userPrincipalName,
      OS: device.operatingSystem,
      LastSync: device.lastSyncDateTime,
      DaysSinceSync: getDaysSinceLastSync(device.lastSyncDateTime),
      ComplianceState: device.complianceState,
    }));

    downloadCSV(exportData, `stale-devices-${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <Card>
      <Card.Header className="d-flex justify-content-between align-items-center">
        <h5>Stale Device Management</h5>
        <div className="d-flex gap-2 align-items-center">
          <Form.Label className="mb-0 me-2">Days inactive:</Form.Label>
          <Form.Select
            size="sm"
            style={{ width: 'auto' }}
            value={daysThreshold}
            onChange={(e) => setDaysThreshold(Number(e.target.value))}
          >
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
            <option value={180}>180 days</option>
          </Form.Select>
          <Button size="sm" variant="outline-primary" onClick={loadStaleDevices}>
            Refresh
          </Button>
        </div>
      </Card.Header>
      <Card.Body>
        {deleteResults && (
          <Alert variant={deleteResults.failed > 0 ? 'warning' : 'success'} dismissible>
            Deletion complete: {deleteResults.successful} successful, {deleteResults.failed} failed
          </Alert>
        )}

        <div className="d-flex justify-content-between mb-3">
          <div>
            <strong>{filteredDevices.length}</strong> stale device(s) found
            {selectedDevices.length > 0 && (
              <span className="ms-2">
                ({selectedDevices.length} selected)
              </span>
            )}
          </div>
          <div>
            <Button
              size="sm"
              variant="outline-secondary"
              className="me-2"
              onClick={handleExport}
              disabled={filteredDevices.length === 0}
            >
              Export CSV
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={handleBulkDelete}
              disabled={selectedDevices.length === 0 || deleting}
            >
              {deleting ? 'Deleting...' : `Delete Selected (${selectedDevices.length})`}
            </Button>
          </div>
        </div>

        <div style={{ maxHeight: '500px', overflow: 'auto' }}>
          <Table striped bordered hover size="sm">
            <thead>
              <tr>
                <th>
                  <Form.Check
                    type="checkbox"
                    onChange={handleSelectAll}
                    checked={selectedDevices.length === filteredDevices.length && filteredDevices.length > 0}
                  />
                </th>
                <th>Device Name</th>
                <th>User</th>
                <th>OS</th>
                <th>Last Sync</th>
                <th>Days Inactive</th>
                <th>Compliance</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center">Loading...</td>
                </tr>
              ) : filteredDevices.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center text-muted">
                    No stale devices found
                  </td>
                </tr>
              ) : (
                filteredDevices.map((device) => (
                  <tr key={device.id}>
                    <td>
                      <Form.Check
                        type="checkbox"
                        checked={selectedDevices.includes(device.id)}
                        onChange={() => handleSelectDevice(device.id)}
                      />
                    </td>
                    <td>{device.deviceName}</td>
                    <td>{device.userPrincipalName}</td>
                    <td>{device.operatingSystem}</td>
                    <td>{device.lastSyncDateTime ? new Date(device.lastSyncDateTime).toLocaleDateString() : 'Never'}</td>
                    <td>
                      <Badge bg="warning">
                        {getDaysSinceLastSync(device.lastSyncDateTime) || 'N/A'}
                      </Badge>
                    </td>
                    <td>
                      <Badge bg={device.complianceState === 'compliant' ? 'success' : 'danger'}>
                        {device.complianceState || 'Unknown'}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </Card.Body>
    </Card>
  );
};

export default StaleDeviceList;
