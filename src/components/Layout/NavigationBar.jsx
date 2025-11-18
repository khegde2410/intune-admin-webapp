import React from 'react';
import { Navbar, Container, Nav } from 'react-bootstrap';
import { AuthenticatedTemplate, useMsal } from '@azure/msal-react';
import SignOutButton from '../Auth/SignOutButton';

const NavigationBar = () => {
  const { accounts } = useMsal();
  const username = accounts[0]?.name || '';

  return (
    <Navbar bg="dark" variant="dark" expand="lg">
      <Container fluid>
        <Navbar.Brand href="/">Intune Admin Portal</Navbar.Brand>
        <Navbar.Toggle />
        <Navbar.Collapse className="justify-content-end">
          <AuthenticatedTemplate>
            <Nav>
              <Navbar.Text className="me-3">
                Signed in as: <strong>{username}</strong>
              </Navbar.Text>
              <SignOutButton />
            </Nav>
          </AuthenticatedTemplate>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default NavigationBar;
