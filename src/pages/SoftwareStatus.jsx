import React from 'react';
import StatusDashboard from '../components/SoftwareStatus/StatusDashboard';

const SoftwareStatus = () => {
  return (
    <div>
      <h2 className="mb-4">Software Installation Status</h2>
      <StatusDashboard />
    </div>
  );
};

export default SoftwareStatus;
