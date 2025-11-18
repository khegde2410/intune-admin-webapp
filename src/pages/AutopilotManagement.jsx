import React, { useState } from 'react';
import { Row, Col } from 'react-bootstrap';
import HashUpload from '../components/AutopilotManagement/HashUpload';
import DeviceList from '../components/AutopilotManagement/DeviceList';

const AutopilotManagement = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  return (
    <div>
      <h2 className="mb-4">Autopilot Management</h2>
      <Row>
        <Col md={12} className="mb-4">
          <HashUpload onUploadComplete={() => setRefreshTrigger(prev => prev + 1)} />
        </Col>
        <Col md={12}>
          <DeviceList onRefresh={refreshTrigger} />
        </Col>
      </Row>
    </div>
  );
};

export default AutopilotManagement;
