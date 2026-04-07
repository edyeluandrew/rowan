/**
 * Exit Protection Utilities
 *
 * Warns users before leaving or reloading if they have unsaved onboarding progress.
 */

/**
 * Enable browser exit warning when unsaved onboarding progress exists.
 * Returns a cleanup function to disable the warning.
 *
 * @param {boolean} isDirty - Whether there are unsaved changes
 * @returns {function} cleanup function
 */
export function useExitProtection(isDirty = false) {
  const handleBeforeUnload = (e) => {
    if (!isDirty) return;

    e.preventDefault();
    e.returnValue = '';
    return '';
  };

  if (isDirty) {
    window.addEventListener('beforeunload', handleBeforeUnload);
  }

  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}
