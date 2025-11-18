import React, { useState, useEffect } from 'react';
import { Card, Form, Table, Badge, Button, Row, Col, ProgressBar } from 'react-bootstrap';
import { useMsal } from '@azure/msal-react';
import appService from '../../services/appService';
import { graphScopes } from '../../utils/authConfig';
import { acquireTokenWithFallback } from '../../utils/msalHelper';

const StatusDashboard = () => {
  const { instance, accounts } = useMsal();
  const [apps, setApps] = useState([]);
  const [selectedApp, setSelectedApp] = useState('');
  const [installStatuses, setInstallStatuses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [appListError, setAppListError] = useState(null);
  const [appStatusError, setAppStatusError] = useState(null);

  useEffect(() => {
    loadApps();
  }, []);

  const appType = (odataType) => {
    if (!odataType) return 'Other';
    const t = odataType.toLowerCase();
    if (t.includes('officesuiteapp')) return 'Microsoft 365';
    if (t.includes('office')) return 'Office';
    if (t.includes('win32lobapp')) return 'Win32';
    if (t.includes('windowsmicrosoftedgeapp')) return 'Edge';
    if (t.includes('webapp')) return 'Web App';
    if (t.includes('windowsmobilemsi')) return 'MSI';
    if (t.includes('windows')) return 'Windows';
    if (t.includes('ios')) return 'iOS';
    if (t.includes('macos')) return 'macOS';
    if (t.includes('android')) return 'Android';
    if (t.includes('store')) return 'Store App';
    return odataType.split('.').pop() || 'Other';
  };

  const loadApps = async () => {
    setAppListError(null);
    try {
      console.log('Loading apps with deviceApps scope...');
      // Use Intune apps scope to access deviceAppManagement mobileApps
      const response = await acquireTokenWithFallback(
        instance,
        graphScopes.deviceApps,
        accounts[0]
      );
      console.log('Token acquired successfully');

      let appList;
      try {
        appList = await appService.getMobileApps(response.accessToken);
        console.log('Loaded apps:', appList?.length, 'apps');
        console.log('Sample apps:', appList?.slice(0, 3));
      } catch (apiErr) {
        console.error('appService.getMobileApps error:', apiErr);
        console.error('Full error response:', apiErr.response);
        const errorData = apiErr.response?.data;
        const errorMsg = errorData?.error?.message || apiErr.message || String(apiErr);
        setAppListError(errorData || errorMsg);
        setApps([]);
        return;
      }

      setApps(appList || []);
      console.log('Apps set successfully');
      console.log('Apps in state:', appList?.map(a => a.displayName));
      
      // Check specifically for Microsoft 365 Apps
      const m365 = appList?.find(a => (a.displayName || '').includes('Microsoft 365 Apps'));
      if (m365) {
        console.log('Found Microsoft 365 Apps:', m365);
      } else {
        console.warn('Microsoft 365 Apps NOT found in app list');
      }
    } catch (error) {
      console.error('Error loading apps:', error);
      setAppListError(error.message || String(error));
    }
  };

  const loadAppStatus = async (appId) => {
    setLoading(true);
    setInstallStatuses([]);
    setSummary(null);
    setAppStatusError(null);
    try {
      console.log('Loading app status for app:', appId);
      // Status endpoints are also under deviceAppManagement
      const response = await acquireTokenWithFallback(
        instance,
        graphScopes.deviceApps,
        accounts[0]
      );
      console.log('Token acquired for app status');
      
      let statuses = null;
      let summaryData = null;
      
      try {
        statuses = await appService.getAppInstallStatus(response.accessToken, appId);
        console.log('App statuses received:', statuses?.length, 'records');
        console.log('Sample status record:', statuses?.[0]);
        
        summaryData = await appService.getAppInstallSummary(response.accessToken, appId);
        console.log('Summary data:', summaryData);
      } catch (statusError) {
        console.error('Failed to get status, trying userStatuses as fallback:', statusError);
        
        // Try userStatuses endpoint as final fallback
        try {
          const userStatuses = await appService.getAppUserInstallStatus(response.accessToken, appId);
          console.log('User statuses received:', userStatuses?.length, 'records');
          statuses = userStatuses;
          
          if (userStatuses && userStatuses.length > 0) {
            summaryData = await appService.getAppInstallSummary(response.accessToken, appId);
          }
        } catch (userError) {
          console.error('userStatuses also failed:', userError);
          throw statusError; // Throw original error
        }
      }
      
      setInstallStatuses(statuses || []);
      setSummary(summaryData);
      
      if (!statuses || statuses.length === 0) {
        setAppStatusError('No installation status data available. The app may not be assigned to any devices or users yet.');
      }
    } catch (error) {
      console.error('Error loading app status:', error);
      console.error('Error details:', error.response?.data);
      setAppStatusError('Unable to load installation status for this app. This may be because the app type does not support detailed status reporting or there are no devices with this app installed.');
    } finally {
      setLoading(false);
    }
  };

  const handleAppChange = (e) => {
    const appId = e.target.value;
    console.log('App selected:', appId);
    setSelectedApp(appId);
    setAppStatusError(null);
    if (appId) {
      loadAppStatus(appId);
    } else {
      setInstallStatuses([]);
      setSummary(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'installed':
        return <Badge bg="success">Installed</Badge>;
      case 'failed':
        return <Badge bg="danger">Failed</Badge>;
      case 'installing':
      case 'pending':
        return <Badge bg="warning">Pending</Badge>;
      case 'assigned':
        return <Badge bg="primary">Assigned (Unable to Validate)</Badge>;
      case 'not_installed':
        return <Badge bg="warning">Not Installed</Badge>;
      case 'notapplicable':
        return <Badge bg="secondary">Not Applicable</Badge>;
      default:
        return <Badge bg="info">{status || 'Unknown'}</Badge>;
    }
  };

  const getSuccessRate = () => {
    if (!summary || summary.total === 0) return 0;
    return Math.round((summary.installed / summary.total) * 100);
  };

  return (
    <Card>
      <Card.Header>
        <h5>Software Installation Status</h5>
      </Card.Header>
      <Card.Body>
        <Form.Group className="mb-4">
          <Form.Label>Select Application ({apps.length} apps available)</Form.Label>
          <Form.Select value={selectedApp} onChange={handleAppChange} aria-label="Select application">
            <option value="">-- Choose an application --</option>
            {apps
              .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))
              .map(app => (
                <option key={app.id} value={String(app.id)}>
                  {app.displayName} {app.publisher ? `(${app.publisher})` : ''} — {appType(app['@odata.type'])}
                </option>
              ))}
          </Form.Select>
        </Form.Group>

        {appListError && (
          <div className="alert alert-danger mb-3">
            <strong>Error loading apps:</strong>{' '}
            {typeof appListError === 'string' 
              ? appListError 
              : appListError.error?.message || appListError.message || JSON.stringify(appListError, null, 2)}
          </div>
        )}

        {appStatusError && (
          <div className="alert alert-warning mb-3">
            <strong>Status unavailable:</strong> {appStatusError}
          </div>
        )}

        {installStatuses && installStatuses.length > 0 && installStatuses[0]?.note && (
          <div className="alert alert-info mb-3">
            <i className="bi bi-info-circle me-2"></i>
            <strong>Note:</strong> {installStatuses[0].note}
          </div>
        )}

        {summary && (
          <Card className="mb-4">
            <Card.Header>
              <h6>Installation Summary</h6>
            </Card.Header>
            <Card.Body>
              <Row>
                <Col md={6}>
                  <div className="mb-3">
                    <div className="d-flex justify-content-between mb-1">
                      <span>Success Rate</span>
                      <strong>{getSuccessRate()}%</strong>
                    </div>
                    <ProgressBar 
                      now={getSuccessRate()} 
                      variant={getSuccessRate() > 80 ? 'success' : getSuccessRate() > 50 ? 'warning' : 'danger'}
                    />
                  </div>
                </Col>
              </Row>
              <Row>
                <Col md={3}>
                  <div className="text-center p-3 bg-light rounded">
                    <h4 className="text-success mb-0">{summary.installed}</h4>
                    <small className="text-muted">Installed</small>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="text-center p-3 bg-light rounded">
                    <h4 className="text-danger mb-0">{summary.failed}</h4>
                    <small className="text-muted">Failed</small>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="text-center p-3 bg-light rounded">
                    <h4 className="text-warning mb-0">{summary.pending}</h4>
                    <small className="text-muted">Pending</small>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="text-center p-3 bg-light rounded">
                    <h4 className="text-secondary mb-0">{summary.notApplicable}</h4>
                    <small className="text-muted">Not Applicable</small>
                  </div>
                </Col>
              </Row>
              {(summary.assigned > 0 || summary.notInstalled > 0) && (
                <Row className="mt-3">
                  {summary.assigned > 0 && (
                    <Col md={6}>
                      <div className="text-center p-3 bg-light rounded">
                        <h4 className="text-primary mb-0">{summary.assigned}</h4>
                        <small className="text-muted">Assigned</small>
                      </div>
                    </Col>
                  )}
                  {summary.notInstalled > 0 && (
                    <Col md={6}>
                      <div className="text-center p-3 bg-light rounded">
                        <h4 className="text-warning mb-0">{summary.notInstalled}</h4>
                        <small className="text-muted">Not Installed</small>
                      </div>
                    </Col>
                  )}
                </Row>
              )}
            </Card.Body>
          </Card>
        )}

        {loading && (
          <div className="text-center my-4">
            <div className="spinner-border" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        )}

        {installStatuses.length > 0 && (
          <div style={{ maxHeight: '500px', overflow: 'auto' }}>
            <Table striped bordered hover size="sm">
              <thead>
                <tr>
                  <th>Device Name</th>
                  <th>User (UPN)</th>
                  <th>Device Platform</th>
                  <th>App Version</th>
                  <th>Status</th>
                  <th>Error Code</th>
                  <th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {installStatuses.map((status, idx) => {
                  const effectiveStatus = status.installState || status.status;
                  const deviceName = status.deviceName || status.deviceDisplayName;
                  const lastUpdated = status.lastUpdatedDateTime || status.lastReportedDateTime;
                  return (
                    <tr key={idx}>
                      <td>{deviceName || 'Unknown'}</td>
                      <td>{status.userName || status.userPrincipalName || 'No user'}</td>
                      <td>{status.osVersion ? `Windows ${status.osVersion}` : (status.deviceType || 'Unknown')}</td>
                      <td>{status.displayVersion || status.appVersion || 'N/A'}</td>
                      <td>{getStatusBadge(effectiveStatus)}</td>
                      <td>
                        {status.errorCode && status.errorCode !== '0x0' ? (
                          <span className="text-danger">
                            {status.errorCode}
                            {status.osDescription && <><br /><small>{status.osDescription}</small></>}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>{lastUpdated ? new Date(lastUpdated).toLocaleString() : 'N/A'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

export default StatusDashboard;
