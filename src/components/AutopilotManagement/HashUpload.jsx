import React, { useState } from 'react';
import { Card, Form, Button, Alert, Table, ProgressBar } from 'react-bootstrap';
import { useMsal } from '@azure/msal-react';
import Papa from 'papaparse';
import autopilotService from '../../services/autopilotService';
import { graphScopes } from '../../utils/authConfig';
import { acquireTokenWithFallback } from '../../utils/msalHelper';
import { autopilotLogger } from '../../utils/logger';

const HashUpload = () => {
  const { instance, accounts } = useMsal();
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [azureADGroups, setAzureADGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [addToGroup, setAddToGroup] = useState(false);
  const [groupResults, setGroupResults] = useState(null);

  React.useEffect(() => {
    loadAzureADGroups();
  }, []);

  const loadAzureADGroups = async () => {
    try {
      setLoadingGroups(true);
      const response = await acquireTokenWithFallback(
        instance,
        graphScopes.groups,
        accounts[0]
      );
      
      const groups = await autopilotService.getAzureADGroups(response.accessToken);
      autopilotLogger.info('Azure AD groups loaded', { groupCount: groups?.length || 0 });
      
      // Get group filter prefix from settings (optional)
      const filterPrefix = localStorage.getItem('autopilot_group_filter_prefix');
      
      let filteredGroups = groups;
      if (filterPrefix) {
        // Filter to show only groups starting with the configured prefix
        filteredGroups = groups.filter(group => 
          group.displayName && group.displayName.toLowerCase().startsWith(filterPrefix.toLowerCase())
        );
        autopilotLogger.debug(`Filtered groups with prefix "${filterPrefix}"`, { count: filteredGroups.length });
      } else {
        autopilotLogger.debug('No filter prefix configured, showing all groups', { count: groups.length });
      }
      
      setAzureADGroups(filteredGroups || []);
    } catch (error) {
      autopilotLogger.error('Failed to load Azure AD groups', error);
      setError(`Failed to load groups: ${error.message}`);
    } finally {
      setLoadingGroups(false);
    }
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      setError('');
      parseCSV(selectedFile);
    } else {
      setError('Please select a valid CSV file');
      setFile(null);
    }
  };

  const parseCSV = (file) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        // Expected columns: Device Serial Number, Windows Product ID, Hardware Hash, Group Tag
        const formatted = results.data.map(row => ({
          serialNumber: row['Device Serial Number'] || row['SerialNumber'],
          hardwareIdentifier: row['Hardware Hash'] || row['HardwareHash'],
          groupTag: row['Group Tag'] || row['GroupTag'] || '',
        }));
        setParsedData(formatted);
      },
      error: (error) => {
        setError('Error parsing CSV: ' + error.message);
      }
    });
  };

  const handleUpload = async () => {
    if (parsedData.length === 0) {
      setError('No data to upload');
      return;
    }

    setUploading(true);
    setError('');
    setUploadResults(null);
    setProgress(10);
    setProgressMessage('Uploading devices to Intune...');

    try {
      // Include group permissions if adding to group
      const scopes = addToGroup && selectedGroup 
        ? [...graphScopes.autopilot, ...graphScopes.groups, ...graphScopes.devices]
        : graphScopes.autopilot;
      
      const response = await acquireTokenWithFallback(
        instance,
        scopes,
        accounts[0]
      );
      
      setProgress(20);
      autopilotLogger.operation('HashUpload', 'Start', `Uploading ${parsedData.length} device(s) to Autopilot`, { deviceCount: parsedData.length, addToGroup, selectedGroup });
      
      const results = await autopilotService.uploadAutopilotHash(
        response.accessToken,
        parsedData
      );

      const failedUploads = results.filter(r => r.status === 'rejected');
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      
      autopilotLogger.operation('HashUpload', 'UploadComplete', `Upload finished: ${successCount} succeeded, ${failedUploads.length} failed`, { successCount, failedCount: failedUploads.length });
      
      if (failedUploads.length > 0) {
        failedUploads.forEach((failure, index) => {
          autopilotLogger.error(`Failed to upload device ${index + 1}`, failure.reason);
        });
      }
      
      setProgress(40);
      setProgressMessage('Upload complete. Waiting for devices to register...');

      const successfulUploads = results.filter(r => r.status === 'fulfilled').length;
      let devicesFound = false;
      let foundDevices = [];
      
      if (successfulUploads > 0) {
        // Poll for devices to appear in registered list
        const maxAttempts = 24; // 4 minutes (24 * 10 seconds)
        let attempts = 0;
        autopilotLogger.operation('HashUpload', 'Registration', 'Polling for devices to appear in Autopilot console', { maxAttempts, expectedDevices: successfulUploads })
        
        while (attempts < maxAttempts && !devicesFound) {
          await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
          attempts++;
          
          // Update progress (40% to 95%)
          const progressIncrement = Math.min(95, 40 + (attempts / maxAttempts) * 55);
          setProgress(progressIncrement);
          setProgressMessage(`Checking registration status... (${attempts * 10}s elapsed)`);
          
          try {
            const devices = await autopilotService.getAutopilotDevices(response.accessToken);
            const uploadedSerials = parsedData.map(d => d.serialNumber);
            foundDevices = devices.filter(d => uploadedSerials.includes(d.serialNumber));
            
            autopilotLogger.debug(`Registration check attempt ${attempts}/${maxAttempts}: Found ${foundDevices.length} of ${successfulUploads} devices`);
            
            if (foundDevices.length >= successfulUploads) {
              devicesFound = true;
              
              // Add devices to Azure AD group if selected
              if (addToGroup && selectedGroup && foundDevices.length > 0) {
                setProgress(90);
                setProgressMessage('Waiting for devices to sync to Azure AD...');
                autopilotLogger.operation('HashUpload', 'AzureADSync', `Waiting for ${foundDevices.length} devices to sync to Azure AD`, { deviceCount: foundDevices.length, groupId: selectedGroup });
                
                // Wait for devices to appear in Azure AD (they need to sync from Autopilot)
                // Poll for up to 5 minutes (30 attempts * 10 seconds)
                let azureADDevicesReady = false;
                let waitAttempts = 0;
                const maxWaitAttempts = 30; // Increased to 5 minutes
                
                while (waitAttempts < maxWaitAttempts && !azureADDevicesReady) {
                  await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
                  waitAttempts++;
                  
                  const elapsed = waitAttempts * 10;
                  const minutes = Math.floor(elapsed / 60);
                  const seconds = elapsed % 60;
                  setProgressMessage(`Waiting for Azure AD sync... (${minutes}m ${seconds}s elapsed)`);
                  autopilotLogger.debug(`Azure AD sync check ${waitAttempts}/${maxWaitAttempts} (${elapsed}s elapsed)`);
                  
                  try {
                    // Re-fetch Autopilot devices to check if Azure AD IDs are populated
                    const refreshedDevices = await autopilotService.getAutopilotDevices(response.accessToken);
                    const uploadedSerials = parsedData.map(d => d.serialNumber);
                    const updatedFoundDevices = refreshedDevices.filter(d => uploadedSerials.includes(d.serialNumber));
                    
                    const devicesWithAzureADId = updatedFoundDevices.filter(d => d.azureActiveDirectoryDeviceId);
                    autopilotLogger.info(`Azure AD sync status: ${devicesWithAzureADId.length} of ${updatedFoundDevices.length} devices have Azure AD IDs`);
                    
                    // Log the Azure AD IDs we found
                    devicesWithAzureADId.forEach(d => {
                      autopilotLogger.debug(`Device ${d.serialNumber} synced`, { azureADDeviceId: d.azureActiveDirectoryDeviceId });
                    });
                    
                    if (devicesWithAzureADId.length === updatedFoundDevices.length && devicesWithAzureADId.length > 0) {
                      azureADDevicesReady = true;
                      foundDevices = updatedFoundDevices; // Update with fresh data including Azure AD IDs
                      autopilotLogger.operationSuccess('HashUpload', 'All devices synced to Azure AD', { deviceCount: devicesWithAzureADId.length });
                    }
                  } catch (syncError) {
                    autopilotLogger.error('Error checking Azure AD sync status', syncError);
                  }
                }
                
                if (!azureADDevicesReady) {
                  autopilotLogger.warn('Azure AD sync timeout after 5 minutes', { devicesWaiting: foundDevices.length });
                  setError('⚠️ Devices registered in Autopilot but Azure AD sync is taking longer than expected. Group assignment may fail. This can take 10-30 minutes.');
                }
                
                setProgress(95);
                setProgressMessage('Adding devices to Azure AD group...');
                autopilotLogger.operation('HashUpload', 'GroupAssignment', `Adding ${foundDevices.length} devices to group`, { deviceCount: foundDevices.length, groupId: selectedGroup });
                
                try {
                  const groupAddPromises = foundDevices.map(async (device) => {
                    autopilotLogger.debug(`Processing device for group addition`, { serialNumber: device.serialNumber, azureADDeviceId: device.azureActiveDirectoryDeviceId });
                    
                    if (device.azureActiveDirectoryDeviceId) {
                      // Retry up to 3 times with increasing wait times if "resource does not exist"
                      const maxRetries = 3;
                      let lastError = null;
                      
                      for (let retry = 0; retry < maxRetries; retry++) {
                        try {
                          if (retry > 0) {
                            const waitTime = retry * 30000; // 30s, 60s
                            autopilotLogger.info(`Retry attempt ${retry}/${maxRetries} for ${device.serialNumber}, waiting ${waitTime/1000}s`);
                            setProgressMessage(`Retrying group addition (waiting for Azure AD)... ${retry}/${maxRetries}`);
                            await new Promise(resolve => setTimeout(resolve, waitTime));
                          }
                          
                          await autopilotService.addDeviceToGroup(
                            response.accessToken,
                            selectedGroup,
                            device.azureActiveDirectoryDeviceId
                          );
                          autopilotLogger.success(`Device ${device.serialNumber} added to group successfully`, { groupId: selectedGroup, azureADDeviceId: device.azureActiveDirectoryDeviceId });
                          return { serialNumber: device.serialNumber, success: true };
                        } catch (err) {
                          lastError = err;
                          const errorMsg = err.response?.data?.error?.message || err.message;
                          
                          // Check if it's a "resource not found" error - this means Azure AD hasn't synced yet
                          if (errorMsg && errorMsg.includes('does not exist') && retry < maxRetries - 1) {
                            autopilotLogger.warn(`Device ${device.serialNumber} not found in Azure AD yet, will retry`, { attempt: retry + 1, maxRetries });
                            continue; // Retry
                          } else {
                            // Different error or max retries reached
                            autopilotLogger.error(`Failed to add device ${device.serialNumber} to group`, err, { groupId: selectedGroup, azureADDeviceId: device.azureActiveDirectoryDeviceId });
                            break;
                          }
                        }
                      }
                      
                      return { 
                        serialNumber: device.serialNumber, 
                        success: false, 
                        error: lastError?.response?.data?.error?.message || lastError?.message || 'Failed after retries'
                      };
                    } else {
                      autopilotLogger.warn(`Device ${device.serialNumber} has no Azure AD Device ID`, { device });
                      return { serialNumber: device.serialNumber, success: false, error: 'No Azure AD Device ID - device may not be synced to Azure AD yet' };
                    }
                  });
                  
                  const results = await Promise.all(groupAddPromises);
                  setGroupResults(results); // Store for summary
                  const successfulAdds = results.filter(r => r.success).length;
                  const failedAdds = results.filter(r => !r.success);
                  
                  autopilotLogger.operation('HashUpload', 'GroupAssignmentComplete', `Group assignment finished: ${successfulAdds} succeeded, ${failedAdds.length} failed`, { successfulAdds, failedCount: failedAdds.length });
                  
                  if (failedAdds.length > 0) {
                    autopilotLogger.warn('Some devices failed group assignment', { failedDevices: failedAdds });
                  }
                  
                  if (successfulAdds > 0) {
                    if (successfulAdds === foundDevices.length) {
                      setProgressMessage(`All devices registered and added to group!`);
                    } else {
                      setProgressMessage(`Devices registered: ${successfulAdds} of ${foundDevices.length} added to group`);
                      setError(`⚠️ ${failedAdds.length} device(s) could not be added to group. Check console for details.`);
                    }
                  } else {
                    setProgressMessage('Devices registered but none could be added to group');
                    setError(`❌ Failed to add devices to group. Reasons: ${failedAdds.map(f => `${f.serialNumber}: ${f.error}`).join('; ')}`);
                  }
                } catch (groupError) {
                  autopilotLogger.error('Group assignment operation failed', groupError, { groupId: selectedGroup });
                  setProgressMessage('Devices registered but group assignment failed');
                }
              } else {
                setProgressMessage('All devices registered successfully!');
              }
              
              setProgress(100);
              autopilotLogger.operationSuccess('HashUpload', 'Process completed successfully', { devicesRegistered: foundDevices.length, groupAssignment: addToGroup });
            }
          } catch (pollError) {
            autopilotLogger.error('Error during device registration polling', pollError);
          }
        }
        
        if (!devicesFound) {
          setProgress(100);
          setProgressMessage('Upload complete - devices pending registration');
          setError('⚠️ Devices uploaded but not yet visible in Autopilot. Please refresh the page in a few minutes.');
        }
      } else {
        setProgress(100);
        setProgressMessage('Upload failed');
      }

      const summary = {
        total: results.length,
        successful: successfulUploads,
        failed: results.filter(r => r.status === 'rejected').length,
        details: results,
        registered: devicesFound,
        groupAdded: addToGroup && selectedGroup ? (groupResults?.filter(r => r.success).length || 0) : null,
        groupTotal: addToGroup && selectedGroup ? foundDevices.length : null,
      };

      setUploadResults(summary);
    } catch (error) {
      autopilotLogger.operationError('HashUpload', 'Upload process failed', error);
      setProgress(0);
      setProgressMessage('');
      setError('Failed to upload devices: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <Card.Header>
        <h5>Upload Autopilot Hardware Hashes</h5>
      </Card.Header>
      <Card.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        
        <Form.Group className="mb-3">
          <Form.Label>Select CSV File</Form.Label>
          <Form.Control
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            disabled={uploading}
          />
          <Form.Text className="text-muted">
            CSV should contain columns: Device Serial Number, Hardware Hash, Group Tag (optional)
          </Form.Text>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Check 
            type="checkbox"
            id="addToGroupCheck"
            label="Add devices to Azure AD group after successful import"
            checked={addToGroup}
            onChange={(e) => setAddToGroup(e.target.checked)}
            disabled={uploading || loadingGroups}
          />
        </Form.Group>

        {addToGroup && (
          <Form.Group className="mb-3">
            <Form.Label>Select Azure AD Group</Form.Label>
            <Form.Select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              disabled={uploading || loadingGroups || azureADGroups.length === 0}
            >
              <option value="">-- Select a group --</option>
              {azureADGroups.map(group => (
                <option key={group.id} value={group.id}>
                  {group.displayName}
                </option>
              ))}
            </Form.Select>
            {loadingGroups && (
              <Form.Text className="text-muted">Loading groups...</Form.Text>
            )}
            {!loadingGroups && azureADGroups.length === 0 && (
              <Form.Text className="text-warning">
                No groups found. Ensure you have Group.Read.All permission.
              </Form.Text>
            )}
            {selectedGroup && (
              <Form.Text className="text-success d-block mt-1">
                ✓ Devices will be added to this group after registration
              </Form.Text>
            )}
          </Form.Group>
        )}

        {parsedData.length > 0 && (
          <>
            <Alert variant="info">
              {parsedData.length} device(s) parsed from CSV
            </Alert>

            <div className="mb-3" style={{ maxHeight: '300px', overflow: 'auto' }}>
              <Table striped bordered hover size="sm">
                <thead>
                  <tr>
                    <th>Serial Number</th>
                    <th>Group Tag</th>
                    <th>Hash (Preview)</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.slice(0, 10).map((device, idx) => (
                    <tr key={idx}>
                      <td>{device.serialNumber}</td>
                      <td>{device.groupTag || 'N/A'}</td>
                      <td>{device.hardwareIdentifier?.substring(0, 30)}...</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {parsedData.length > 10 && (
                <small className="text-muted">
                  Showing first 10 of {parsedData.length} devices
                </small>
              )}
            </div>

            <Button
              variant="primary"
              onClick={handleUpload}
              disabled={uploading || (addToGroup && !selectedGroup)}
            >
              {uploading ? 'Uploading...' : 'Upload to Autopilot'}
            </Button>
            {addToGroup && !selectedGroup && (
              <Form.Text className="text-danger d-block mt-2">
                Please select an Azure AD group before uploading
              </Form.Text>
            )}
          </>
        )}

        {uploading && (
          <div className="mt-3">
            <div className="mb-2">
              <strong>{progressMessage}</strong>
            </div>
            <ProgressBar 
              now={progress} 
              label={`${Math.round(progress)}%`}
              animated={progress < 100}
              striped
              variant={progress === 100 ? 'success' : 'primary'}
            />
            <small className="text-muted mt-2 d-block">
              {progress < 40 && 'Uploading devices to Intune...'}
              {progress >= 40 && progress < 100 && 'Waiting for devices to appear in Autopilot console...'}
              {progress === 100 && 'Process complete!'}
            </small>
          </div>
        )}

        {uploadResults && !uploading && (
          <Alert variant={uploadResults.registered && uploadResults.failed === 0 && (!uploadResults.groupTotal || uploadResults.groupAdded === uploadResults.groupTotal) ? 'success' : 'warning'} className="mt-3">
            <strong>
              {uploadResults.registered && (!uploadResults.groupTotal || uploadResults.groupAdded === uploadResults.groupTotal)
                ? '✅ Upload Complete - Devices Registered!' 
                : '⚠️ Upload Complete - Registration Pending'}
            </strong>
            
            <div className="mt-3">
              <h6>📤 Step 1: Upload to Autopilot</h6>
              <ul className="mb-2">
                <li>Total: {uploadResults.total}</li>
                <li className={uploadResults.successful > 0 ? 'text-success' : ''}>
                  {uploadResults.successful > 0 ? '✓' : '✗'} Uploaded: {uploadResults.successful}
                </li>
                <li className={uploadResults.failed > 0 ? 'text-danger' : 'text-muted'}>
                  {uploadResults.failed > 0 ? '✗' : '✓'} Failed: {uploadResults.failed}
                </li>
              </ul>

              <h6>🔍 Step 2: Autopilot Registration</h6>
              <ul className="mb-2">
                {uploadResults.registered ? (
                  <li className="text-success"><strong>✓ Devices confirmed visible in Autopilot</strong></li>
                ) : (
                  <li className="text-warning">⏱️ Devices pending registration (can take 5-10 minutes)</li>
                )}
              </ul>

              {uploadResults.groupTotal !== null && (
                <>
                  <h6>🔄 Step 3: Azure AD Sync & Group Assignment</h6>
                  <ul className="mb-0">
                    {uploadResults.groupAdded > 0 ? (
                      <li className="text-success">
                        ✓ Added to group: {uploadResults.groupAdded} of {uploadResults.groupTotal} devices
                      </li>
                    ) : (
                      <li className="text-danger">
                        ✗ Failed to add devices to group (see errors above)
                      </li>
                    )}
                    {uploadResults.groupAdded > 0 && uploadResults.groupAdded < uploadResults.groupTotal && (
                      <li className="text-warning">
                        ⚠️ {uploadResults.groupTotal - uploadResults.groupAdded} device(s) could not be added
                      </li>
                    )}
                  </ul>
                </>
              )}
            </div>

            {!uploadResults.registered && uploadResults.successful > 0 && (
              <div className="mt-3 alert alert-info mb-0">
                <small>⏱️ Devices uploaded successfully but not yet visible. Please refresh the page periodically to check.</small>
              </div>
            )}
          </Alert>
        )}
      </Card.Body>
    </Card>
  );
};

export default HashUpload;
