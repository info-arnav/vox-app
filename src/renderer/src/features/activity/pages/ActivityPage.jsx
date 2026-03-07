import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader } from 'lucide-react'
import { useChatActions, useChatLive } from '../../chat/state/ChatRuntimeContext'
import { useTaskHistory } from '../../chat/state/useTaskHistory'
import ActivityListRow from './ActivityListRow'
import ActivityDetail from './ActivityDetail'

function ActivityPage({ focusedTaskId, onClearFocus }) {
  const { abortTask, resumeTask, sendMessage } = useChatActions()
  const { activityFeed, taskRecords } = useChatLive()
  const { tasks: allTasks, hasMore, loading: historyLoading, loadMore } = useTaskHistory()
  const [localFocusedId, setLocalFocusedId] = useState(null)

  useEffect(() => {
    if (!focusedTaskId) return
    const id = setTimeout(() => setLocalFocusedId(focusedTaskId), 0)
    return () => clearTimeout(id)
  }, [focusedTaskId])

  const activeFocusedId = focusedTaskId || localFocusedId

  const clearFocus = useCallback(() => {
    setLocalFocusedId(null)
    onClearFocus?.()
  }, [onClearFocus])

  const handleSelect = useCallback((taskId) => {
    setLocalFocusedId(taskId)
  }, [])

  const liveTask = useMemo(
    () => taskRecords.find((t) => t.taskId === activeFocusedId) || null,
    [taskRecords, activeFocusedId]
  )

  const taskEvents = useMemo(
    () => (activeFocusedId ? activityFeed.filter((e) => e.taskId === activeFocusedId) : []),
    [activityFeed, activeFocusedId]
  )

  const runningCount = useMemo(
    () => allTasks.filter((t) => t.status === 'running' || t.status === 'spawned').length,
    [allTasks]
  )

  const rerunTask = useCallback(
    (instructions) => {
      sendMessage(instructions)
    },
    [sendMessage]
  )

  const loadMoreRef = useRef(loadMore)
  useEffect(() => {
    loadMoreRef.current = loadMore
  }, [loadMore])
  const obsRef = useRef(null)
  const sentinelCallbackRef = useCallback((el) => {
    if (obsRef.current) {
      obsRef.current.disconnect()
      obsRef.current = null
    }
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMoreRef.current()
      },
      { threshold: 0.1 }
    )
    obs.observe(el)
    obsRef.current = obs
  }, [])

  return (
    <section className="runtime-page activity-page">
      {activeFocusedId ? (
        <ActivityDetail
          key={activeFocusedId}
          taskId={activeFocusedId}
          liveTask={liveTask}
          taskEvents={taskEvents}
          onBack={clearFocus}
          onAbort={abortTask}
          onResume={resumeTask}
        />
      ) : (
        <div className="activity-list-view">
          <header className="activity-list-header">
            <h2>Activity</h2>
            {runningCount > 0 && (
              <div className="runtime-live-badge">
                <span className="runtime-live-badge-dot" />
                {runningCount} running
              </div>
            )}
          </header>

          {allTasks.length === 0 && historyLoading ? (
            <div className="activity-list activity-list-skeleton">
              {[100, 75, 90, 60, 85].map((w, i) => (
                <div key={i} className="activity-skeleton-row">
                  <div className="activity-skeleton-dot" />
                  <div className="activity-skeleton-row-body">
                    <div className="activity-skeleton-line" style={{ width: `${w}%` }} />
                    <div
                      className="activity-skeleton-line activity-skeleton-line-sm"
                      style={{ width: '45%' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : allTasks.length === 0 && !historyLoading ? (
            <p className="activity-empty">No agents have run yet.</p>
          ) : (
            <div className="activity-list">
              {allTasks.map((task) => (
                <ActivityListRow
                  key={task.taskId}
                  task={task}
                  onClick={() => handleSelect(task.taskId)}
                  onAbort={abortTask}
                  onResume={resumeTask}
                  onRerun={rerunTask}
                />
              ))}
              {historyLoading && (
                <div className="runtime-bot-loading">
                  <Loader size={14} />
                  <span>Loading more…</span>
                </div>
              )}
              {hasMore && !historyLoading && (
                <div className="runtime-bot-sentinel" ref={sentinelCallbackRef} />
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export default ActivityPage
