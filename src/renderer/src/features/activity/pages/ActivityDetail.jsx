import { useState, useRef, useEffect, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowLeft, CheckCircle, CircleAlert, RefreshCw, Square, Zap } from 'lucide-react'
import { useTaskDetail } from '../hooks/useTaskDetail'
import {
  relativeTime,
  elapsedLabel,
  mergeSteps,
  computeEffectiveStatus,
  TASK_STATUS_COLOR,
  TASK_STATUS_LABEL
} from '../utils/task.utils'
import { TimelineMarker, ActionItem, StepItem } from './ActivityTimeline'

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
  const steps = mergeSteps(dbTask?.steps)
  const color = TASK_STATUS_COLOR[effectiveStatus] || 'muted'
  const label = TASK_STATUS_LABEL[effectiveStatus] || effectiveStatus

  const latestThought = useMemo(
    () =>
      isRunning
        ? String(
            taskEvents.findLast((e) => e.type === 'agent.thinking')?.data?.thought || ''
          ).trim()
        : '',
    [isRunning, taskEvents]
  )

  const toolPairs = useMemo(() => {
    const calls = taskEvents.filter((e) => e.type === 'tool_call' || e.type === 'task.request')
    const results = taskEvents.filter((e) => e.type === 'tool_result')
    const usedResultIds = new Set()
    return calls.map((call) => {
      const callName = call.name || call.data?.name
      const matched = results.find(
        (r) => !usedResultIds.has(r.id) && (r.name || r.data?.name) === callName
      )
      if (matched) usedResultIds.add(matched.id)
      return { call, result: matched || null }
    })
  }, [taskEvents])

  // Collapse consecutive identical failing calls into a single item with a repeat count
  const groupedPairs = useMemo(() => {
    const groups = []
    for (const pair of toolPairs) {
      const name = pair.call?.name || pair.call?.data?.name || ''
      const rawResult = pair.result?.rawResult ?? pair.result?.data?.result
      const exitCode = rawResult && typeof rawResult === 'object' ? rawResult.exitCode : undefined
      const isFailing = exitCode !== undefined && exitCode !== 0
      const last = groups[groups.length - 1]
      const lastName = last?.call?.name || last?.call?.data?.name || ''
      const lastRaw = last?.result?.rawResult ?? last?.result?.data?.result
      const lastCode = lastRaw && typeof lastRaw === 'object' ? lastRaw.exitCode : undefined
      const lastFailing = lastCode !== undefined && lastCode !== 0
      if (last && name === lastName && isFailing && lastFailing) {
        last.repeatCount = (last.repeatCount || 1) + 1
        last.result = pair.result
        last.call = pair.call
      } else {
        groups.push({ ...pair, repeatCount: 1 })
      }
    }
    return groups
  }, [toolPairs])

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

      {loading && !liveTask && !fetched ? (
        <div className="activity-detail-skeleton">
          <div className="activity-skeleton-mission">
            <div className="activity-skeleton-line activity-skeleton-line-sm" />
            <div className="activity-skeleton-line activity-skeleton-line-lg" />
            <div className="activity-skeleton-line activity-skeleton-line-md" />
          </div>
          <div className="activity-skeleton-timeline">
            {[80, 60, 70].map((w, i) => (
              <div key={i} className="activity-skeleton-trow">
                <div className="activity-skeleton-dot" />
                <div className="activity-skeleton-line" style={{ width: `${w}%` }} />
              </div>
            ))}
          </div>
        </div>
      ) : error && !liveTask && !fetched ? (
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
            {isRunning && latestThought && (
              <p className="activity-agent-thought">
                {latestThought.length > 120 ? `${latestThought.slice(0, 120)}…` : latestThought}
              </p>
            )}
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
                !groupedPairs.length &&
                effectiveStatus !== 'running'
              return <StepItem key={step.step_id || i} step={step} isLast={isLastStep} />
            })}
            {groupedPairs.map((pair, idx) => {
              const isLastAction = idx === groupedPairs.length - 1 && !finalResult && !errorMsg
              return (
                <ActionItem
                  key={idx}
                  call={pair.call}
                  result={pair.result}
                  isLast={isLastAction}
                  repeatCount={pair.repeatCount}
                />
              )
            })}
            {finalResult && <FinalResultItem result={finalResult} isError={false} />}
            {errorMsg && !finalResult && <FinalResultItem result={errorMsg} isError />}
          </div>
        </div>
      )}
    </div>
  )
}

export default ActivityDetail
