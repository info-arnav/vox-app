import { useCallback } from 'react'
import { MAX_DETAIL_LENGTH } from '../utils/chat.constants'
import { clipText, parseToolArgs, shortTaskId, summarizeValue } from '../utils/chat.text'
import { getMessageId, mergeWithServerTail, normalizeHistoryMessages } from '../utils/chat.messages'
import { applyTaskEvent } from '../utils/chat.tasks'

const describeToolActivity = (toolName) => {
  const normalized = String(toolName || '')
    .trim()
    .toLowerCase()
  if (!normalized) return 'Using tool'
  if (normalized.includes('context')) return 'Searching context'
  if (normalized.includes('search')) return 'Searching'
  if (normalized.includes('spawn')) return 'Launching agent'
  if (normalized.includes('read') || normalized.includes('file')) return 'Reading file'
  if (normalized.includes('write')) return 'Writing file'
  if (normalized.includes('execute') || normalized.includes('run')) return 'Running code'
  if (normalized.includes('index')) return 'Indexing content'
  if (normalized.includes('fetch') || normalized.includes('request')) return 'Fetching data'
  return 'Using tool'
}

export const useChatEventHandler = ({
  setMessages,
  appendActivity,
  markStreamStarted,
  appendAssistantChunk,
  markStreamComplete,
  setRuntimeStatus,
  setTaskRecords,
  setSendError,
  setSending,
  pendingSpawnCallsRef,
  activeTaskIdRef
}) =>
  useCallback(
    (event) => {
      if (!event || typeof event !== 'object') return

      if (event.type === 'transcript' && event?.data?.content) {
        const content = String(event.data.content).trim()
        if (content) {
          setMessages((current) => [
            ...current,
            { id: `voice-${getMessageId()}`, role: 'user', content, pending: false, streamId: null }
          ])
        }
        return
      }

      if (event.type === 'session') {
        const historyMessages = normalizeHistoryMessages(event?.data?.messages)
        if (historyMessages.length > 0) {
          setMessages((current) => mergeWithServerTail(current, historyMessages))
        }
        appendActivity(event)
        return
      }

      if (event.type === 'chunk_start') {
        markStreamStarted(event?.streamId || event?.data?.id)
        setRuntimeStatus('Thinking...')
        return
      }

      if (event.type === 'message_chunk') {
        appendAssistantChunk(event?.streamId || event?.data?.id, event?.data?.content || '')
        return
      }

      if (event.type === 'chunk_end') {
        markStreamComplete(event?.streamId || event?.data?.id)
        setRuntimeStatus('', 0)
        setSending(false)
        return
      }

      if (event.type === 'tool_call' && String(event?.data?.name || '') === 'spawn_task') {
        const args = parseToolArgs(event?.data?.args)
        pendingSpawnCallsRef.current.push({
          requestedAt: event?.timestamp || new Date().toISOString(),
          instructions: clipText(args?.instructions || '', MAX_DETAIL_LENGTH),
          context: clipText(args?.context || '', MAX_DETAIL_LENGTH),
          argsPreview: summarizeValue(args)
        })
      }

      appendActivity(event)
      applyTaskEvent(event, setTaskRecords, {
        dequeuePendingSpawn: () => pendingSpawnCallsRef.current.shift() || null
      })

      if (event.type === 'tool_call') {
        const message = `${describeToolActivity(event?.data?.name)}...`
        setRuntimeStatus(message)
      }

      if (event.type === 'task.status') {
        const rawTaskId = event?.data?.taskId
        const taskId = shortTaskId(rawTaskId)
        const status = String(event?.data?.status || 'updated').toLowerCase()

        if (rawTaskId && activeTaskIdRef) activeTaskIdRef.current = rawTaskId

        if (
          status === 'completed' ||
          status === 'failed' ||
          status === 'aborted' ||
          status === 'incomplete'
        ) {
          const result = String(event?.data?.result || '').trim()
          const notifyId = `task-notify-${rawTaskId}`
          setMessages((current) => {
            if (current.some((m) => m.id === notifyId)) return current
            return [
              ...current,
              {
                id: notifyId,
                role: 'notification',
                status,
                taskId: rawTaskId,
                content: result || `Agent ${taskId} ${status}.`,
                pending: false,
                streamId: null
              }
            ]
          })
          if (activeTaskIdRef) activeTaskIdRef.current = null
          setRuntimeStatus('', 0)
        }
      }

      if (event.type === 'error') {
        const errorMessage = event?.data?.message || 'Chat request failed.'
        setSendError(errorMessage)
        setSending(false)
        setRuntimeStatus('', 0)
      }
    },
    [
      activeTaskIdRef,
      appendActivity,
      appendAssistantChunk,
      markStreamComplete,
      markStreamStarted,
      pendingSpawnCallsRef,
      setMessages,
      setRuntimeStatus,
      setSendError,
      setSending,
      setTaskRecords
    ]
  )
