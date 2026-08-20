import { createContext, useContext, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import useTraderWalletState from '../hooks/useTraderWallet'

const TraderWalletContext = createContext(null)

/**
 * One shared trader wallet for verified routes.
 * Auto-creates and links the profile address on first open.
 */
export function TraderWalletProvider({ children }) {
  const { trader } = useAuth()
  const traderId = trader?.id
  const wallet = useTraderWalletState(traderId)

  useEffect(() => {
    if (wallet.loading || !traderId) return
    wallet.ensureWallet().catch(() => {})
  }, [wallet.loading, wallet.ensureWallet, traderId])

  return (
    <TraderWalletContext.Provider value={wallet}>
      {children}
    </TraderWalletContext.Provider>
  )
}

export function useTraderWallet() {
  const ctx = useContext(TraderWalletContext)
  if (!ctx) {
    throw new Error('useTraderWallet must be used inside TraderWalletProvider')
  }
  return ctx
}
