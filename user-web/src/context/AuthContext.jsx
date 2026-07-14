/**
 * Wallet-only AuthContext for Rowan user web (SEP-10).
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { setClientToken, onLogout } from '../shared/api/client';
import {
  getSecure, setSecure, removeSecure, initStorage,
} from '../shared/utils/storage';
import { fetchStellarToml, verifyChallengeTransaction, signChallengeTransaction } from '../wallet/utils/sep10';
import { getHomeDomain } from '../shared/utils/config';
import { hashPhoneNumber } from '../wallet/utils/crypto';
import { getChallenge, submitChallenge, registerUser } from '../wallet/api/auth';
import { CURRENT_NETWORK } from '../wallet/utils/constants';

const AuthContext = createContext(null);

export const ROLE_WALLET = 'user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [keypair, setKeypair] = useState(null);
  const [role, setRole] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initStorage();
  }, []);

  useEffect(() => {
    onLogout(() => {
      setToken(null);
      setUser(null);
      setKeypair(null);
      setRole(null);
      setIsAuthenticated(false);
    });
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const t = await getSecure('rowan_token');
        const u = await getSecure('rowan_user');
        const kp = await getSecure('rowan_stellar_keypair');

        if (t && u) {
          setClientToken(t);
          setToken(t);
          setUser(JSON.parse(u));
          setRole(ROLE_WALLET);
          setIsAuthenticated(true);
          if (kp) {
            const kpData = JSON.parse(kp);
            setKeypair({ publicKey: kpData.publicKey });
          }
        }
      } catch {
        /* unauthenticated */
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const registerWithWallet = useCallback(async (phoneNumber) => {
    const stored = await getSecure('rowan_stellar_keypair');
    if (!stored) throw new Error('No wallet keypair found');
    const kpData = JSON.parse(stored);
    const account = kpData.publicKey;

    const homeDomain = getHomeDomain();
    const toml = await fetchStellarToml(homeDomain);
    const webAuthUrl = toml.webAuthEndpoint;

    const { transaction: challengeXdr } = await getChallenge(account, webAuthUrl);
    verifyChallengeTransaction({
      challengeXdr,
      serverSigningKey: toml.signingKey,
      networkPassphrase: CURRENT_NETWORK.passphrase,
      homeDomain,
      clientPublicKey: account,
    });
    const signedXdr = signChallengeTransaction(challengeXdr, kpData.secretKey, CURRENT_NETWORK.passphrase);
    const phoneHash = await hashPhoneNumber(phoneNumber);
    const data = await registerUser({ transaction: signedXdr, phoneHash });

    if (data?.requiresTwoFactorVerification === true) {
      return { requiresTwoFactorVerification: true, userId: data.userId, publicKey: account };
    }

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

    const homeDomain = getHomeDomain();
    const toml = await fetchStellarToml(homeDomain);
    const webAuthUrl = toml.webAuthEndpoint;

    const { transaction: challengeXdr } = await getChallenge(account, webAuthUrl);
    verifyChallengeTransaction({
      challengeXdr,
      serverSigningKey: toml.signingKey,
      networkPassphrase: CURRENT_NETWORK.passphrase,
      homeDomain,
      clientPublicKey: account,
    });
    const signedXdr = signChallengeTransaction(challengeXdr, kpData.secretKey, CURRENT_NETWORK.passphrase);
    const data = await submitChallenge(signedXdr);

    if (data?.requiresTwoFactorVerification === true) {
      return { requiresTwoFactorVerification: true, userId: data.userId, publicKey: account };
    }

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

  const setWalletAuthAfter2FA = useCallback(async (nextToken, nextUser, nextKeypair) => {
    await setSecure('rowan_token', nextToken);
    await setSecure('rowan_user', JSON.stringify(nextUser || {}));
    if (nextKeypair?.publicKey) {
      await setSecure('rowan_stellar_keypair', JSON.stringify(nextKeypair));
    }
    setClientToken(nextToken);
    setToken(nextToken);
    setUser(nextUser);
    setKeypair({ publicKey: nextKeypair?.publicKey });
    setRole(ROLE_WALLET);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(async () => {
    await removeSecure('rowan_token');
    await removeSecure('rowan_user');
    setClientToken(null);
    setToken(null);
    setUser(null);
    setKeypair(null);
    setRole(null);
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        trader: null,
        token,
        keypair,
        role,
        isAuthenticated,
        isLoading,
        registerWithWallet,
        loginWithWallet,
        setWalletAuthAfter2FA,
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
