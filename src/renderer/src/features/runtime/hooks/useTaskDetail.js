import { useCallback, useEffect, useReducer, useRef } from 'react'

const TERMINAL = new Set(['completed', 'failed', 'aborted', 'incomplete'])

const initialState = { fetched: null, loading: false, error: '' }

function reducer(state, action) {
  switch (action.type) {
    case 'start':
      return { fetched: null, loading: true, error: '' }
    case 'success':
      return { fetched: action.payload, loading: false, error: '' }
    case 'error':
      return { ...state, loading: false, error: action.error }
    case 'silent_success':
      return { ...state, fetched: action.payload }
    default:
      return state
  }
}

export function useTaskDetail(taskId, liveStatus) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const doFetch = useCallback(
    (id, { silent = false } = {}) => {
      if (!id) return () => {}
      let cancelled = false
      if (!silent) dispatch({ type: 'start' })
      window.api.tasks
        .get(id)
        .then((res) => {
          if (cancelled) return
          if (!res?.success) {
            if (!silent)
              dispatch({ type: 'error', error: res?.error?.message || 'Could not load task.' })
          } else {
            dispatch({
              type: silent ? 'silent_success' : 'success',
              payload: res.data?.task || null
            })
          }
        })
        .catch(() => {
          if (!cancelled && !silent) dispatch({ type: 'error', error: 'Failed to load task.' })
        })
      return () => {
        cancelled = true
      }
    },
    [dispatch]
  )

  useEffect(() => {
    return doFetch(taskId)
  }, [taskId, doFetch])

  const prevStatus = useRef(null)
  useEffect(() => {
    const prev = prevStatus.current
    prevStatus.current = liveStatus
    const wasRunning = !prev || prev === 'running' || prev === 'spawned'
    const isNowTerminal = TERMINAL.has(liveStatus)
    if (wasRunning && isNowTerminal && taskId) {
      const t = setTimeout(() => doFetch(taskId, { silent: true }), 800)
      return () => clearTimeout(t)
    }
  }, [liveStatus, taskId, doFetch])

  return state
}
