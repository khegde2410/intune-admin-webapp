import React, { useState } from 'react';
import { Card, Form, Button, Alert, Table, ProgressBar } from 'react-bootstrap';
import { useMsal } from '@azure/msal-react';
import Papa from 'papaparse';
import autopilotService from '../../services/autopilotService';
import { graphScopes } from '../../utils/authConfig';
import { acquireTokenWithFallback } from '../../utils/msalHelper';

const HashUpload = () => {
  const { instance, accounts } = useMsal();
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');

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
      const response = await acquireTokenWithFallback(
        instance,
        graphScopes.autopilot,
        accounts[0]
      );
      
      setProgress(20);
      console.log('Starting upload of', parsedData.length, 'devices');
      
      const results = await autopilotService.uploadAutopilotHash(
        response.accessToken,
        parsedData
      );

      console.log('Upload results:', results);
      setProgress(40);
      setProgressMessage('Upload complete. Waiting for devices to register...');
      
      // Log failed uploads
      const failedUploads = results.filter(r => r.status === 'rejected');
      if (failedUploads.length > 0) {
        console.error('Failed uploads:', failedUploads.map(f => f.reason));
      }

      const successfulUploads = results.filter(r => r.status === 'fulfilled').length;
      
      if (successfulUploads > 0) {
        // Poll for devices to appear in registered list
        console.log('Waiting for devices to register...');
        let attempts = 0;
        const maxAttempts = 24; // 4 minutes (24 * 10 seconds)
        let devicesFound = false;
        
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
            const foundDevices = devices.filter(d => uploadedSerials.includes(d.serialNumber));
            
            console.log(`Attempt ${attempts}/${maxAttempts}: Found ${foundDevices.length} of ${successfulUploads} devices`);
            
            if (foundDevices.length >= successfulUploads) {
              devicesFound = true;
              setProgress(100);
              setProgressMessage('All devices registered successfully!');
              console.log('All devices registered successfully!');
            }
          } catch (pollError) {
            console.error('Error polling for devices:', pollError);
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
      };

      setUploadResults(summary);
    } catch (error) {
      console.error('Upload error:', error);
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
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : 'Upload to Autopilot'}
            </Button>
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
          <Alert variant={uploadResults.registered && uploadResults.failed === 0 ? 'success' : 'warning'} className="mt-3">
            <strong>{uploadResults.registered ? '✅ Upload Complete - Devices Registered!' : '⚠️ Upload Complete - Registration Pending'}</strong>
            <ul className="mb-0 mt-2">
              <li>Total: {uploadResults.total}</li>
              <li>Uploaded: {uploadResults.successful}</li>
              <li>Failed: {uploadResults.failed}</li>
              {uploadResults.registered && (
                <li className="text-success"><strong>✓ Devices confirmed visible in Autopilot</strong></li>
              )}
            </ul>
            {!uploadResults.registered && uploadResults.successful > 0 && (
              <div className="mt-2 alert alert-info">
                <small>⏱️ Devices uploaded successfully but not yet visible. This can take 5-10 minutes. Please refresh the page periodically to check.</small>
              </div>
            )}
          </Alert>
        )}
      </Card.Body>
    </Card>
  );
};

export default HashUpload;
