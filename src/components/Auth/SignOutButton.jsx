import React from 'react';
import { useMsal } from '@azure/msal-react';
import { Button } from 'react-bootstrap';

const SignOutButton = () => {
  const { instance } = useMsal();

  const handleLogout = () => {
    instance.logoutPopup().catch(e => {
      console.error('Logout error:', e);
    });
  };

  return (
    <Button variant="outline-light" onClick={handleLogout}>
      Sign Out
    </Button>
  );
};

export default SignOutButton;
