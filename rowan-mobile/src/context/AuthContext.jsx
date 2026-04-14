/**
 * Unified AuthContext — handles both wallet (SEP-10) and trader (email/password) auth.
 *
 * Wallet sessions → persisted in Capacitor SecureStorage (survives app restart).
 * Trader sessions → memory-only (cleared on app close per security requirement).
 *
 * The JWT `role` field silently determines which interface renders.
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { setClientToken, onLogout } from '../shared/api/client';
import {
  getSecure, setSecure, clearAllSecure, clearPreferences, initStorage,
} from '../shared/utils/storage';

/* ── Wallet-specific imports (lazy to avoid bundling for traders) ── */
import { fetchStellarToml, verifyChallengeTransaction, signChallengeTransaction } from '../wallet/utils/sep10';
import { hashPhoneNumber } from '../wallet/utils/crypto';
import { getChallenge, submitChallenge, registerUser } from '../wallet/api/auth';
import { CURRENT_NETWORK } from '../wallet/utils/constants';

/* ── Trader-specific import ── */
import { loginTrader, signupTrader } from '../trader/api/auth';

const AuthContext = createContext(null);

/** Roles emitted by the backend JWT */
export const ROLE_WALLET = 'user';
export const ROLE_TRADER = 'trader';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);        // wallet user profile
  const [trader, setTrader] = useState(null);     // trader profile
  const [token, setToken] = useState(null);
  const [keypair, setKeypair] = useState(null);   // wallet keypair metadata (no secret)
  const [role, setRole] = useState(null);         // 'user' | 'trader'
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  /* ── Warm up SecureStoragePlugin in background on app start (don't wait) ── */
  useEffect(() => {
    initStorage(); // Fire and forget — initializes plugin in background
  }, []);

  /* ── Global 401 handler ── */
  useEffect(() => {
    onLogout(() => {
      setToken(null);
      setUser(null);
      setTrader(null);
      setKeypair(null);
      setRole(null);
      setIsAuthenticated(false);
    });
  }, []);

  /* ── Bootstrap: restore wallet session from secure storage ── */
  useEffect(() => {
    (async () => {
      try {
        console.log('[Auth] Starting bootstrap...');
        const t = await getSecure('rowan_token');
        console.log('[Auth] ✓ Token loaded:', t ? 'found' : 'empty');
        
        const u = await getSecure('rowan_user');
        console.log('[Auth] ✓ User loaded:', u ? 'found' : 'empty');
        
        const kp = await getSecure('rowan_stellar_keypair');
        console.log('[Auth] ✓ Keypair loaded:', kp ? 'found' : 'empty');

        if (t && u) {
          console.log('[Auth] Restoring wallet session...');
          setClientToken(t);
          setToken(t);
          const parsed = JSON.parse(u);
          setUser(parsed);
          setRole(ROLE_WALLET);
          setIsAuthenticated(true);
          if (kp) {
            const kpData = JSON.parse(kp);
            setKeypair({ publicKey: kpData.publicKey });
          }
          console.log('[Auth] ✓ Wallet session restored');
        } else {
          console.log('[Auth] No session found (first time or trader mode)');
        }
        // NOTE: trader sessions are memory-only — never restored from storage
      } catch (err) {
        console.error('[Auth] Bootstrap error:', err.message);
        /* treat as unauthenticated */
      } finally {
        console.log('[Auth] ✓ Bootstrap complete');
        setIsLoading(false);
      }
    })();
  }, []);

  /* ═══════════════════════════════════════════════════════
   *  WALLET AUTH — SEP-10 challenge-response
   * ═══════════════════════════════════════════════════════ */

  const registerWithWallet = useCallback(async (phoneNumber) => {
    const stored = await getSecure('rowan_stellar_keypair');
    if (!stored) throw new Error('No wallet keypair found');
    const kpData = JSON.parse(stored);
    const account = kpData.publicKey;

    const toml = await fetchStellarToml(import.meta.env.VITE_HOME_DOMAIN);
    const webAuthUrl = toml.webAuthEndpoint;

    const { transaction: challengeXdr } = await getChallenge(account, webAuthUrl);
    console.log('[Auth] Challenge received:', challengeXdr.substring(0, 50) + '...');
    
    verifyChallengeTransaction({
      challengeXdr,
      serverSigningKey: toml.signingKey,
      networkPassphrase: CURRENT_NETWORK.passphrase,
      homeDomain: import.meta.env.VITE_HOME_DOMAIN,
      clientPublicKey: account,
    });
    console.log('[Auth] Challenge verified');
    
    const signedXdr = signChallengeTransaction(challengeXdr, kpData.secretKey, CURRENT_NETWORK.passphrase);
    console.log('[Auth] Challenge signed:', signedXdr?.substring(0, 50) + '...');
    console.log('[Auth] Signed XDR type:', typeof signedXdr);
    console.log('[Auth] Signed XDR length:', signedXdr?.length);
    
    const phoneHash = await hashPhoneNumber(phoneNumber);
    const data = await registerUser({ transaction: signedXdr, phoneHash });

    const jwt = data.token;
    await setSecure('rowan_token', jwt);
    await setSecure('rowan_user', JSON.stringify(data.user || data));
    setClientToken(jwt);
    setToken(jwt);
    setUser(data.user || data);
    setKeypair({ publicKey: account });
    setRole(ROLE_WALLET);
    setIsAuthenticated(true);
    return data;
  }, []);

  const loginWithWallet = useCallback(async () => {
    const stored = await getSecure('rowan_stellar_keypair');
    if (!stored) throw new Error('No wallet keypair found');
    const kpData = JSON.parse(stored);
    const account = kpData.publicKey;

    const toml = await fetchStellarToml(import.meta.env.VITE_HOME_DOMAIN);
    const webAuthUrl = toml.webAuthEndpoint;

    const { transaction: challengeXdr } = await getChallenge(account, webAuthUrl);
    console.log('[Auth] Challenge received:', challengeXdr.substring(0, 50) + '...');
    
    verifyChallengeTransaction({
      challengeXdr,
      serverSigningKey: toml.signingKey,
      networkPassphrase: CURRENT_NETWORK.passphrase,
      homeDomain: import.meta.env.VITE_HOME_DOMAIN,
      clientPublicKey: account,
    });
    console.log('[Auth] Challenge verified');
    
    const signedXdr = signChallengeTransaction(challengeXdr, kpData.secretKey, CURRENT_NETWORK.passphrase);
    console.log('[Auth] Challenge signed:', signedXdr?.substring(0, 50) + '...');
    console.log('[Auth] Signed XDR type:', typeof signedXdr);
    console.log('[Auth] Signed XDR length:', signedXdr?.length);
    
    const data = await submitChallenge(signedXdr);

    const jwt = data.token;
    await setSecure('rowan_token', jwt);
    await setSecure('rowan_user', JSON.stringify(data.user || data));
    setClientToken(jwt);
    setToken(jwt);
    setUser(data.user || data);
    setKeypair({ publicKey: account });
    setRole(ROLE_WALLET);
    setIsAuthenticated(true);
    return data;
  }, []);

  /* ═══════════════════════════════════════════════════════
   *  TRADER AUTH — email + password
   * ═══════════════════════════════════════════════════════ */

  const loginAsTrader = useCallback(async (email, password) => {
    const data = await loginTrader(email, password);
    const jwt = data.token;
    const profile = data.trader;

    // Memory-only — no setSecure calls for trader sessions
    setClientToken(jwt);
    setToken(jwt);
    setTrader(profile);
    setRole(ROLE_TRADER);
    setIsAuthenticated(true);
    return profile;
  }, []);

  const signupAsTrader = useCallback(async (name, email, password) => {
    const data = await signupTrader(name, email, password);
    const jwt = data.token;
    const profile = data.trader;

    // Memory-only
    setClientToken(jwt);
    setToken(jwt);
    setTrader(profile);
    setRole(ROLE_TRADER);
    setIsAuthenticated(true);
    return profile;
  }, []);

  /**
   * setTraderAuthAfter2FA — Used after successful 2FA verification.
   * Called from TwoFactorVerify page to complete trader authentication
   * without going through loginTrader again.
   */
  const setTraderAuthAfter2FA = useCallback((token, trader) => {
    setClientToken(token);
    setToken(token);
    setTrader(trader);
    setRole(ROLE_TRADER);
    setIsAuthenticated(true);
  }, []);

  /**
   * setWalletAuthAfter2FA — Used after successful 2FA verification for wallet users.
   * Called from WalletTwoFactorLoginModal to complete wallet authentication
   * without going through loginWithWallet again.
   * For wallet: token and user are already issued, just need to complete final auth
   */
  const setWalletAuthAfter2FA = useCallback(async (token, user, keypair) => {
    // Persist to secure storage (wallet sessions survive app restart)
    await setSecure('rowan_token', token);
    await setSecure('rowan_user', JSON.stringify(user || {}));
    if (keypair?.publicKey) {
      await setSecure('rowan_stellar_keypair', JSON.stringify(keypair));
    }
    
    // Update in-memory state
    setClientToken(token);
    setToken(token);
    setUser(user);
    setKeypair({ publicKey: keypair?.publicKey });
    setRole(ROLE_WALLET);
    setIsAuthenticated(true);
  }, []);

  /* ═══════════════════════════════════════════════════════
   *  LOGOUT — works for both roles
   * ═══════════════════════════════════════════════════════ */

  const logout = useCallback(async () => {
    if (role === ROLE_WALLET) {
      await clearAllSecure();
      await clearPreferences();
    }
    // Trader: nothing to clear in storage (memory-only)
    setClientToken(null);
    setToken(null);
    setUser(null);
    setTrader(null);
    setKeypair(null);
    setRole(null);
    setIsAuthenticated(false);
  }, [role]);

  return (
    <AuthContext.Provider
      value={{
        // State
        user,
        trader,
        token,
        keypair,
        role,
        isAuthenticated,
        isLoading,
        // Wallet auth
        registerWithWallet,
        loginWithWallet,
        setWalletAuthAfter2FA,
        // Trader auth
        loginAsTrader,
        signupAsTrader,
        setTraderAuthAfter2FA,
        // Shared
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
