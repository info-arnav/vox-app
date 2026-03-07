import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useChatLive } from './ChatRuntimeContext'
import { computeEffectiveStatus } from '../../runtime/utils/task.utils'

const PAGE_SIZE = 20
const TERMINAL = new Set(['completed', 'failed', 'aborted', 'incomplete'])
const RUNNING = new Set(['running', 'spawned'])
const HISTORICAL_POLL_MS = 30000

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
  const { taskRecords } = useChatLive()

  const [historical, setHistorical] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)

  const loadingRef = useRef(false)
  const nextOffsetIdRef = useRef(null)
  const hasMoreRef = useRef(false)
  const initialLoadDone = useRef(false)
  const historicalRef = useRef(historical)
  const taskRecordsRef = useRef(taskRecords)

  useEffect(() => { historicalRef.current = historical }, [historical])
  useEffect(() => { taskRecordsRef.current = taskRecords }, [taskRecords])

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
    if (hasMoreRef.current && nextOffsetIdRef.current) fetchPage(nextOffsetIdRef.current)
  }, [fetchPage])

  const refresh = useCallback(() => fetchPage(null), [fetchPage])

  const prevTaskStatusesRef = useRef({})
  useEffect(() => {
    const prev = prevTaskStatusesRef.current
    const next = {}
    let anyBecameTerminal = false
    for (const t of taskRecords) {
      next[t.taskId] = t.status
      const wasRunning = !prev[t.taskId] || RUNNING.has(prev[t.taskId])
      if (wasRunning && TERMINAL.has(t.status)) anyBecameTerminal = true
    }
    prevTaskStatusesRef.current = next
    if (anyBecameTerminal) {
      const timer = setTimeout(() => fetchPage(null), 1500)
      return () => clearTimeout(timer)
    }
  }, [taskRecords, fetchPage])

  useEffect(() => {
    const poll = () => {
      const liveIds = new Set(taskRecordsRef.current.map((t) => t.taskId))
      const hasStaleRunning = historicalRef.current.some(
        (t) => RUNNING.has(t.status) && !liveIds.has(t.taskId)
      )
      if (hasStaleRunning) fetchPage(null)
    }
    const t = setInterval(poll, HISTORICAL_POLL_MS)
    return () => clearInterval(t)
  }, [fetchPage])

  const tasks = useMemo(() => {
    const historicalMap = new Map(historical.map((t) => [t.taskId, t]))
    const liveIds = new Set(taskRecords.map((t) => t.taskId))
    const uniqueHistorical = historical.filter((t) => !liveIds.has(t.taskId))
    const mergedLive = taskRecords.map((live) => {
      const dbTask = historicalMap.get(live.taskId)
      if (!dbTask) return live
      const effectiveStatus = computeEffectiveStatus(live.status, dbTask)
      return effectiveStatus !== live.status ? { ...live, status: effectiveStatus } : live
    })
    return [...mergedLive, ...uniqueHistorical]
  }, [taskRecords, historical])

  return { tasks, hasMore, loading, loadMore, refresh }
}
