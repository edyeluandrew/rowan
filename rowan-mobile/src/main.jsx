import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { BiometricLockProvider } from './shared/context/BiometricLockContext';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <BiometricLockProvider>
          <App />
        </BiometricLockProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
