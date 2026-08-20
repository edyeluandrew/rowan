import { createContext, useContext, useEffect } from 'react'
import useTraderWalletState from '../hooks/useTraderWallet'

const TraderWalletContext = createContext(null)

/**
 * One shared trader wallet for verified routes.
 * Auto-creates and links the profile address on first open.
 */
export function TraderWalletProvider({ children }) {
  const wallet = useTraderWalletState()

  useEffect(() => {
    if (wallet.loading) return
    wallet.ensureWallet().catch(() => {})
  }, [wallet.loading, wallet.ensureWallet])

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
