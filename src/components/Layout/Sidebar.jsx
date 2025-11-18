import React from 'react';
import { Nav } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';
import { FaHome, FaRocket, FaTrash, FaBroom, FaMobileAlt, FaCog } from 'react-icons/fa';

const Sidebar = () => {
  const location = useLocation();

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: <FaHome /> },
    { path: '/autopilot', label: 'Autopilot Management', icon: <FaRocket /> },
    { path: '/offboarding', label: 'Device Offboarding', icon: <FaTrash /> },
    // { path: '/cleanup', label: 'Azure AD Cleanup', icon: <FaBroom /> },
    // { path: '/software', label: 'Software Status', icon: <FaMobileAlt /> },
    { path: '/settings', label: 'Settings', icon: <FaCog /> },
  ];

  return (
    <div className="sidebar bg-light" style={{ minWidth: '250px', minHeight: '100vh' }}>
      <Nav className="flex-column p-3">
        {menuItems.map((item) => (
          <Nav.Link
            key={item.path}
            as={Link}
            to={item.path}
            className={`sidebar-link ${location.pathname === item.path ? 'active' : ''}`}
          >
            <span className="me-2">{item.icon}</span>
            {item.label}
          </Nav.Link>
        ))}
      </Nav>
    </div>
  );
};

export default Sidebar;
