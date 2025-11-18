# Intune Admin Web App - Deployment Guide

This guide provides step-by-step instructions for deploying the Intune Admin Web Application.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Azure AD App Registration](#azure-ad-app-registration)
3. [Building the Application](#building-the-application)
4. [Deployment Options](#deployment-options)
   - [Option 1: IIS (Windows Server)](#option-1-iis-windows-server)
   - [Option 2: Azure Static Web Apps](#option-2-azure-static-web-apps)
   - [Option 3: Docker Container](#option-3-docker-container)
5. [Post-Deployment Configuration](#post-deployment-configuration)
6. [User Setup](#user-setup)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:
- ✅ Azure AD tenant with Global Administrator access
- ✅ Node.js 16 or later installed (for building)
- ✅ Web server or hosting platform (IIS, Azure, Docker, etc.)
- ✅ SSL certificate for HTTPS (required for production)

---

## Azure AD App Registration

### Step 1: Create App Registration

1. Open [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **+ New registration**

4. Fill in the registration form:
   - **Name**: `Intune Admin Web App` (or your preferred name)
   - **Supported account types**: Select **Accounts in this organizational directory only**
   - **Redirect URI**: 
     - Platform: **Single-page application (SPA)**
     - URL: `https://yourdomain.com` (replace with your actual domain)
     - For testing: `http://localhost:3000`

5. Click **Register**

### Step 2: Note Your IDs

After registration, you'll see the **Overview** page. Copy these values (you'll need them later):

- **Application (client) ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- **Directory (tenant) ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

💡 **Tip**: Keep these in a safe place - you'll enter them in the Settings page of the application.

### Step 3: Configure API Permissions

1. In your app registration, click **API permissions** in the left menu
2. Click **+ Add a permission**
3. Select **Microsoft Graph**
4. Select **Application permissions**

5. Add the following permissions:
   - `DeviceManagementManagedDevices.ReadWrite.All`
   - `DeviceManagementServiceConfig.ReadWrite.All`
   - `Device.ReadWrite.All`
   - `Directory.Read.All`

6. Also add **Delegated permissions**:
   - `User.Read`

7. Click **Add permissions**
8. Click **✓ Grant admin consent for [Your Organization]**
9. Confirm by clicking **Yes**

✅ You should see green checkmarks next to all permissions.

---

## Building the Application

### Step 1: Clone and Install Dependencies

```powershell
# Clone the repository
git clone <repository-url>
cd intune-admin-webapp

# Install dependencies
npm install --legacy-peer-deps
```

### Step 2: Build for Production

```powershell
# Create optimized production build
npm run build
```

This creates a `build` folder with all the production files.

### Step 3: Create Distribution Package (Optional)

```powershell
# On Windows
npm run package:win

# On Linux/Mac
npm run package:linux
```

This creates a compressed archive ready for distribution.

---

## Deployment Options

Choose the deployment method that best fits your infrastructure:

---

## Option 1: IIS (Windows Server)

### Prerequisites
- Windows Server 2016 or later
- IIS 10 or later installed
- URL Rewrite Module installed

### Step 1: Install IIS and Required Modules

```powershell
# Install IIS (run as Administrator)
Install-WindowsFeature -name Web-Server -IncludeManagementTools

# Download and install URL Rewrite Module
# Download from: https://www.iis.net/downloads/microsoft/url-rewrite
# Or use Web Platform Installer
```

### Step 2: Create IIS Website

1. Open **IIS Manager** (Run → `inetmgr`)
2. Right-click **Sites** → **Add Website**
3. Configure the website:
   - **Site name**: `IntuneAdminApp`
   - **Physical path**: `C:\inetpub\wwwroot\intune-admin` (or your preferred location)
   - **Binding**:
     - Type: `https`
     - Port: `443`
     - SSL certificate: Select your certificate
   - **Host name**: `intune-admin.yourdomain.com`

4. Click **OK**

### Step 3: Deploy Application Files

1. Copy all files from the `build` folder to your IIS physical path:
   ```powershell
   Copy-Item -Path ".\build\*" -Destination "C:\inetpub\wwwroot\intune-admin" -Recurse
   ```

### Step 4: Configure URL Rewrite

Create `web.config` in the root directory:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="React Routes" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="/" />
        </rule>
      </rules>
    </rewrite>
    <staticContent>
      <mimeMap fileExtension=".json" mimeType="application/json" />
    </staticContent>
    <httpProtocol>
      <customHeaders>
        <add name="X-Frame-Options" value="SAMEORIGIN" />
        <add name="X-Content-Type-Options" value="nosniff" />
      </customHeaders>
    </httpProtocol>
  </system.webServer>
</configuration>
```

### Step 5: Test the Deployment

1. Browse to `https://intune-admin.yourdomain.com`
2. You should see the application login page

---

## Option 2: Azure Static Web Apps

### Step 1: Create Static Web App

1. Go to [Azure Portal](https://portal.azure.com)
2. Click **+ Create a resource**
3. Search for **Static Web App** and click **Create**

4. Configure the static web app:
   - **Subscription**: Select your subscription
   - **Resource Group**: Create new or use existing
   - **Name**: `intune-admin-webapp`
   - **Plan type**: **Free** (or Standard for production)
   - **Region**: Choose closest to your users
   - **Deployment source**: **Other** (we'll upload manually)

5. Click **Review + create** → **Create**

### Step 2: Deploy Application

```powershell
# Install Azure Static Web Apps CLI
npm install -g @azure/static-web-apps-cli

# Build the application
npm run build

# Deploy to Azure (you'll be prompted to login)
swa deploy ./build --deployment-token <your-deployment-token>
```

To get your deployment token:
1. In Azure Portal, go to your Static Web App
2. Click **Manage deployment token**
3. Copy the token

### Step 3: Configure Custom Domain (Optional)

1. In your Static Web App, click **Custom domains**
2. Click **+ Add**
3. Follow the wizard to add your custom domain

---

## Option 3: Docker Container

### Step 1: Create Dockerfile

Create `Dockerfile` in the project root:

```dockerfile
# Build stage
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Step 2: Create Nginx Configuration

Create `nginx.conf`:

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Step 3: Build and Run

```powershell
# Build Docker image
docker build -t intune-admin-webapp .

# Run container
docker run -d -p 80:80 --name intune-admin intune-admin-webapp

# Or with HTTPS (using existing certificates)
docker run -d -p 443:443 \
  -v /path/to/cert.crt:/etc/nginx/cert.crt \
  -v /path/to/cert.key:/etc/nginx/cert.key \
  --name intune-admin intune-admin-webapp
```

### Step 4: Access Application

Open browser to `http://localhost` or your server IP/domain.

---

## Post-Deployment Configuration

### Step 1: Update Azure AD Redirect URI

1. Go to [Azure Portal](https://portal.azure.com) → **Azure Active Directory** → **App registrations**
2. Select your **Intune Admin Web App**
3. Click **Authentication**
4. Under **Single-page application**, update the Redirect URI:
   - Remove: `http://localhost:3000`
   - Add: `https://intune-admin.yourdomain.com` (your production URL)
5. Click **Save**

### Step 2: Configure HTTPS

**For IIS:**
1. In IIS Manager, select your site
2. Click **Bindings** → **Add**
3. Select **https**, port **443**
4. Choose your SSL certificate
5. Click **OK**

**For Azure Static Web Apps:**
- HTTPS is automatically configured

**For Docker:**
- Configure nginx with SSL certificates (see Docker documentation)

### Step 3: Test Authentication

1. Open your application in a browser
2. Click **Sign In**
3. Authenticate with Azure AD
4. Verify you can access the application

---

## User Setup

### Step 1: First-Time Configuration

When users first access the application:

1. Navigate to the application URL
2. Sign in with Azure AD credentials
3. Click **Settings** in the sidebar
4. Enter the following information:
   - **Application (Client) ID**: (from Azure AD App Registration)
   - **Directory (Tenant) ID**: (from Azure AD App Registration)
5. Click **Save Configuration**
6. Reload the page when prompted

✅ Configuration is encrypted and stored securely in the browser.

### Step 2: Grant Users Access

Users need appropriate Azure AD roles:

1. In Azure Portal → **Azure Active Directory** → **Roles and administrators**
2. Assign users to one of these roles:
   - **Intune Administrator** (for device management)
   - **Global Administrator** (full access)
   - **Cloud Device Administrator** (for device operations)

---

## Troubleshooting

### Issue: "Invalid redirect URI" error

**Solution:**
1. Verify the redirect URI in Azure AD matches your application URL exactly
2. Check for http vs https mismatch
3. Ensure no trailing slashes

### Issue: "Insufficient privileges" error

**Solution:**
1. Go to Azure AD → App registrations → Your app → API permissions
2. Verify all permissions are granted
3. Click "Grant admin consent" again if needed
4. Wait 5-10 minutes for changes to propagate

### Issue: Application shows blank page

**Solution:**
1. Check browser console for errors (F12)
2. Verify web server is configured for SPA routing (web.config for IIS)
3. Clear browser cache (Ctrl+Shift+Delete)
4. Check web server logs

### Issue: Cannot save settings

**Solution:**
1. Ensure browser cookies and localStorage are enabled
2. Not using private/incognito mode
3. Browser is not blocking third-party cookies

### Issue: "CORS" errors in console

**Solution:**
- This usually means Microsoft Graph API permissions issue
- Verify all API permissions are granted in Azure AD
- Check the redirect URI configuration

---

## Security Checklist

Before going to production:

- [ ] HTTPS is enabled and certificate is valid
- [ ] Azure AD redirect URI is updated to production URL
- [ ] All API permissions are granted with admin consent
- [ ] Web server security headers are configured
- [ ] Application is not accessible over HTTP (redirect to HTTPS)
- [ ] Regular updates: `npm audit fix` and rebuild
- [ ] Backup of Azure AD App Registration IDs
- [ ] User access is restricted to authorized personnel

---

## Support and Maintenance

### Regular Updates

```powershell
# Update dependencies
npm update

# Check for security vulnerabilities
npm audit

# Fix security issues
npm audit fix

# Rebuild and redeploy
npm run build
```

### Monitoring

- Monitor Azure AD sign-in logs for authentication issues
- Check web server logs for application errors
- Monitor Graph API usage and rate limits

### Backup

Keep backups of:
- Azure AD App Registration details (Client ID, Tenant ID)
- Application build files
- Configuration files (web.config, nginx.conf)

---

## Next Steps

After successful deployment:

1. **Train Users**: Provide training on how to use each feature
2. **Document Processes**: Create internal documentation for your organization's workflows
3. **Monitor Usage**: Review logs and user feedback
4. **Plan Updates**: Schedule regular update cycles

---

## Need Help?

- Check the main [README.md](README.md) for feature documentation
- Review Azure AD App Registration settings
- Check browser console for detailed error messages
- Verify all prerequisites are met

---

**Deployment Checklist:**

- [ ] Azure AD App Registration created
- [ ] API permissions granted with admin consent
- [ ] Application built successfully
- [ ] Web server configured
- [ ] SSL/HTTPS enabled
- [ ] Redirect URI updated in Azure AD
- [ ] Application accessible via browser
- [ ] Settings page configuration works
- [ ] Authentication successful
- [ ] All features tested

🎉 **Congratulations!** Your Intune Admin Web App is now deployed and ready to use!
