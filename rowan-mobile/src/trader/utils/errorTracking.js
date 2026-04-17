/**
 * errorTracking.js — Centralized error tracking and logging for document upload flow.
 * Helps diagnose issues on real devices while maintaining user privacy.
 */

const ERROR_LOG_KEY = 'rowan_onboarding_errors';
const MAX_LOGS = 50; // Keep last 50 errors

/**
 * Log an error with context — stored locally for debugging.
 */
export function logError(context, error, metadata = {}) {
  try {
    const timestamp = new Date().toISOString();
    const errorEntry = {
      timestamp,
      context,
      message: error?.message || String(error),
      stack: error?.stack || '',
      metadata,
    };

    // Get existing logs
    let logs = [];
    try {
      const existing = localStorage.getItem(ERROR_LOG_KEY);
      if (existing) {
        logs = JSON.parse(existing);
      }
    } catch (e) {
      console.warn('[ErrorTracking] Failed to read existing logs:', e);
    }

    // Add new entry
    logs.push(errorEntry);

    // Keep only last MAX_LOGS
    if (logs.length > MAX_LOGS) {
      logs = logs.slice(-MAX_LOGS);
    }

    // Store back
    localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(logs));

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${context}]`, error, metadata);
    }
  } catch (e) {
    console.error('[ErrorTracking] Failed to log error:', e);
  }
}

/**
 * Get all stored error logs.
 */
export function getErrorLogs() {
  try {
    const stored = localStorage.getItem(ERROR_LOG_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('[ErrorTracking] Failed to retrieve error logs:', e);
    return [];
  }
}

/**
 * Clear error logs.
 */
export function clearErrorLogs() {
  try {
    localStorage.removeItem(ERROR_LOG_KEY);
  } catch (e) {
    console.error('[ErrorTracking] Failed to clear error logs:', e);
  }
}

/**
 * Export errors as JSON for debugging.
 */
export function exportErrorLogs() {
  const logs = getErrorLogs();
  return JSON.stringify(logs, null, 2);
}

/**
 * Get error logs since a certain timestamp.
 */
export function getErrorLogsSince(timestamp) {
  const logs = getErrorLogs();
  const time = new Date(timestamp).getTime();
  return logs.filter(log => new Date(log.timestamp).getTime() >= time);
}
