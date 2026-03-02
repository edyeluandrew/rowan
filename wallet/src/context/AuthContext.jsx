import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getSecure, setSecure, clearAllSecure } from '../utils/storage'
import { setPreference } from '../utils/storage'
import { setClientToken } from '../api/client'
import { getChallenge, register, login } from '../api/auth'
import { signChallenge } from '../utils/stellar'
import { hashPhoneNumber } from '../utils/crypto'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [keypair, setKeypair] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      try {
        const storedToken = await getSecure('rowan_user_token')
        const storedKeypair = await getSecure('rowan_stellar_keypair')
        const storedProfile = await getSecure('rowan_user_profile')

        if (!cancelled && storedToken && storedKeypair) {
          const kp = JSON.parse(storedKeypair)
          setToken(storedToken)
          setKeypair(kp)
          setClientToken(storedToken)
          if (storedProfile) {
            setUser(JSON.parse(storedProfile))
          }
          setIsAuthenticated(true)
        } else if (!cancelled && storedKeypair) {
          setKeypair(JSON.parse(storedKeypair))
        }
      } catch {
        /* secure storage read failure — treat as logged out */
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    bootstrap()
    return () => { cancelled = true }
  }, [])

  const registerWithWallet = useCallback(async (phoneNumber) => {
    const stored = await getSecure('rowan_stellar_keypair')
    if (!stored) throw new Error('No wallet found')
    const kp = JSON.parse(stored)

    const challengeRes = await getChallenge(kp.publicKey)
    const nonce = challengeRes.challenge || challengeRes.nonce
    const signature = await signChallenge(nonce, kp.secretKey)
    const phoneHash = await hashPhoneNumber(phoneNumber)

    try {
      const result = await register({
        stellarAddress: kp.publicKey,
        signature,
        nonce,
        phoneHash,
      })

      await setSecure('rowan_user_token', result.token)
      await setSecure('rowan_user_profile', JSON.stringify(result.user))
      setClientToken(result.token)
      setToken(result.token)
      setUser(result.user)
      setKeypair(kp)
      setIsAuthenticated(true)
      return result
    } catch (err) {
      if (err.message?.includes('409') || err.message?.toLowerCase().includes('conflict')) {
        return loginWithWallet()
      }
      throw err
    }
  }, [])

  const loginWithWallet = useCallback(async () => {
    const stored = await getSecure('rowan_stellar_keypair')
    if (!stored) throw new Error('No wallet found')
    const kp = JSON.parse(stored)

    const challengeRes = await getChallenge(kp.publicKey)
    const nonce = challengeRes.challenge || challengeRes.nonce
    const signature = await signChallenge(nonce, kp.secretKey)

    const result = await login({
      stellarAddress: kp.publicKey,
      signature,
      nonce,
    })

    await setSecure('rowan_user_token', result.token)
    await setSecure('rowan_user_profile', JSON.stringify(result.user))
    setClientToken(result.token)
    setToken(result.token)
    setUser(result.user)
    setKeypair(kp)
    setIsAuthenticated(true)
    return result
  }, [])

  const logout = useCallback(async () => {
    setToken(null)
    setUser(null)
    setKeypair(null)
    setIsAuthenticated(false)
    setClientToken(null)
    await clearAllSecure()
    await setPreference('rowan_onboarding_complete', 'false')
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        keypair,
        isAuthenticated,
        isLoading,
        registerWithWallet,
        loginWithWallet,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
