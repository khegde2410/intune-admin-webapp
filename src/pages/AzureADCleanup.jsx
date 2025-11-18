import React from 'react';
import StaleDeviceList from '../components/AzureADCleanup/StaleDeviceList';

const AzureADCleanup = () => {
  return (
    <div>
      <h2 className="mb-4">Azure AD Device Cleanup</h2>
      <StaleDeviceList />
    </div>
  );
};

export default AzureADCleanup;
