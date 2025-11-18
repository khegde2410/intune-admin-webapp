import React from 'react';
import { Container } from 'react-bootstrap';
import { useLocation } from 'react-router-dom';
import NavigationBar from './NavigationBar';
import Sidebar from './Sidebar';
import { AuthenticatedTemplate, UnauthenticatedTemplate } from '@azure/msal-react';
import SignInButton from '../Auth/SignInButton';
import { hasConfiguration } from '../../utils/settingsManager';

const PageLayout = ({ children }) => {
  const location = useLocation();
  const isSettingsPage = location.pathname === '/settings';
  const isConfigured = hasConfiguration();

  // If on settings page, just show the content without auth
  if (isSettingsPage) {
    return (
      <>
        <NavigationBar />
        <Container fluid className="p-4">
          {children}
        </Container>
      </>
    );
  }

  // If not configured, don't show auth templates (redirect will happen)
  if (!isConfigured) {
    return (
      <>
        <NavigationBar />
        <Container fluid className="p-4">
          {children}
        </Container>
      </>
    );
  }

  // Normal authenticated flow
  return (
    <>
      <NavigationBar />
      <AuthenticatedTemplate>
        <div className="d-flex">
          <Sidebar />
          <Container fluid className="main-content p-4">
            {children}
          </Container>
        </div>
      </AuthenticatedTemplate>
      <UnauthenticatedTemplate>
        <Container className="text-center mt-5">
          <h2>Intune Admin Portal</h2>
          <p className="lead">Please sign in to access the administration tools</p>
          <SignInButton />
        </Container>
      </UnauthenticatedTemplate>
    </>
  );
};

export default PageLayout;
