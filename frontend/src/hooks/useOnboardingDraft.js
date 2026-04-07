import { useState, useEffect, useCallback } from 'react';
import { loadDraft, saveDraft, clearDraft, draftExists } from '../utils/onboardingDraft';

/**
 * useOnboardingDraft — Hook for managing onboarding draft persistence.
 *
 * Usage:
 *   const { draft, loading, hasDraft } = useOnboardingDraft();
 *   // Later, after collecting data:
 *   await draft.save(currentStep, formData);
 *   // On unmount / clear:
 *   await draft.clear();
 */
export function useOnboardingDraft() {
  const [loading, setLoading] = useState(true);
  const [hasDraft, setHasDraft] = useState(false);
  const [draftData, setDraftData] = useState(null);

  // Check if draft exists on mount
  useEffect(() => {
    (async () => {
      try {
        const exists = await draftExists();
        setHasDraft(exists);

        if (exists) {
          const data = await loadDraft();
          setDraftData(data);
        }
      } catch (err) {
        console.error('[Onboarding] Error checking draft:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = useCallback(async (currentStep, formData) => {
    try {
      await saveDraft(currentStep, formData);
    } catch (err) {
      console.error('[Onboarding] Error saving draft:', err);
    }
  }, []);

  const clear = useCallback(async () => {
    try {
      await clearDraft();
      setHasDraft(false);
      setDraftData(null);
    } catch (err) {
      console.error('[Onboarding] Error clearing draft:', err);
    }
  }, []);

  return {
    loading,
    hasDraft,
    draftData,
    save,
    clear,
  };
}
