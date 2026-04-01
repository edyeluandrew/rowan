import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './shared/context/AuthContext'
import { SocketProvider } from './shared/context/SocketContext'
import App from './app/App'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <SocketProvider>
        <App />
      </SocketProvider>
    </AuthProvider>
  </StrictMode>,
)
