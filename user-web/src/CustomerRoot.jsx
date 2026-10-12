/**
 * Customer wallet shell for rowanpay.app.
 * The trader site does not mount this.
 */
import { AuthProvider } from './context/AuthContext'
import { BiometricLockProvider } from './shared/context/BiometricLockContext'
import App from './App'

export default function CustomerRoot() {
  return (
    <AuthProvider>
      <BiometricLockProvider>
        <App />
      </BiometricLockProvider>
    </AuthProvider>
  )
}
