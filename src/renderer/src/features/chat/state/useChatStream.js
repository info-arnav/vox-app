import { useCallback, useRef } from 'react'
import { getMessageId } from '../utils/chat.messages'

export function useChatStream(setMessages) {
  const streamMessageMapRef = useRef(new Map())

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
      if (!chunkText) {
        return
      }

      const streamKey = streamId || `stream-${getMessageId()}`

      setMessages((current) => {
        let messageId = streamMessageMapRef.current.get(streamKey)
        if (!messageId) {
          messageId = `assistant-${streamKey}`
          streamMessageMapRef.current.set(streamKey, messageId)

          return [
            ...current,
            {
              id: messageId,
              role: 'assistant',
              content: chunkText,
              pending: true,
              streamId: streamKey
            }
          ]
        }

        return current.map((message) =>
          message.id === messageId
            ? { ...message, content: `${message.content}${chunkText}` }
            : message
        )
      })
    },
    [setMessages]
  )

  const markStreamComplete = useCallback(
    (streamId) => {
      if (!streamId) {
        return
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
    [setMessages]
  )

  return { markStreamStarted, appendAssistantChunk, markStreamComplete }
}
