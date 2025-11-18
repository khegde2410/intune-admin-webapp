import React, { useEffect, useState } from 'react';
import { MsalProvider } from '@azure/msal-react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import PageLayout from './components/Layout/PageLayout';
import Dashboard from './pages/Dashboard';
import AutopilotManagement from './pages/AutopilotManagement';
import DeviceOffboarding from './pages/DeviceOffboarding';
import Settings from './pages/Settings';
import { hasConfiguration } from './utils/settingsManager';
// import AzureADCleanup from './pages/AzureADCleanup';
// import SoftwareStatus from './pages/SoftwareStatus';

import './styles/App.css';

const ConfigurationGuard = ({ children }) => {
  const [isConfigured, setIsConfigured] = useState(hasConfiguration());

  useEffect(() => {
    const checkConfig = () => {
      setIsConfigured(hasConfiguration());
    };

    window.addEventListener('storage', checkConfig);
    // Custom event for same-tab updates
    window.addEventListener('configurationUpdated', checkConfig);

    return () => {
      window.removeEventListener('storage', checkConfig);
      window.removeEventListener('configurationUpdated', checkConfig);
    };
  }, []);

  if (!isConfigured) {
    return <Navigate to="/settings" replace />;
  }

  return children;
};

const App = ({ instance }) => {
  return (
    <MsalProvider instance={instance}>
      <Router>
        <PageLayout>
          <Routes>
            <Route path="/settings" element={<Settings />} />
            <Route path="/" element={<ConfigurationGuard><Dashboard /></ConfigurationGuard>} />
            <Route path="/autopilot" element={<ConfigurationGuard><AutopilotManagement /></ConfigurationGuard>} />
            <Route path="/offboarding" element={<ConfigurationGuard><DeviceOffboarding /></ConfigurationGuard>} />
            {/* <Route path="/cleanup" element={<AzureADCleanup />} /> */}
            {/* <Route path="/software" element={<SoftwareStatus />} /> */}
          </Routes>
        </PageLayout>
      </Router>
    </MsalProvider>
  );
};

export default App;
