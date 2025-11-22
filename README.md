# Intune Admin Web Application

A modern React-based web application for managing Microsoft Intune, Windows Autopilot, and Azure AD devices.

![Dashboard](docs/screenshots/dashboard.png)

## ✨ Features

- **Autopilot Management**: Upload hardware hashes via CSV and view registered devices with progress tracking
- **Device Offboarding**: Remove devices from Intune, Autopilot, and Azure AD in the correct sequence
- **Secure Configuration**: Encrypted credential storage through in-app Settings page

## 📸 Screenshots

### Settings Page
![Settings Page](docs/screenshots/settings.png)
*Secure configuration with encrypted credential storage*

### Autopilot Management
![Autopilot Management](docs/screenshots/autopilot-management.png)
*Upload hardware hashes and manage Autopilot devices*

### Device Offboarding
![Device Offboarding](docs/screenshots/device-offboarding.png)
*Remove devices from Intune, Autopilot, and Azure AD*

## 📋 Prerequisites

- Node.js 16+ and npm
- Azure AD tenant with admin access
- Azure AD app registration with required Graph API permissions

## 🚀 Quick Start

### 1. Azure AD App Registration

1. Go to [Azure Portal](https://portal.azure.com) → Azure Active Directory → App Registrations
2. Create new registration:
   - Name: Intune Admin Web App
   - Supported accounts: Single tenant
   - Redirect URI: Single-page application - `http://localhost:3000` (or your domain)

3. Grant API permissions (with admin consent):
   - DeviceManagementManagedDevices.ReadWrite.All
   - DeviceManagementServiceConfig.ReadWrite.All
   - Device.ReadWrite.All
   - Directory.Read.All
   - User.Read

### 2. Application Configuration

1. Clone the repository
   ```bash
   git clone https://github.com/YOUR-USERNAME/intune-admin-webapp.git
   cd intune-admin-webapp
   ```

2. Install dependencies
   ```bash
   npm install --legacy-peer-deps
   ```

3. Start the development server
   ```bash
   npm start
   ```

4. Navigate to the Settings page in the application
5. Enter your Azure AD Application (Client) ID and Directory (Tenant) ID
6. Click "Save Configuration" (credentials are encrypted and stored securely in browser)

**Note:** Client ID and Tenant ID are configured through the Settings page and stored encrypted in the browser. Never hardcode these values.

## 🔍 Troubleshooting & Logs

### Built-in Logging System

The application includes a comprehensive logging system for troubleshooting operations:

**Accessing Logs:**
1. Navigate to **Settings** page
2. Scroll down to **Application Logs & Troubleshooting** section
3. View real-time logs with filtering options

**Log Features:**
- **5 Log Levels**: DEBUG, INFO, WARN, ERROR, SUCCESS
- **Context Filtering**: Filter by Autopilot, Device, Authentication, Graph API
- **Auto-refresh**: Enable to see logs update during operations
- **Export Logs**: Download complete log history as text file
- **Persistence**: Logs survive page refresh (stored in browser localStorage)

**Common Issues:**

**Azure AD Group Assignment Failing:**
- **Symptom**: Device uploads successfully but group assignment fails with "Resource does not exist"
- **Cause**: Device registered in Autopilot but not yet synced to Azure AD (can take 1-30 minutes)
- **Solution**: The system automatically waits 5 minutes and retries 3 times. Check logs for:
  ```
  [Autopilot] Azure AD Sync: Waiting for device to appear...
  [Autopilot] Group Assignment: Retry attempt 1/3
  ```
- **Manual Verification**: Check Azure Portal → Devices to confirm device has Azure AD Device ID

**Permission Errors:**
- **Symptom**: "Insufficient privileges" or "Forbidden" errors
- **Solution**: Verify all required Graph API permissions have admin consent
- **Required Scopes**:
  - `DeviceManagementServiceConfig.ReadWrite.All` (Autopilot)
  - `GroupMember.ReadWrite.All` (Group assignment)
  - `Device.ReadWrite.All` (Azure AD devices)
  - `Group.Read.All` (List groups)

**Upload Workflow Timing:**
```
Phase 1: Upload to Autopilot (immediate)
Phase 2: Registration polling (up to 4 minutes)
Phase 3: Azure AD sync wait (up to 5 minutes)
Phase 4: Group assignment with retries (up to 3 attempts, 30s/60s delays)
Total possible time: ~10 minutes per device
```

**Debugging Tips:**
1. Enable browser console (F12) to see detailed API responses
2. Use log export feature to share with support
3. Filter logs by ERROR level to focus on failures
4. Check timestamps to identify timing-related issues
5. Verify device appears in Azure Portal before group assignment