import React, { useState, useEffect } from 'react';
import { Card, Form, Button, Badge, Table, ButtonGroup, Alert } from 'react-bootstrap';
import globalLogger from '../../utils/logger';

const LogViewer = () => {
  const [logs, setLogs] = useState([]);
  const [filterLevel, setFilterLevel] = useState('ALL');
  const [filterContext, setFilterContext] = useState('ALL');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [stats, setStats] = useState(null);

  const loadLogs = () => {
    const allLogs = globalLogger.getStoredLogs();
    setLogs(allLogs);
    setStats(globalLogger.getStats());
  };

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(loadLogs, 2000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const handleDownload = () => {
    globalLogger.downloadLogs();
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear all logs? This cannot be undone.')) {
      globalLogger.clearLogs();
      loadLogs();
    }
  };

  const getFilteredLogs = () => {
    let filtered = logs;

    if (filterLevel !== 'ALL') {
      filtered = filtered.filter(log => log.level === filterLevel);
    }

    if (filterContext !== 'ALL') {
      filtered = filtered.filter(log => log.context === filterContext);
    }

    return filtered.reverse(); // Show newest first
  };

  const getLevelBadge = (level) => {
    const variants = {
      DEBUG: 'secondary',
      INFO: 'info',
      WARN: 'warning',
      ERROR: 'danger',
      SUCCESS: 'success',
    };
    return <Badge bg={variants[level]}>{level}</Badge>;
  };

  const uniqueContexts = [...new Set(logs.map(l => l.context))];
  const filteredLogs = getFilteredLogs();

  return (
    <div>
      <h2 className="mb-4">Application Logs & Diagnostics</h2>

      {stats && (
        <Card className="mb-4">
          <Card.Header><strong>Log Statistics</strong></Card.Header>
          <Card.Body>
            <div className="d-flex gap-4">
              <div>
                <h5>{stats.total}</h5>
                <small className="text-muted">Total Logs</small>
              </div>
              <div>
                <h5 className="text-danger">{stats.errors}</h5>
                <small className="text-muted">Errors</small>
              </div>
              <div>
                <h5 className="text-warning">{stats.warnings}</h5>
                <small className="text-muted">Warnings</small>
              </div>
            </div>
            
            <div className="mt-3">
              <strong>By Level:</strong>
              <div className="d-flex gap-2 mt-2">
                {Object.entries(stats.byLevel).map(([level, count]) => (
                  <Badge key={level} bg={level === 'ERROR' ? 'danger' : level === 'WARN' ? 'warning' : 'secondary'}>
                    {level}: {count}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="mt-3">
              <strong>By Context:</strong>
              <div className="d-flex gap-2 mt-2 flex-wrap">
                {Object.entries(stats.byContext).map(([context, count]) => (
                  <Badge key={context} bg="info">
                    {context}: {count}
                  </Badge>
                ))}
              </div>
            </div>
          </Card.Body>
        </Card>
      )}

      <Card>
        <Card.Header>
          <div className="d-flex justify-content-between align-items-center">
            <strong>Application Logs ({filteredLogs.length})</strong>
            <div className="d-flex gap-2">
              <Form.Check 
                type="switch"
                label="Auto-refresh"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              <Button size="sm" variant="primary" onClick={loadLogs}>
                🔄 Refresh
              </Button>
              <Button size="sm" variant="success" onClick={handleDownload}>
                💾 Download
              </Button>
              <Button size="sm" variant="danger" onClick={handleClear}>
                🗑️ Clear
              </Button>
            </div>
          </div>
        </Card.Header>
        <Card.Body>
          <div className="mb-3">
            <div className="d-flex gap-3">
              <Form.Group>
                <Form.Label>Filter by Level</Form.Label>
                <Form.Select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)}>
                  <option value="ALL">All Levels</option>
                  <option value="DEBUG">Debug</option>
                  <option value="INFO">Info</option>
                  <option value="WARN">Warning</option>
                  <option value="ERROR">Error</option>
                  <option value="SUCCESS">Success</option>
                </Form.Select>
              </Form.Group>

              <Form.Group>
                <Form.Label>Filter by Context</Form.Label>
                <Form.Select value={filterContext} onChange={(e) => setFilterContext(e.target.value)}>
                  <option value="ALL">All Contexts</option>
                  {uniqueContexts.map(context => (
                    <option key={context} value={context}>{context}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </div>
          </div>

          {filteredLogs.length === 0 ? (
            <Alert variant="info">No logs found. Logs will appear here as you use the application.</Alert>
          ) : (
            <div style={{ maxHeight: '600px', overflow: 'auto' }}>
              <Table striped bordered hover size="sm">
                <thead style={{ position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
                  <tr>
                    <th style={{ width: '100px' }}>Time</th>
                    <th style={{ width: '80px' }}>Level</th>
                    <th style={{ width: '120px' }}>Context</th>
                    <th>Message</th>
                    <th style={{ width: '80px' }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log, index) => (
                    <tr key={index}>
                      <td><small>{log.timestamp}</small></td>
                      <td>{getLevelBadge(log.level)}</td>
                      <td><Badge bg="secondary">{log.context}</Badge></td>
                      <td>
                        {log.message}
                        {log.error && (
                          <div className="mt-1">
                            <Badge bg="danger">Error: {log.error.message}</Badge>
                          </div>
                        )}
                      </td>
                      <td>
                        {(log.data || log.error) && (
                          <Button 
                            size="sm" 
                            variant="outline-secondary"
                            onClick={() => {
                              const details = {
                                ...log,
                                data: log.data,
                                error: log.error
                              };
                              console.log('Log Details:', details);
                              alert('Log details printed to console (F12)');
                            }}
                          >
                            View
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      <Card className="mt-4">
        <Card.Header><strong>Troubleshooting Tips</strong></Card.Header>
        <Card.Body>
          <ul>
            <li><strong>Download Logs:</strong> Click "Download" to save all logs to a file for sharing with support</li>
            <li><strong>View Details:</strong> Click "View" on any log entry to see full details in the browser console (F12)</li>
            <li><strong>Filter Errors:</strong> Select "Error" level to see only errors</li>
            <li><strong>Auto-refresh:</strong> Enable to automatically update the log view every 2 seconds</li>
            <li><strong>Context Filter:</strong> Filter by module (Autopilot, Device, GraphAPI, etc.)</li>
            <li><strong>Clear Logs:</strong> Remove old logs to start fresh (cannot be undone)</li>
          </ul>
          
          <Alert variant="info" className="mb-0 mt-3">
            <strong>💡 Pro Tip:</strong> Logs are automatically saved in your browser. You can refresh the page and logs will persist. 
            Maximum 100 logs are kept in storage.
          </Alert>
        </Card.Body>
      </Card>
    </div>
  );
};

export default LogViewer;
