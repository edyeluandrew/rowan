import { useRef, useCallback } from 'react';

/**
 * OtpInput — 6 individual single-character inputs.
 * Props: onComplete(code), disabled, error
 */
export default function OtpInput({ onComplete, disabled = false, error = false }) {
  const refs = useRef([]);

  const handleChange = useCallback((e, idx) => {
    const val = e.target.value.replace(/\D/g, '');
    if (!val) return;
    e.target.value = val[0];

    if (idx < 5) {
      refs.current[idx + 1]?.focus();
    }

    const code = refs.current.map((r) => r?.value || '').join('');
    if (code.length === 6) {
      onComplete?.(code);
    }
  }, [onComplete]);

  const handleKeyDown = useCallback((e, idx) => {
    if (e.key === 'Backspace' && !e.target.value && idx > 0) {
      refs.current[idx - 1]?.focus();
    }
  }, []);

  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    pasted.split('').forEach((ch, i) => {
      if (refs.current[i]) refs.current[i].value = ch;
    });
    if (pasted.length === 6) {
      refs.current[5]?.focus();
      onComplete?.(pasted);
    } else if (pasted.length > 0) {
      refs.current[Math.min(pasted.length, 5)]?.focus();
    }
  }, [onComplete]);

  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="tel"
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          onChange={(e) => handleChange(e, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          onPaste={i === 0 ? handlePaste : undefined}
          className={`w-10 h-12 bg-rowan-bg border rounded text-center text-rowan-text text-xl font-bold focus:outline-none transition-colors ${
            error
              ? 'border-rowan-red focus:border-rowan-red'
              : 'border-rowan-border focus:border-rowan-yellow'
          } ${disabled ? 'opacity-50' : ''}`}
        />
      ))}
    </div>
  );
}
