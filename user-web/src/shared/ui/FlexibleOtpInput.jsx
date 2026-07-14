import { useRef, useCallback } from 'react';

/**
 * FlexibleOtpInput — Supports both TOTP (6 digits) and backup codes (8 hex chars, alphanumeric)
 * Dynamically switches based on input type
 * 
 * Props:
 * - onComplete: (code) => void — called when 6-digit or 8-char code is ready
 * - disabled: boolean
 * - error: boolean
 * - mode: 'totp' (6 digits) | 'backup' (8 alphanumeric, case-insensitive) | 'auto' (smart detection)
 */
export default function FlexibleOtpInput({
  onComplete,
  disabled = false,
  error = false,
  mode = 'auto',
}) {
  const refs = useRef([]);
  
  // Determine expected length based on mode
  const expectedLength = mode === 'backup' ? 8 : (mode === 'totp' ? 6 : 6);
  // For 'auto' mode, we accept either 6 digits or 8 hex chars
  const autoMode = mode === 'auto';

  const getInputRegex = (idx) => {
    if (mode === 'backup') {
      // Backup codes: 8 hex characters (0-9, A-F)
      return /[0-9a-fA-F]/i;
    }
    if (mode === 'totp') {
      // TOTP: 6 digits only
      return /\d/;
    }
    // Auto mode: accept digits, and after 6 chars switch to accepting hex  
    return /[\dA-Fa-f]/;
  };

  const handleChange = useCallback((e, idx) => {
    const inputVal = e.target.value;
    const isDigit = /\d/.test(inputVal);
    const isHex = /[A-Fa-f]/.test(inputVal);
    
    // Validate input for the current mode
    let filtered = '';
    if (mode === 'backup') {
      filtered = inputVal.replace(/[^0-9a-fA-F]/gi, '').toUpperCase();
    } else if (mode === 'totp') {
      filtered = inputVal.replace(/\D/g, '');
    } else {
      // Auto mode
      filtered = inputVal.replace(/[^0-9a-fA-F]/gi, '').toUpperCase();
    }

    if (!filtered) return;

    // Take only the first character
    e.target.value = filtered[0];

    // Determine if we should move to next field
    const currentCode = refs.current.map((r) => r?.value || '').join('');
    const currentLen = currentCode.length + 1;

    // Auto-move to next field
    if (idx < (expectedLength === 8 ? 7 : 5)) {
      refs.current[idx + 1]?.focus();
    }

    // Check if we have enough characters
    const fullCode = refs.current.map((r) => r?.value || '').join('');
    if (fullCode.length === (mode === 'backup' ? 8 : (mode === 'totp' ? 6 : 6))) {
      onComplete?.(fullCode);
    }
  }, [onComplete, mode, expectedLength]);

  const handleKeyDown = useCallback((e, idx) => {
    if (e.key === 'Backspace' && !e.target.value && idx > 0) {
      refs.current[idx - 1]?.focus();
    }
  }, []);

  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    
    // Validate based on mode
    let sanitized = '';
    if (mode === 'backup') {
      sanitized = pasted.replace(/[^0-9a-fA-F]/gi, '').toUpperCase().slice(0, 8);
    } else if (mode === 'totp') {
      sanitized = pasted.replace(/\D/g, '').slice(0, 6);
    } else {
      // Auto: accept hex chars
      sanitized = pasted.replace(/[^0-9a-fA-F]/gi, '').toUpperCase().slice(0, 8);
    }

    // Fill in the fields
    sanitized.split('').forEach((ch, i) => {
      if (refs.current[i]) refs.current[i].value = ch;
    });

    if (sanitized.length === (mode === 'backup' ? 8 : 6)) {
      refs.current[Math.min(sanitized.length - 1, expectedLength - 1)]?.focus();
      onComplete?.(sanitized);
    } else if (sanitized.length > 0) {
      refs.current[Math.min(sanitized.length, expectedLength - 1)]?.focus();
    }
  }, [onComplete, mode, expectedLength]);

  return (
    <div className={`flex gap-2 ${mode === 'backup' ? 'justify-start' : 'justify-center'}`}>
      {Array.from({ length: mode === 'backup' ? 8 : 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="tel"
          inputMode={mode === 'backup' ? 'text' : 'numeric'}
          maxLength={1}
          disabled={disabled}
          onChange={(e) => handleChange(e, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          onPaste={i === 0 ? handlePaste : undefined}
          className={`${
            mode === 'backup' ? 'w-9 h-11' : 'w-10 h-12'
          } bg-rowan-bg border rounded text-center ${
            mode === 'backup' ? 'text-rowan-text text-lg font-semibold' : 'text-rowan-text text-xl font-bold'
          } focus:outline-none transition-colors ${
            error
              ? 'border-rowan-red focus:border-rowan-red'
              : 'border-rowan-border focus:border-rowan-yellow'
          } ${disabled ? 'opacity-50' : ''}`}
        />
      ))}
    </div>
  );
}
