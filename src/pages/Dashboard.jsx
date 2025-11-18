import React from 'react';
import { Card, Row, Col } from 'react-bootstrap';
import { FaRocket, FaTrash, FaBroom, FaMobileAlt } from 'react-icons/fa';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const features = [
    {
      title: 'Autopilot Management',
      icon: <FaRocket size={40} />,
      description: 'Upload hardware hashes and manage Autopilot device registrations',
      link: '/autopilot',
      color: 'primary',
    },
    {
      title: 'Device Offboarding',
      icon: <FaTrash size={40} />,
      description: 'Remove devices from Intune, Autopilot, and Azure AD',
      link: '/offboarding',
      color: 'danger',
    },
    // {
    //   title: 'Azure AD Cleanup',
    //   icon: <FaBroom size={40} />,
    //   description: 'Identify and remove stale device objects',
    //   link: '/cleanup',
    //   color: 'warning',
    // },
    // {
    //   title: 'Software Status',
    //   icon: <FaMobileAlt size={40} />,
    //   description: 'Monitor application deployment and installation status',
    //   link: '/software',
    //   color: 'success',
    // },
  ];

  return (
    <div>
      <h2 className="mb-4">Intune Administration Dashboard</h2>
      <Row>
        {features.map((feature, idx) => (
          <Col key={idx} md={6} lg={3} className="mb-4">
            <Link to={feature.link} style={{ textDecoration: 'none' }}>
              <Card className="h-100 feature-card">
                <Card.Body className="text-center">
                  <div className={`text-${feature.color} mb-3`}>
                    {feature.icon}
                  </div>
                  <Card.Title>{feature.title}</Card.Title>
                  <Card.Text className="text-muted">
                    {feature.description}
                  </Card.Text>
                </Card.Body>
              </Card>
            </Link>
          </Col>
        ))}
      </Row>

      <Card className="mt-4">
        <Card.Header>
          <h5>Quick Start Guide</h5>
        </Card.Header>
        <Card.Body>
          <ol>
            <li><strong>Autopilot Management:</strong> Upload CSV files with hardware hashes to register devices</li>
            <li><strong>Device Offboarding:</strong> Search for devices and remove them from all systems in the correct order</li>
            {/* <li><strong>Azure AD Cleanup:</strong> Filter stale devices and perform bulk deletions</li> */}
            {/* <li><strong>Software Status:</strong> Monitor application installation progress across your fleet</li> */}
          </ol>
          <p className="mb-0 mt-3">
            <strong>Note:</strong> This tool requires appropriate Microsoft Graph API permissions. 
            Ensure your account has the necessary admin roles.
          </p>
        </Card.Body>
      </Card>
    </div>
  );
};

export default Dashboard;
