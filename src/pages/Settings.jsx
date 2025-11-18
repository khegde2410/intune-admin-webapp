import React, { useState, useEffect } from 'react';
import { Card, Form, Button, Alert, InputGroup } from 'react-bootstrap';
import CryptoJS from 'crypto-js';

const Settings = () => {
  const [clientId, setClientId] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [showClientId, setShowClientId] = useState(false);
  const [showTenantId, setShowTenantId] = useState(false);

  // Encryption key (in production, this should be more secure)
  const ENCRYPTION_KEY = 'intune-admin-app-secret-key-2025';

  useEffect(() => {
    loadSettings();
  }, []);

  const encrypt = (text) => {
    return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
  };

  const decrypt = (ciphertext) => {
    try {
      const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (e) {
      return '';
    }
  };

  const loadSettings = () => {
    try {
      const encryptedClientId = localStorage.getItem('intune_client_id');
      const encryptedTenantId = localStorage.getItem('intune_tenant_id');

      if (encryptedClientId) {
        const decrypted = decrypt(encryptedClientId);
        setClientId(decrypted);
        // Auto-hide if already configured
        if (decrypted) {
          setShowClientId(false);
        }
      }
      if (encryptedTenantId) {
        const decrypted = decrypt(encryptedTenantId);
        setTenantId(decrypted);
        // Auto-hide if already configured
        if (decrypted) {
          setShowTenantId(false);
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      setError('Failed to load settings');
    }
  };

  const handleSave = () => {
    setSaved(false);
    setError('');

    if (!clientId || !tenantId) {
      setError('Both Client ID and Tenant ID are required');
      return;
    }

    // Validate GUID format
    const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!guidRegex.test(clientId)) {
      setError('Client ID must be a valid GUID');
      return;
    }
    if (!guidRegex.test(tenantId)) {
      setError('Tenant ID must be a valid GUID');
      return;
    }

    try {
      // Encrypt and save
      const encryptedClientId = encrypt(clientId);
      const encryptedTenantId = encrypt(tenantId);

      localStorage.setItem('intune_client_id', encryptedClientId);
      localStorage.setItem('intune_tenant_id', encryptedTenantId);

      setSaved(true);
      
      // Dispatch custom event for same-tab updates
      window.dispatchEvent(new Event('configurationUpdated'));
      
      // Prompt user to reload
      setTimeout(() => {
        if (window.confirm('Settings saved! The page needs to reload for changes to take effect. Reload now?')) {
          window.location.reload();
        }
      }, 1000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setError('Failed to save settings');
    }
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear all settings? This will sign you out.')) {
      localStorage.removeItem('intune_client_id');
      localStorage.removeItem('intune_tenant_id');
      setClientId('');
      setTenantId('');
      setSaved(false);
      setError('');
      
      // Clear MSAL cache
      localStorage.clear();
      sessionStorage.clear();
      
      window.location.href = '/';
    }
  };

  const maskValue = (value) => {
    if (!value || value.length < 8) return '••••••••';
    return value.substring(0, 8) + '••••••••••••••••••••••••••••';
  };

  const isFirstTimeSetup = !clientId && !tenantId;

  return (
    <div>
      <h2 className="mb-4">Application Settings</h2>

      {isFirstTimeSetup && (
        <Alert variant="warning">
          <strong>⚠️ First Time Setup Required</strong>
          <p className="mb-0 mt-2">
            Please configure your Azure AD credentials below to start using the application.
          </p>
        </Alert>
      )}

      <Card>
        <Card.Header>
          <h5>Azure AD Configuration</h5>
        </Card.Header>
        <Card.Body>
          {saved && (
            <Alert variant="success" dismissible onClose={() => setSaved(false)}>
              ✅ Settings saved successfully!
            </Alert>
          )}
          {error && (
            <Alert variant="danger" dismissible onClose={() => setError('')}>
              ❌ {error}
            </Alert>
          )}

          <Alert variant="info">
            <strong>Setup Instructions:</strong>
            <ol className="mb-0 mt-2">
              <li>Go to <a href="https://portal.azure.com" target="_blank" rel="noopener noreferrer">Azure Portal</a> → Azure Active Directory → App Registrations</li>
              <li>Create or select your app registration</li>
              <li>Copy the <strong>Application (client) ID</strong> from the Overview page</li>
              <li>Copy the <strong>Directory (tenant) ID</strong> from the Overview page</li>
              <li>Ensure Redirect URI is set to: <code>{window.location.origin}</code> (type: Single-page application)</li>
              <li>Grant required API permissions with admin consent (see below)</li>
            </ol>
          </Alert>

          <Form>
            <Form.Group className="mb-3">
              <Form.Label>
                <strong>Application (Client) ID</strong>
              </Form.Label>
              <InputGroup>
                <Form.Control
                  type={showClientId ? "text" : "password"}
                  placeholder="00000000-0000-0000-0000-000000000000"
                  value={showClientId ? clientId : maskValue(clientId)}
                  onChange={(e) => {
                    if (showClientId) {
                      setClientId(e.target.value);
                    }
                  }}
                  readOnly={!showClientId}
                />
                <Button 
                  variant="outline-secondary" 
                  onClick={() => setShowClientId(!showClientId)}
                  disabled={!clientId}
                >
                  {showClientId ? '🔒 Hide' : '👁️ Show'}
                </Button>
              </InputGroup>
              <Form.Text className="text-muted">
                The Application (client) ID from your Azure AD app registration
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>
                <strong>Directory (Tenant) ID</strong>
              </Form.Label>
              <InputGroup>
                <Form.Control
                  type={showTenantId ? "text" : "password"}
                  placeholder="00000000-0000-0000-0000-000000000000"
                  value={showTenantId ? tenantId : maskValue(tenantId)}
                  onChange={(e) => {
                    if (showTenantId) {
                      setTenantId(e.target.value);
                    }
                  }}
                  readOnly={!showTenantId}
                />
                <Button 
                  variant="outline-secondary" 
                  onClick={() => setShowTenantId(!showTenantId)}
                  disabled={!tenantId}
                >
                  {showTenantId ? '🔒 Hide' : '👁️ Show'}
                </Button>
              </InputGroup>
              <Form.Text className="text-muted">
                The Directory (tenant) ID from your Azure AD
              </Form.Text>
            </Form.Group>

            <div className="d-flex gap-2">
              <Button variant="primary" onClick={handleSave} disabled={!showClientId && !showTenantId && clientId && tenantId}>
                Save Configuration
              </Button>
              {(clientId || tenantId) && (
                <Button variant="outline-secondary" onClick={() => {
                  setShowClientId(true);
                  setShowTenantId(true);
                }}>
                  Edit Configuration
                </Button>
              )}
              <Button variant="outline-danger" onClick={handleClear}>
                Clear All Settings
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>

      <Card className="mt-4">
        <Card.Header>
          <h5>Security Information</h5>
        </Card.Header>
        <Card.Body>
          <p>
            <strong>🔒 Data Storage:</strong> Your Client ID and Tenant ID are encrypted using AES encryption
            before being stored in browser local storage.
          </p>
          <p>
            <strong>⚠️ Important:</strong> These credentials are stored locally in your browser. 
            Do not use this application on shared or public computers.
          </p>
          <p className="mb-0">
            <strong>🔑 Required Permissions:</strong> Your Azure AD app must have the following Graph API permissions:
            DeviceManagementManagedDevices.ReadWrite.All, DeviceManagementServiceConfig.ReadWrite.All, 
            Device.ReadWrite.All, Directory.Read.All, User.Read
          </p>
        </Card.Body>
      </Card>
    </div>
  );
};

export default Settings;
