import { useCallback, useRef } from 'react'
import { getMessageId } from '../utils/chat.messages'

export function useChatStream(setMessages) {
  const streamMessageMapRef = useRef(new Map())
  const pendingChunksRef = useRef({})
  const rafRef = useRef(null)

  const flushChunks = useCallback(() => {
    rafRef.current = null
    const pending = pendingChunksRef.current
    if (Object.keys(pending).length === 0) return
    pendingChunksRef.current = {}

    setMessages((current) => {
      let next = current
      for (const [messageId, text] of Object.entries(pending)) {
        const idx = next.findLastIndex((m) => m.id === messageId)
        if (idx === -1) continue
        const updated = { ...next[idx], content: `${next[idx].content}${text}` }
        next = [...next.slice(0, idx), updated, ...next.slice(idx + 1)]
      }
      return next
    })
  }, [setMessages])

  const markStreamStarted = useCallback(
    (streamId) => {
      if (!streamId || streamMessageMapRef.current.has(streamId)) {
        return
      }

      const messageId = `assistant-${streamId}`
      streamMessageMapRef.current.set(streamId, messageId)

      setMessages((current) => [
        ...current,
        {
          id: messageId,
          role: 'assistant',
          content: '',
          pending: true,
          streamId
        }
      ])
    },
    [setMessages]
  )

  const appendAssistantChunk = useCallback(
    (streamId, chunkText) => {
      if (!chunkText) return

      const streamKey = streamId || `stream-${getMessageId()}`
      let messageId = streamMessageMapRef.current.get(streamKey)

      if (!messageId) {
        messageId = `assistant-${streamKey}`
        streamMessageMapRef.current.set(streamKey, messageId)
        setMessages((current) => [
          ...current,
          { id: messageId, role: 'assistant', content: '', pending: true, streamId: streamKey }
        ])
      }

      pendingChunksRef.current[messageId] = (pendingChunksRef.current[messageId] || '') + chunkText

      if (!rafRef.current) {
        rafRef.current = window.requestAnimationFrame(flushChunks)
      }
    },
    [flushChunks, setMessages]
  )

  const markStreamComplete = useCallback(
    (streamId) => {
      if (!streamId) return

      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current)
        flushChunks()
      }

      const messageId = streamMessageMapRef.current.get(streamId)
      streamMessageMapRef.current.delete(streamId)

      if (!messageId) {
        return
      }

      setMessages((current) =>
        current.map((message) =>
          message.id === messageId ? { ...message, pending: false } : message
        )
      )
    },
    [flushChunks, setMessages]
  )

  return { markStreamStarted, appendAssistantChunk, markStreamComplete }
}
