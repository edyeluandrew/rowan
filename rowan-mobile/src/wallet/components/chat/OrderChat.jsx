import { useState, useEffect, useRef } from 'react'
import { Send, Paperclip, X } from 'lucide-react'
import { getChatMessages, sendChatMessage, sendChatImage } from '../../api/chat'
import useSocketHook from '../../hooks/useSocket'
import useJoinOrder from '../../hooks/useJoinOrder'
import { formatMessageTime } from '../../utils/p2pFormat'
import TransactionStatusBadge from '../transactions/TransactionStatusBadge'
import PaymentDetailsCard from './PaymentDetailsCard'
import PaymentProofCard from './PaymentProofCard'
import { formatShortId } from '../../utils/p2pFormat'

const CHAT_LOCKED_STATES = ['DISPUTE_OPENED', 'DISPUTE_REFUND_PENDING', 'DISPUTE_RELEASE_PENDING']
const MAX_COMMENT = 500

export default function OrderChat({
  transactionId,
  txState,
  counterpartyName = 'Trader',
  viewerRole = 'user',
}) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [expandedImage, setExpandedImage] = useState(null)
  const bottomRef = useRef(null)
  const fileRef = useRef(null)
  const locked = CHAT_LOCKED_STATES.includes(txState)
  const shortId = transactionId ? formatShortId(transactionId) : ''

  useJoinOrder(transactionId)

  useEffect(() => {
    if (!transactionId) return
    let cancelled = false
    getChatMessages(transactionId)
      .then((data) => { if (!cancelled) setMessages(data) })
      .catch(() => { if (!cancelled) setError('Could not load messages. Pull to refresh by leaving and returning.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [transactionId])

  useSocketHook('chat_message', (msg) => {
    if (msg.transactionId === transactionId) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, {
          id: msg.id,
          sender_role: msg.senderRole,
          message: msg.message,
          type: msg.type,
          image_url: msg.imageUrl,
          payload: msg.payload,
          created_at: msg.createdAt,
        }]
      })
    }
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleSend = async () => {
    if (!text.trim() || locked) return
    setSending(true)
    setError(null)
    try {
      const row = await sendChatMessage(transactionId, text.trim())
      setMessages((prev) => [...prev, row])
      setText('')
    } catch (err) {
      setError(err.response?.data?.error || 'Message could not be sent. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const handleImage = async (e) => {
    const file = e.target.files?.[0]
    if (!file || locked) return
    setSending(true)
    setError(null)
    try {
      const row = await sendChatImage(transactionId, file)
      setMessages((prev) => [...prev, row])
    } catch (err) {
      setError(err.response?.data?.error || 'Image could not be uploaded. Please try again.')
    } finally {
      setSending(false)
      e.target.value = ''
    }
  }

  if (!transactionId) return null

  return (
    <>
      <div className="bg-rowan-surface border border-rowan-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-rowan-border">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-rowan-text text-sm font-semibold truncate">{counterpartyName}</h3>
              <p className="text-rowan-muted text-xs font-mono mt-0.5">Order {shortId}</p>
            </div>
            <TransactionStatusBadge state={txState} />
          </div>
          {locked && (
            <div className="mt-2 bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-lg px-3 py-2">
              <p className="text-rowan-yellow text-xs">This chat is under review by support</p>
            </div>
          )}
        </div>

        <div className="max-h-72 overflow-y-auto px-3 py-3 space-y-3">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-rowan-yellow border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!loading && messages.length === 0 && (
            <p className="text-rowan-muted text-xs text-center py-6 italic">
              Say hello to your trader to get started
            </p>
          )}
          {messages.map((msg) => {
            if (msg.type === 'payment_details') {
              let payload = msg.payload
              if (typeof payload === 'string') {
                try { payload = JSON.parse(payload) } catch { payload = null }
              }
              if (!payload) return null
              return (
                <div key={msg.id}>
                  <PaymentDetailsCard payload={payload} viewerRole={viewerRole} />
                </div>
              )
            }
            if (msg.type === 'payment_proof') {
              let payload = msg.payload
              if (typeof payload === 'string') {
                try { payload = JSON.parse(payload) } catch { payload = null }
              }
              if (!payload) return null
              return (
                <div key={msg.id}>
                  <PaymentProofCard payload={payload} />
                </div>
              )
            }
            if (msg.type === 'system' || msg.sender_role === 'system') {
              return (
                <div key={msg.id} className="text-center px-4">
                  <span className="text-rowan-muted text-[11px] italic">{msg.message}</span>
                </div>
              )
            }
            const isOwn = msg.sender_role === viewerRole
            const time = formatMessageTime(msg.created_at)
            return (
              <div key={msg.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    isOwn
                      ? 'bg-rowan-yellow text-rowan-bg'
                      : 'bg-rowan-bg border border-rowan-border text-rowan-text'
                  }`}
                >
                  {msg.type === 'image' && msg.image_url ? (
                    <button type="button" onClick={() => setExpandedImage(msg.image_url)} className="block">
                      <img src={msg.image_url} alt="Attachment" className="rounded-lg max-h-32 w-full object-cover" />
                    </button>
                  ) : (
                    <p>{msg.message}</p>
                  )}
                </div>
                {time && <span className="text-rowan-muted text-[10px] mt-1 px-1">{time}</span>}
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {error && <p className="text-rowan-red text-xs px-4 pb-2">{error}</p>}

        {!locked && (
          <div className="flex items-end gap-2 p-3 border-t border-rowan-border">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={sending}
              className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center"
              aria-label="Attach image"
            >
              <Paperclip size={20} />
            </button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_COMMENT))}
              placeholder="Type a message..."
              className="flex-1 bg-rowan-bg border border-rowan-border rounded-xl px-3 py-2 text-sm text-rowan-text min-h-11"
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !text.trim()}
              className={`min-h-11 min-w-11 flex items-center justify-center rounded-xl ${
                text.trim() ? 'text-rowan-yellow' : 'text-rowan-muted'
              }`}
              aria-label="Send message"
            >
              <Send size={20} />
            </button>
          </div>
        )}
      </div>

      {expandedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setExpandedImage(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white min-h-11 min-w-11 flex items-center justify-center"
            onClick={() => setExpandedImage(null)}
            aria-label="Close image"
          >
            <X size={24} />
          </button>
          <img src={expandedImage} alt="Expanded attachment" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </>
  )
}
