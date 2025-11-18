import React from 'react';
import { useMsal } from '@azure/msal-react';
import { Button } from 'react-bootstrap';
import { loginRequest } from '../../utils/authConfig';

const SignInButton = () => {
  const { instance } = useMsal();
  const [error, setError] = React.useState(null);

  const handleLogin = async () => {
    try {
      console.log('Login request scopes:', loginRequest);
      const response = await instance.loginPopup(loginRequest);
      console.log('Login success:', response);
      setError(null);
    } catch (e) {
      console.error('Login error:', e);
      setError(e.message || 'Login failed. Check browser console for details.');
    }
  };

  return (
    <>
      <Button variant="primary" onClick={handleLogin}>
        Sign In
      </Button>
      {error && <div className="text-danger mt-2">{error}</div>}
    </>
  );
};

export default SignInButton;
