/**
 * Copy-to-clipboard button utility component
 */

import React, { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export const CopyButton = ({ text, label = 'Copy' }) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-2 px-2 py-1 text-sm text-rowan-yellow hover:bg-rowan-yellow/10 rounded transition-colors"
      title="Copy to clipboard"
    >
      {copied ? (
        <>
          <Check size={16} />
          {label}
        </>
      ) : (
        <>
          <Copy size={16} />
          {label}
        </>
      )}
    </button>
  )
}

export default CopyButton
