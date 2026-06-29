import { useState, useEffect } from 'react'
import LoadingSpinner from '../../../shared/components/ui/LoadingSpinner'
import { getChatMessages } from '../../../shared/services/api/chat'
import { formatDateTime } from '../../../shared/utils/format'

function normalizeMessage(msg) {
  return {
    id: msg.id,
    senderRole: msg.sender_role ?? msg.senderRole,
    message: msg.message,
    type: msg.type,
    imageUrl: msg.image_url ?? msg.imageUrl,
    createdAt: msg.created_at ?? msg.createdAt,
  }
}

export default function DisputeChatHistory({ transactionId }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!transactionId) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    getChatMessages(transactionId, { limit: 200 })
      .then((res) => {
        if (cancelled) return
        const rows = res?.data || res || []
        setMessages(Array.isArray(rows) ? rows.map(normalizeMessage) : [])
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Could not load chat history')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [transactionId])

  return (
    <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
      <h3 className="text-rowan-text font-bold mb-4">Order Chat History</h3>

      {loading && (
        <div className="flex items-center justify-center py-10">
          <LoadingSpinner size={20} />
        </div>
      )}

      {!loading && error && (
        <div className="bg-rowan-red/10 border border-rowan-red/30 text-rowan-red rounded-lg px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && messages.length === 0 && (
        <p className="text-rowan-muted text-sm text-center py-6">No chat messages for this order</p>
      )}

      {!loading && !error && messages.length > 0 && (
        <div className="max-h-96 overflow-y-auto space-y-3 pr-1">
          {messages.map((msg) => {
            if (msg.type === 'system' || msg.senderRole === 'system') {
              return (
                <div key={msg.id} className="text-center px-4">
                  <p className="text-rowan-muted text-xs italic">{msg.message}</p>
                  {msg.createdAt && (
                    <p className="text-rowan-muted text-[10px] mt-0.5">{formatDateTime(msg.createdAt)}</p>
                  )}
                </div>
              )
            }

            const isUser = msg.senderRole === 'user'
            return (
              <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                <span className="text-rowan-muted text-[10px] uppercase tracking-wide mb-1">
                  {isUser ? 'User' : 'Trader'}
                </span>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    isUser
                      ? 'bg-rowan-yellow/10 border border-rowan-yellow/20 text-rowan-text'
                      : 'bg-rowan-bg border border-rowan-border text-rowan-text'
                  }`}
                >
                  {msg.type === 'image' && msg.imageUrl ? (
                    <a href={msg.imageUrl} target="_blank" rel="noreferrer" className="block">
                      <img
                        src={msg.imageUrl}
                        alt="Chat attachment"
                        className="rounded-md max-h-40 object-cover"
                      />
                    </a>
                  ) : (
                    <p>{msg.message}</p>
                  )}
                </div>
                {msg.createdAt && (
                  <p className="text-rowan-muted text-[10px] mt-1">{formatDateTime(msg.createdAt)}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
