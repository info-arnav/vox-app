import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useChatRuntime } from './ChatRuntimeContext'

const PAGE_SIZE = 20

function normalizeHistoricalTask(row) {
  const ts = row.created_at || new Date().toISOString()
  const doneAt = row.completed_at || ''
  const isFailed = row.status === 'failed' || row.status === 'aborted'

  return {
    taskId: String(row.id || ''),
    status: String(row.status || 'running'),
    totalSteps: 0,
    completedStepIds: [],
    currentStepId: row.current_step_id || '',
    message: row.abort_reason || '',
    resultPreview: '',
    spawnRequestedAt: ts,
    spawnedAt: ts,
    plannedAt: '',
    startedAt: ts,
    completedAt: isFailed ? '' : doneAt,
    failedAt: isFailed ? doneAt : '',
    spawnInstructions: row.instructions || '',
    spawnContext: '',
    spawnArgsPreview: '',
    planSteps: [],
    stepMeta: {},
    history: [],
    updatedAt: doneAt || ts
  }
}

export function useTaskHistory() {
  const { taskRecords } = useChatRuntime()

  const [historical, setHistorical] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)

  const loadingRef = useRef(false)
  const nextOffsetIdRef = useRef(null)
  const hasMoreRef = useRef(false)
  const initialLoadDone = useRef(false)

  const fetchPage = useCallback(async (offsetId) => {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const params = { limit: PAGE_SIZE }
      if (offsetId) params.offset_id = offsetId

      const res = await window.api.tasks.list(params)
      if (!res?.success) return

      const { tasks: rows = [], has_more, next_offset_id } = res.data || {}
      const normalized = rows.map(normalizeHistoricalTask)

      setHistorical((prev) => (offsetId ? [...prev, ...normalized] : normalized))
      setHasMore(!!has_more)
      hasMoreRef.current = !!has_more
      nextOffsetIdRef.current = next_offset_id || null
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (initialLoadDone.current) return
    initialLoadDone.current = true
    fetchPage(null)
  }, [fetchPage])

  const loadMore = useCallback(() => {
    if (hasMoreRef.current && nextOffsetIdRef.current) {
      fetchPage(nextOffsetIdRef.current)
    }
  }, [fetchPage])

  const refresh = useCallback(() => {
    fetchPage(null)
  }, [fetchPage])

  const tasks = useMemo(() => {
    const liveIds = new Set(taskRecords.map((t) => t.taskId))
    const uniqueHistorical = historical.filter((t) => !liveIds.has(t.taskId))
    return [...taskRecords, ...uniqueHistorical]
  }, [taskRecords, historical])

  return { tasks, hasMore, loading, loadMore, refresh }
}
