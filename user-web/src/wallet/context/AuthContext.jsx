/** Bridge: re-export wallet AuthContext (user-web has no trader role). */
export { AuthProvider, useAuth, ROLE_WALLET } from '../../context/AuthContext'
export const ROLE_TRADER = 'trader'
