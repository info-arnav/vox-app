import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  CircleAlert,
  Clock,
  Loader,
  Monitor,
  RefreshCw,
  RotateCcw,
  Square,
  Wrench,
  Zap
} from 'lucide-react'
import { useChatRuntime } from '../../chat/state/ChatRuntimeContext'
import { useChatLive } from '../../chat/state/ChatRuntimeContext'
import { useTaskHistory } from '../../chat/state/useTaskHistory'
import { useTaskDetail } from '../hooks/useTaskDetail'
import {
  relativeTime,
  elapsedLabel,
  resultSnippet,
  mergeSteps,
  computeEffectiveStatus,
  TASK_STATUS_COLOR,
  TASK_STATUS_LABEL,
  STEP_STATUS_ICON
} from '../utils/task.utils'

const STATUS_COLOR = TASK_STATUS_COLOR
const STATUS_LABEL = TASK_STATUS_LABEL

const ActivityListRow = memo(function ActivityListRow({
  task,
  onClick,
  onAbort,
  onResume,
  onRerun
}) {
  const { taskId, status, spawnInstructions, completedCount, currentPlan, spawnedAt } = task
  const [busy, setBusy] = useState(false)
  const isRunning = status === 'running' || status === 'spawned'
  const canResume = status === 'failed' || status === 'incomplete'
  const canRerun = !isRunning && !canResume && Boolean(spawnInstructions)
  const doneCount = completedCount || 0
  const color = STATUS_COLOR[status] || 'muted'
  const label = STATUS_LABEL[status] || status
  const preview = String(spawnInstructions || currentPlan || '').trim()

  const handleAbort = useCallback(
    async (e) => {
      e.stopPropagation()
      if (busy || !onAbort) return
      setBusy(true)
      try {
        await onAbort(taskId)
      } finally {
        setBusy(false)
      }
    },
    [busy, onAbort, taskId]
  )

  const handleResume = useCallback(
    async (e) => {
      e.stopPropagation()
      if (busy || !onResume) return
      setBusy(true)
      try {
        await onResume(taskId)
      } finally {
        setBusy(false)
      }
    },
    [busy, onResume, taskId]
  )

  const handleRerun = useCallback(
    (e) => {
      e.stopPropagation()
      if (busy || !onRerun || !spawnInstructions) return
      onRerun(spawnInstructions)
    },
    [busy, onRerun, spawnInstructions]
  )

  return (
    <div
      className="activity-list-row"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div className="activity-list-row-left">
        <span
          className={`activity-list-dot activity-list-dot-${color}${isRunning ? ' activity-list-dot-pulse' : ''}`}
        />
      </div>
      <div className="activity-list-row-body">
        <p className="activity-list-row-instructions">
          {preview.length > 120
            ? `${preview.slice(0, 120)}…`
            : preview || `Agent ${taskId.slice(0, 8)}…`}
        </p>
        <div className="activity-list-row-meta">
          <span className={`activity-list-status activity-list-status-${color}`}>{label}</span>
          {doneCount > 0 && (
            <span className="activity-list-steps">
              {doneCount} action{doneCount === 1 ? '' : 's'} done
            </span>
          )}
        </div>
      </div>
      <div className="activity-list-row-actions" onClick={(e) => e.stopPropagation()}>
        {spawnedAt && <span className="activity-list-time">{relativeTime(spawnedAt)}</span>}
        {isRunning && (
          <button
            className="activity-row-btn activity-row-btn-stop"
            disabled={busy}
            onClick={handleAbort}
            title="Stop agent"
            type="button"
          >
            <Square size={11} />
            Stop
          </button>
        )}
        {canResume && (
          <button
            className="activity-row-btn activity-row-btn-resume"
            disabled={busy}
            onClick={handleResume}
            title="Resume agent"
            type="button"
          >
            <RefreshCw size={11} />
            Resume
          </button>
        )}
        {canRerun && (
          <button
            className="activity-row-btn activity-row-btn-rerun"
            disabled={busy}
            onClick={handleRerun}
            title="Re-run this agent"
            type="button"
          >
            <RotateCcw size={11} />
            Re-run
          </button>
        )}
        {!isRunning && !canResume && !canRerun && (
          <ArrowRight className="activity-list-row-arrow" size={13} />
        )}
      </div>
    </div>
  )
})

function TimelineMarker({ icon: Icon, iconClass = '', label, sub, isLast = false }) {
  return (
    <div className={`activity-timeline-item${isLast ? ' activity-timeline-item-last' : ''}`}>
      <div className="activity-timeline-node">
        <span className={`activity-timeline-icon ${iconClass}`}>
          <Icon size={12} />
        </span>
        {!isLast && <span className="activity-timeline-line" />}
      </div>
      <div className="activity-timeline-content">
        <p className="activity-timeline-label">{label}</p>
        {sub && <p className="activity-timeline-sub">{sub}</p>}
      </div>
    </div>
  )
}

function ToolCallPair({ call, result }) {
  const [expanded, setExpanded] = useState(false)
  const isDesktop = call?.type === 'task.request'
  const Icon = isDesktop ? Monitor : Wrench
  const toolName = call?.data?.name || call?.data?.tool || 'tool'
  const payload =
    call?.data?.payload && typeof call.data.payload === 'object'
      ? JSON.stringify(call.data.payload)
      : call?.data?.args
        ? typeof call.data.args === 'string'
          ? call.data.args
          : JSON.stringify(call.data.args)
        : ''
  const resultRaw = result?.data?.result
  const resultStr =
    resultRaw != null ? (typeof resultRaw === 'string' ? resultRaw : JSON.stringify(resultRaw)) : ''
  const resultSnip = resultSnippet(resultStr, 160)

  return (
    <div className="activity-tool-pair">
      <div className="activity-tool-call">
        <Icon size={11} className="activity-tool-icon" />
        <span className="activity-tool-name">{isDesktop ? `Desktop · ${toolName}` : toolName}</span>
        {payload && (
          <span className="activity-tool-param">
            {payload.length > 80 ? `${payload.slice(0, 80)}…` : payload}
          </span>
        )}
      </div>
      {resultStr && (
        <div className="activity-tool-result">
          <span className="activity-tool-result-arrow">↳</span>
          <span className="activity-tool-result-text">{expanded ? resultStr : resultSnip}</span>
          {resultStr.length > 160 && (
            <button
              className="activity-tool-expand"
              onClick={() => setExpanded((v) => !v)}
              type="button"
            >
              {expanded ? 'less' : 'more'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function StepItem({ step, isLast }) {
  const Icon = STEP_STATUS_ICON[step.status] || Clock
  const iconClass = `activity-step-icon-${step.status}`

  return (
    <div
      className={`activity-timeline-item activity-step-item${isLast ? ' activity-timeline-item-last' : ''}`}
    >
      <div className="activity-timeline-node">
        <span className={`activity-timeline-icon activity-step-icon ${iconClass}`}>
          <Icon size={12} />
        </span>
        {!isLast && <span className="activity-timeline-line" />}
      </div>
      <div className="activity-timeline-content">
        <p className="activity-timeline-label activity-step-label">{step.instruction}</p>
        {step.status === 'running' && (
          <p className="activity-timeline-sub activity-step-running">Working on this…</p>
        )}
        {step.status === 'pending' && <p className="activity-timeline-sub">Up next</p>}
      </div>
    </div>
  )
}

function useOverflows(expanded) {
  const ref = useRef(null)
  const [overflows, setOverflows] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const id = requestAnimationFrame(() => {
      setOverflows(!expanded && el.scrollHeight > el.clientHeight + 2)
    })
    return () => cancelAnimationFrame(id)
  }, [expanded])
  return [ref, overflows]
}

function MissionText({ text }) {
  const [expanded, setExpanded] = useState(false)
  const [ref, overflows] = useOverflows(expanded)
  return (
    <div className="activity-mission-text">
      <div ref={ref} className={expanded ? '' : 'activity-mission-text-clamped'}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </div>
      {(overflows || expanded) && (
        <button
          className="activity-tool-expand"
          onClick={() => setExpanded((v) => !v)}
          type="button"
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  )
}

function ActivityDetail({ taskId, liveTask, onBack, onAbort, onResume, taskEvents }) {
  const { fetched, loading, error } = useTaskDetail(taskId, liveTask?.status)
  const [busy, setBusy] = useState(false)

  const dbTask = fetched
  const rawStatus = liveTask?.status || dbTask?.status || 'running'
  const finalResult = dbTask?.result || ''
  const effectiveStatus = computeEffectiveStatus(rawStatus, dbTask)
  const isRunning = effectiveStatus === 'running' || effectiveStatus === 'spawned'
  const canResume = effectiveStatus === 'failed' || effectiveStatus === 'incomplete'
  const instructions = liveTask?.spawnInstructions || dbTask?.instructions || ''
  const createdAt = liveTask?.spawnedAt || dbTask?.created_at || ''
  const completedAt = liveTask?.completedAt || dbTask?.completed_at || ''
  const errorMsg = dbTask?.error || dbTask?.abort_reason || liveTask?.message || ''
  const elapsed = elapsedLabel(createdAt, completedAt || (isRunning ? null : completedAt))
  const steps = mergeSteps(dbTask?.steps, liveTask)
  const color = STATUS_COLOR[effectiveStatus] || 'muted'
  const label = STATUS_LABEL[effectiveStatus] || effectiveStatus

  const toolPairs = useMemo(() => {
    const calls = taskEvents.filter((e) => e.type === 'tool_call' || e.type === 'task.request')
    const results = taskEvents.filter((e) => e.type === 'tool_result')
    const usedResultIds = new Set()
    return calls.map((call) => {
      const matched = results.find(
        (r) => !usedResultIds.has(r.id) && r.data?.name === call.data?.name
      )
      if (matched) usedResultIds.add(matched.id)
      return { call, result: matched || null }
    })
  }, [taskEvents])

  const handleAbort = async () => {
    if (busy || !onAbort) return
    setBusy(true)
    try {
      await onAbort(taskId)
    } finally {
      setBusy(false)
    }
  }

  const handleResume = async () => {
    if (busy || !onResume) return
    setBusy(true)
    try {
      await onResume(taskId)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="activity-detail">
      <div className="activity-detail-toolbar">
        <button className="activity-back-btn" onClick={onBack} type="button">
          <ArrowLeft size={13} />
          All agents
        </button>
        <div className="activity-detail-controls">
          {isRunning && onAbort && (
            <button
              className="chat-task-card-btn"
              disabled={busy}
              onClick={handleAbort}
              type="button"
            >
              <Square size={11} /> Stop
            </button>
          )}
          {canResume && onResume && (
            <button
              className="chat-task-card-btn chat-task-card-btn-resume"
              disabled={busy}
              onClick={handleResume}
              type="button"
            >
              <RefreshCw size={11} /> Resume
            </button>
          )}
        </div>
      </div>

      {loading && !liveTask ? (
        <div className="activity-detail-loading">
          <Loader size={14} />
          <span>Loading…</span>
        </div>
      ) : error && !liveTask ? (
        <div className="activity-detail-error">{error}</div>
      ) : (
        <div className="activity-detail-body">
          <div className="activity-mission">
            <div className="activity-mission-meta">
              <span
                className={`activity-list-dot activity-list-dot-${color}${isRunning ? ' activity-list-dot-pulse' : ''}`}
              />
              <span className={`activity-list-status activity-list-status-${color}`}>{label}</span>
              {elapsed && <span className="activity-mission-elapsed">· {elapsed}</span>}
              {createdAt && (
                <span className="activity-mission-time">{relativeTime(createdAt)}</span>
              )}
            </div>
            {instructions && <MissionText text={instructions} />}
          </div>
          <div className="activity-timeline">
            <TimelineMarker
              icon={Zap}
              iconClass="activity-timeline-icon-spawn"
              label="Agent started"
              sub={createdAt ? relativeTime(createdAt) : undefined}
            />
            {steps.map((step, i) => {
              const isLastStep =
                i === steps.length - 1 &&
                !finalResult &&
                !errorMsg &&
                !toolPairs.length &&
                effectiveStatus !== 'running'
              return <StepItem key={step.step_id || i} step={step} isLast={isLastStep} />
            })}
            {toolPairs.length > 0 && (
              <div
                className={`activity-timeline-item${!finalResult && !errorMsg ? ' activity-timeline-item-last' : ''}`}
              >
                <div className="activity-timeline-node">
                  <span className="activity-timeline-icon">
                    <Wrench size={12} />
                  </span>
                  {(finalResult || errorMsg) && <span className="activity-timeline-line" />}
                </div>
                <div className="activity-timeline-content">
                  <p className="activity-timeline-label">Actions taken</p>
                  <div className="activity-step-tools">
                    {toolPairs.map((pair, idx) => (
                      <ToolCallPair key={idx} call={pair.call} result={pair.result} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            {finalResult && <FinalResultItem result={finalResult} isError={false} />}
            {errorMsg && !finalResult && <FinalResultItem result={errorMsg} isError />}
          </div>
        </div>
      )}
    </div>
  )
}

function FinalResultItem({ result, isError }) {
  const [expanded, setExpanded] = useState(false)
  const [ref, overflows] = useOverflows(expanded)
  const Icon = isError ? CircleAlert : CheckCircle

  return (
    <div className="activity-timeline-item activity-timeline-item-last">
      <div className="activity-timeline-node">
        <span
          className={`activity-timeline-icon ${isError ? 'activity-step-icon-failed' : 'activity-step-icon-completed'}`}
        >
          <Icon size={12} />
        </span>
      </div>
      <div className="activity-timeline-content">
        <p className="activity-timeline-label">{isError ? 'What went wrong' : 'Result'}</p>
        <div className={`activity-final-result${isError ? ' activity-final-result-error' : ''}`}>
          <div ref={ref} className={expanded ? '' : 'activity-final-result-clamped'}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
          </div>
          {(overflows || expanded) && (
            <button
              className="activity-tool-expand"
              onClick={() => setExpanded((v) => !v)}
              type="button"
            >
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ActivityPage({ focusedTaskId, onClearFocus }) {
  const { abortTask, resumeTask, sendMessage } = useChatRuntime()
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

          {allTasks.length === 0 && !historyLoading ? (
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
