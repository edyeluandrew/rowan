import { setPreference, getPreference, removePreference } from './storage';

/**
 * Onboarding Draft Persistence Utilities
 *
 * Handles saving, loading, and clearing onboarding progress drafts.
 * Stores non-sensitive form data in Capacitor Preferences (device-local).
 *
 * What is stored:
 *   - currentStep (1-6)
 *   - formData (identity, Binance info, MoMo networks, etc.)
 *   - agreementAccepted flag
 *
 * What is NOT stored:
 *   - Base64-encoded document/screenshot data (too large, not safe to persist)
 *   - JWT tokens or auth data (always goes in separate secure storage)
 *
 * Document files are handled separately:
 *   - On save: store only presence flags (e.g., "idFront_exists": true)
 *   - On restore: user must re-upload files (with clear messaging)
 */

const DRAFT_KEY = 'rowan_trader_onboarding_draft';
const LAST_SAVE_KEY = 'rowan_trader_onboarding_last_save';

/**
 * Serialize formData for storage.
 * Strips base64 document data (too large).
 * Keeps document metadata (e.g., "file was uploaded").
 */
export function serializeFormData(formData) {
  if (!formData) return {};

  return {
    identity: formData.identity || {},
    
    // For documents, store only presence flags (not base64)
    documents: formData.documents
      ? {
          idFront_exists: !!formData.documents.idFront,
          idBack_exists: !!formData.documents.idBack,
          selfie_exists: !!formData.documents.selfie,
        }
      : {},

    binance: formData.binance
      ? {
          binanceUid: formData.binance.binanceUid,
          binanceTradeCount: formData.binance.binanceTradeCount,
          binanceCompletionRate: formData.binance.binanceCompletionRate,
          binanceActiveMonths: formData.binance.binanceActiveMonths,
          screenshot_exists: !!formData.binance.screenshot,
        }
      : {},

    momoAccounts: formData.momoAccounts || [],
  };
}

/**
 * Deserialize formData from storage.
 * Returns form data without document base64 (must be re-uploaded).
 */
export function deserializeFormData(stored) {
  if (!stored || typeof stored !== 'object') return {};

  return {
    identity: stored.identity || {},
    documents: {
      // Presence flags set, but no base64 data
      // This will need to be re-uploaded
    },
    binance: {
      binanceUid: stored.binance?.binanceUid || '',
      binanceTradeCount: stored.binance?.binanceTradeCount || '',
      binanceCompletionRate: stored.binance?.binanceCompletionRate || '',
      binanceActiveMonths: stored.binance?.binanceActiveMonths || '',
      // screenshot will need to be re-uploaded
    },
    momoAccounts: stored.momoAccounts || [],
  };
}

/**
 * Save onboarding draft to device storage.
 * @param {number} currentStep - Current step (1-6)
 * @param {object} formData - Form data object
 * @returns {Promise<void>}
 */
export async function saveDraft(currentStep, formData) {
  try {
    const draft = {
      currentStep,
      formData: serializeFormData(formData),
      savedAt: new Date().toISOString(),
    };

    await setPreference(DRAFT_KEY, JSON.stringify(draft));
    await setPreference(LAST_SAVE_KEY, draft.savedAt);
  } catch (err) {
    console.error('[Onboarding] Failed to save draft:', err);
    // Fail silently — draft not saving should not break the flow
  }
}

/**
 * Load onboarding draft from device storage.
 * @returns {Promise<{currentStep, formData} | null>}
 */
export async function loadDraft() {
  try {
    const raw = await getPreference(DRAFT_KEY);
    if (!raw) return null;

    const draft = JSON.parse(raw);

    // Validate draft structure
    if (
      !Number.isInteger(draft.currentStep) ||
      draft.currentStep < 1 ||
      draft.currentStep > 6 ||
      !draft.formData ||
      typeof draft.formData !== 'object'
    ) {
      console.warn('[Onboarding] Draft structure invalid, clearing');
      await clearDraft();
      return null;
    }

    return {
      currentStep: draft.currentStep,
      formData: deserializeFormData(draft.formData),
      savedAt: draft.savedAt,
    };
  } catch (err) {
    console.error('[Onboarding] Failed to load draft:', err);
    await clearDraft();
    return null;
  }
}

/**
 * Clear onboarding draft from storage.
 * @returns {Promise<void>}
 */
export async function clearDraft() {
  try {
    await removePreference(DRAFT_KEY);
    await removePreference(LAST_SAVE_KEY);
  } catch (err) {
    console.error('[Onboarding] Failed to clear draft:', err);
  }
}

/**
 * Check if a draft exists and is valid.
 * @returns {Promise<boolean>}
 */
export async function draftExists() {
  try {
    const raw = await getPreference(DRAFT_KEY);
    if (!raw) return false;

    const draft = JSON.parse(raw);
    return (
      Number.isInteger(draft.currentStep) &&
      draft.currentStep >= 1 &&
      draft.currentStep <= 6 &&
      draft.formData
    );
  } catch {
    return false;
  }
}
