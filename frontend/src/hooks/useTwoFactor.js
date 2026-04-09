import { useState, useCallback } from 'react';
import {
  check2faStatus,
  initiate2faSetup,
  verifyTwoFactorSetup,
  disableTwoFactor,
  regenerateBackupCodes,
} from '../api/twoFactor';

/**
 * useTwoFactor — manage 2FA state and operations
 */
export function useTwoFactor() {
  const [is2faEnabled, setIs2faEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [setupData, setSetupData] = useState(null); // QR code, manual entry
  const [backupCodes, setBackupCodes] = useState(null); // Shown after setup

  /* Load current 2FA status */
  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await check2faStatus();
      setIs2faEnabled(data.is2faEnabled || false);
      return data;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load 2FA status');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /* Start 2FA setup flow */
  const startSetup = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await initiate2faSetup();
      setSetupData(data);
      return data;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to initiate 2FA setup');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /* Verify setup code and enable 2FA */
  const verifySetup = useCallback(async (code) => {
    setLoading(true);
    setError(null);
    try {
      const data = await verifyTwoFactorSetup(code);
      setIs2faEnabled(true);
      setBackupCodes(data.backupCodes);
      setSetupData(null); // Clear setup data
      return data;
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid code. Please try again.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /* Disable 2FA */
  const disable = useCallback(async (code) => {
    setLoading(true);
    setError(null);
    try {
      await disableTwoFactor(code);
      setIs2faEnabled(false);
      setBackupCodes(null);
      return true;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to disable 2FA');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  /* Regenerate backup codes */
  const regenerateCodes = useCallback(async (code) => {
    setLoading(true);
    setError(null);
    try {
      const data = await regenerateBackupCodes(code);
      setBackupCodes(data.backupCodes);
      return data;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to regenerate backup codes');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /* Clear setup/error state */
  const clearSetup = useCallback(() => {
    setSetupData(null);
    setBackupCodes(null);
    setError(null);
  }, []);

  return {
    is2faEnabled,
    loading,
    error,
    setupData,
    backupCodes,
    loadStatus,
    startSetup,
    verifySetup,
    disable,
    regenerateCodes,
    clearSetup,
  };
}
