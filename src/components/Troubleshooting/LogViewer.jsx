import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Badge, Form, ButtonGroup, Alert } from 'react-bootstrap';
import { autopilotLogger, deviceLogger, appLogger, authLogger, graphLogger } from '../../utils/logger';

const LogViewer = () => {
  const [logs, setLogs] = useState([]);
  const [filterLevel, setFilterLevel] = useState('ALL');
  const [filterContext, setFilterContext] = useState('ALL');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [stats, setStats] = useState(null);

  const loadLogs = () => {
    // Get logs from all loggers
    const allLogs = [
      ...autopilotLogger.getStoredLogs(),
      ...deviceLogger.getStoredLogs(),
      ...appLogger.getStoredLogs(),
      ...authLogger.getStoredLogs(),
      ...graphLogger.getStoredLogs(),
    ];

    // Remove duplicates and sort by timestamp
    const uniqueLogs = Array.from(
      new Map(allLogs.map(log => [`${log.timestamp}-${log.context}-${log.message}`, log])).values()
    ).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    let filtered = uniqueLogs;

    if (filterLevel !== 'ALL') {
      filtered = filtered.filter(log => log.level === filterLevel);
    }

    if (filterContext !== 'ALL') {
      filtered = filtered.filter(log => log.context === filterContext);
    }

    setLogs(filtered);

    // Calculate stats
    const statsData = {
      total: uniqueLogs.length,
      errors: uniqueLogs.filter(l => l.level === 'ERROR').length,
      warnings: uniqueLogs.filter(l => l.level === 'WARN').length,
      success: uniqueLogs.filter(l => l.level === 'SUCCESS').length,
      info: uniqueLogs.filter(l => l.level === 'INFO').length,
    };
    setStats(statsData);
  };

  useEffect(() => {
    loadLogs();
  }, [filterLevel, filterContext]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(loadLogs, 2000); // Refresh every 2 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, filterLevel, filterContext]);

  const handleDownload = () => {
    autopilotLogger.downloadLogs();
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear all logs? This cannot be undone.')) {
      autopilotLogger.clearLogs();
      deviceLogger.clearLogs();
      appLogger.clearLogs();
      authLogger.clearLogs();
      graphLogger.clearLogs();
      loadLogs();
    }
  };

  const getLevelBadge = (level) => {
    const variants = {
      DEBUG: 'secondary',
      INFO: 'primary',
      WARN: 'warning',
      ERROR: 'danger',
      SUCCESS: 'success',
    };
    return <Badge bg={variants[level]}>{level}</Badge>;
  };

  const getContextBadge = (context) => {
    return <Badge bg="info">{context}</Badge>;
  };

  return (
    <div>
      <Card className="mb-3">
        <Card.Header>
          <div className="d-flex justify-content-between align-items-center">
            <h5 className="mb-0">📋 Application Logs & Troubleshooting</h5>
            <div>
              <Form.Check 
                type="switch"
                id="auto-refresh-switch"
                label="Auto-refresh"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="d-inline-block me-3"
              />
              <Button variant="outline-primary" size="sm" onClick={loadLogs} className="me-2">
                🔄 Refresh
              </Button>
              <Button variant="outline-success" size="sm" onClick={handleDownload} className="me-2">
                💾 Download Logs
              </Button>
              <Button variant="outline-danger" size="sm" onClick={handleClear}>
                🗑️ Clear Logs
              </Button>
            </div>
          </div>
        </Card.Header>
        <Card.Body>
          {stats && (
            <Alert variant="light" className="mb-3">
              <strong>Statistics:</strong> {stats.total} total logs | 
              {' '}<Badge bg="danger">{stats.errors} Errors</Badge>
              {' '}<Badge bg="warning">{stats.warnings} Warnings</Badge>
              {' '}<Badge bg="success">{stats.success} Success</Badge>
              {' '}<Badge bg="primary">{stats.info} Info</Badge>
            </Alert>
          )}

          <div className="mb-3">
            <Form.Label><strong>Filters:</strong></Form.Label>
            <div className="d-flex gap-2">
              <ButtonGroup>
                <Button 
                  variant={filterLevel === 'ALL' ? 'primary' : 'outline-primary'}
                  onClick={() => setFilterLevel('ALL')}
                  size="sm"
                >
                  All Levels
                </Button>
                <Button 
                  variant={filterLevel === 'ERROR' ? 'danger' : 'outline-danger'}
                  onClick={() => setFilterLevel('ERROR')}
                  size="sm"
                >
                  Errors
                </Button>
                <Button 
                  variant={filterLevel === 'WARN' ? 'warning' : 'outline-warning'}
                  onClick={() => setFilterLevel('WARN')}
                  size="sm"
                >
                  Warnings
                </Button>
                <Button 
                  variant={filterLevel === 'SUCCESS' ? 'success' : 'outline-success'}
                  onClick={() => setFilterLevel('SUCCESS')}
                  size="sm"
                >
                  Success
                </Button>
                <Button 
                  variant={filterLevel === 'INFO' ? 'info' : 'outline-info'}
                  onClick={() => setFilterLevel('INFO')}
                  size="sm"
                >
                  Info
                </Button>
              </ButtonGroup>

              <Form.Select 
                size="sm" 
                value={filterContext} 
                onChange={(e) => setFilterContext(e.target.value)}
                style={{ width: 'auto' }}
              >
                <option value="ALL">All Contexts</option>
                <option value="Autopilot">Autopilot</option>
                <option value="Device">Device</option>
                <option value="Application">Application</option>
                <option value="Authentication">Authentication</option>
                <option value="GraphAPI">Graph API</option>
              </Form.Select>
            </div>
          </div>

          <div style={{ maxHeight: '500px', overflow: 'auto' }}>
            <Table striped bordered hover size="sm">
              <thead style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1 }}>
                <tr>
                  <th style={{ width: '100px' }}>Time</th>
                  <th style={{ width: '80px' }}>Level</th>
                  <th style={{ width: '120px' }}>Context</th>
                  <th>Message</th>
                  <th style={{ width: '60px' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center text-muted">
                      No logs found matching the current filters
                    </td>
                  </tr>
                ) : (
                  logs.map((log, index) => (
                    <tr key={index}>
                      <td><small>{log.timestamp}</small></td>
                      <td>{getLevelBadge(log.level)}</td>
                      <td>{getContextBadge(log.context)}</td>
                      <td>
                        {log.message}
                        {log.error && (
                          <div className="text-danger mt-1">
                            <small><strong>Error:</strong> {log.error.message}</small>
                          </div>
                        )}
                      </td>
                      <td>
                        {(log.data || log.error) && (
                          <Button 
                            size="sm" 
                            variant="outline-secondary"
                            onClick={() => {
                              console.group(`📋 Log Details - ${log.timestamp}`);
                              console.log('Full log entry:', log);
                              if (log.data) console.log('Data:', log.data);
                              if (log.error) {
                                console.error('Error:', log.error);
                                if (log.error.stack) console.error('Stack:', log.error.stack);
                              }
                              console.groupEnd();
                              alert('Log details printed to browser console (F12)');
                            }}
                          >
                            View
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>

          {logs.length > 50 && (
            <Alert variant="info" className="mt-3 mb-0">
              <small>Showing {logs.length} logs. Download logs for complete history.</small>
            </Alert>
          )}
        </Card.Body>
      </Card>

      <Card>
        <Card.Header><strong>💡 Troubleshooting Tips</strong></Card.Header>
        <Card.Body>
          <ul>
            <li><strong>Errors:</strong> Red entries indicate failures. Check the "View" button for detailed error information.</li>
            <li><strong>Warnings:</strong> Yellow entries indicate potential issues that didn't cause failures.</li>
            <li><strong>Auto-refresh:</strong> Enable to see logs update in real-time during operations.</li>
            <li><strong>Download Logs:</strong> Export all logs as a text file to share with support or for detailed analysis.</li>
            <li><strong>Context Filter:</strong> Focus on specific areas (Autopilot, Device, Authentication) to narrow down issues.</li>
          </ul>
          <Alert variant="warning" className="mb-0">
            <strong>⚠️ Note:</strong> Logs are stored in browser localStorage and persist between sessions. 
            Clear logs periodically to free up space.
          </Alert>
        </Card.Body>
      </Card>
    </div>
  );
};

export default LogViewer;
