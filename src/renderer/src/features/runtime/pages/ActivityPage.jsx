import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock,
  FileText,
  Globe,
  Loader,
  Monitor,
  PenLine,
  RefreshCw,
  RotateCcw,
  Search,
  Square,
  Terminal,
  Wrench,
  Zap
} from 'lucide-react'
import { useChatRuntime, useChatLive } from '../../chat/state/ChatRuntimeContext'
import { useTaskHistory } from '../../chat/state/useTaskHistory'
import { useTaskDetail } from '../hooks/useTaskDetail'
import {
  relativeTime,
  elapsedLabel,
  mergeSteps,
  computeEffectiveStatus,
  TASK_STATUS_COLOR,
  TASK_STATUS_LABEL,
  STEP_STATUS_ICON
} from '../utils/task.utils'

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
  const color = TASK_STATUS_COLOR[status] || 'muted'
  const label = TASK_STATUS_LABEL[status] || status
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

function friendlyToolLabel(name) {
  const n = String(name || '').toLowerCase()
  if (n === 'read_local_file' || n === 'read_file') return 'Read file'
  if (n === 'write_local_file' || n === 'write_file') return 'Wrote file'
  if (n === 'list_local_files' || n === 'list_directory' || n === 'list_files')
    return 'Listed files'
  if (n === 'execute_code' || n.includes('execute') || n === 'run_code') return 'Ran code'
  if (n === 'search_context' || n === 'query_memory' || n.includes('context'))
    return 'Searched memory'
  if (n.includes('web_search') || n.includes('search_web')) return 'Searched web'
  if (n === 'spawn_task' || n.includes('spawn')) return 'Launched agent'
  if (n === 'update_journal' || n.includes('journal')) return 'Updated notes'
  if (n.includes('fetch') || n === 'http_request') return 'Fetched URL'
  if (n.includes('index')) return 'Indexed content'
  return name
}

function ActionToolIcon({ name, isDesktop, size }) {
  if (isDesktop) return <Monitor size={size} />
  const n = String(name || '').toLowerCase()
  if (n.includes('read') || n.includes('list')) return <FileText size={size} />
  if (n.includes('write')) return <PenLine size={size} />
  if (n.includes('execute') || n.includes('run_code') || n.includes('code'))
    return <Terminal size={size} />
  if (n.includes('context') || n.includes('memory') || n.includes('search'))
    return <Search size={size} />
  if (n.includes('fetch') || n.includes('http')) return <Globe size={size} />
  if (n.includes('spawn')) return <Zap size={size} />
  if (n.includes('journal')) return <BookOpen size={size} />
  return <Wrench size={size} />
}

function ExpandChevron({ expanded, size }) {
  if (expanded) return <ChevronDown size={size} />
  return <ChevronRight size={size} />
}

function getToolSub(toolName, argsObj) {
  const n = String(toolName || '').toLowerCase()
  if (n === 'execute_code' || n.includes('execute') || n === 'run_code') {
    const cmds = argsObj?.commands
    if (Array.isArray(cmds) && cmds.length > 0) {
      const first = String(cmds[0]).trim()
      const preview = first.length > 80 ? `${first.slice(0, 80)}\u2026` : first
      return cmds.length > 1 ? `${preview}  +${cmds.length - 1} more` : preview
    }
  }
  return null
}

function getOutcomeBadge(toolName, rawResult) {
  if (!rawResult) return null
  const n = String(toolName || '').toLowerCase()
  if (n === 'execute_code' || n.includes('execute') || n === 'run_code') {
    const r = typeof rawResult === 'string' ? null : rawResult
    if (!r) return null
    if (r.timedOut) return { label: 'timed out', type: 'timeout' }
    if (r.exitCode !== undefined && r.exitCode !== 0) return { label: 'failed', type: 'error' }
    if (r.exitCode === 0) return { label: 'ok', type: 'success' }
  }
  return null
}

function ExecuteCodeDetails({ argsObj, rawResult }) {
  const commands = Array.isArray(argsObj?.commands) ? argsObj.commands : []
  const r = rawResult && typeof rawResult === 'object' ? rawResult : null
  const stdout = String(r?.stdout || '').trim()
  const stderr = String(r?.stderr || '').trim()
  return (
    <div className="activity-action-details">
      {commands.length > 0 && (
        <div className="activity-code-commands">
          {commands.map((cmd, i) => (
            <code key={i} className="activity-code-cmd">
              {String(cmd)}
            </code>
          ))}
        </div>
      )}
      {stdout && (
        <div className="activity-code-stream">
          <span className="activity-code-stream-label">stdout</span>
          <pre className="activity-code-stream-pre">
            {stdout.length > 600 ? `${stdout.slice(0, 600)}\u2026` : stdout}
          </pre>
        </div>
      )}
      {stderr && (
        <div className="activity-code-stream activity-code-stream-err">
          <span className="activity-code-stream-label">stderr</span>
          <pre className="activity-code-stream-pre">
            {stderr.length > 600 ? `${stderr.slice(0, 600)}\u2026` : stderr}
          </pre>
        </div>
      )}
    </div>
  )
}

function GenericDetails({ argEntries, rawResult }) {
  const resultStr =
    rawResult != null ? (typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult)) : ''
  return (
    <div className="activity-action-details">
      {argEntries.map(([k, v]) => {
        const s = typeof v === 'string' ? v : JSON.stringify(v)
        return (
          <div key={k} className="activity-tool-arg-row">
            <span className="activity-tool-arg-key">{k}</span>
            <span className="activity-tool-arg-val">
              {s.length > 400 ? `${s.slice(0, 400)}\u2026` : s}
            </span>
          </div>
        )
      })}
      {resultStr && (
        <div className="activity-action-result">
          <span className="activity-tool-result-text">
            {resultStr.length > 500 ? `${resultStr.slice(0, 500)}\u2026` : resultStr}
          </span>
        </div>
      )}
    </div>
  )
}

function ActionItem({ call, result, isLast, repeatCount = 1 }) {
  const [expanded, setExpanded] = useState(false)
  const isDesktop = call?.type === 'task.request'
  const toolName = call?.name || call?.data?.name || call?.data?.tool || 'tool'
  const isJournal = toolName.toLowerCase().includes('journal')
  const isExecute =
    toolName === 'execute_code' || toolName.includes('execute') || toolName === 'run_code'
  const label = isDesktop
    ? toolName
      ? `Desktop · ${toolName}`
      : 'Desktop action'
    : friendlyToolLabel(toolName)

  const argsObj = call?.args ?? parseToolArgs(call?.data?.payload ?? call?.data?.args ?? null)
  const argEntries = Object.entries(argsObj || {})
  const primaryEntry =
    argEntries.find(([k]) => PRIMARY_ARG_KEYS.includes(k)) || argEntries[0] || null

  const toolSub = getToolSub(toolName, argsObj)
  const sub =
    toolSub ??
    (primaryEntry
      ? (() => {
          const s =
            typeof primaryEntry[1] === 'string' ? primaryEntry[1] : JSON.stringify(primaryEntry[1])
          return s.length > 90 ? `${s.slice(0, 90)}\u2026` : s
        })()
      : null)

  const rawResult =
    call?.type === 'task.request' ? null : (result?.rawResult ?? result?.data?.result)
  const outcome = getOutcomeBadge(toolName, rawResult)
  const isFailure = outcome?.type === 'error' || outcome?.type === 'timeout'
  const hasDetails = isExecute
    ? true
    : argEntries.length > (primaryEntry ? 1 : 0) ||
      (rawResult != null && typeof rawResult === 'string'
        ? rawResult
        : JSON.stringify(rawResult ?? ''))

  return (
    <div
      className={[
        'activity-timeline-item',
        isLast ? 'activity-timeline-item-last' : '',
        isJournal ? 'activity-action-journal' : '',
        isFailure ? 'activity-action-failure' : ''
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="activity-timeline-node">
        <span
          className={[
            'activity-timeline-icon activity-action-icon',
            isJournal ? 'activity-action-icon-journal' : '',
            isFailure ? 'activity-action-icon-failure' : ''
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <ActionToolIcon name={toolName} isDesktop={isDesktop} size={12} />
        </span>
        {!isLast && <span className="activity-timeline-line" />}
      </div>
      <div className="activity-timeline-content">
        <div className="activity-action-header">
          <p
            className={['activity-timeline-label', isJournal ? 'activity-action-label-journal' : '']
              .filter(Boolean)
              .join(' ')}
          >
            {label}
          </p>
          {repeatCount > 1 && <span className="activity-repeat-badge">&times;{repeatCount}</span>}
          {outcome && (
            <span className={`activity-outcome-badge activity-outcome-badge-${outcome.type}`}>
              {outcome.label}
            </span>
          )}
          {hasDetails && (
            <button
              className="activity-action-expand"
              onClick={() => setExpanded((v) => !v)}
              type="button"
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              <ExpandChevron expanded={expanded} size={11} />
            </button>
          )}
        </div>
        {sub && !expanded && <p className="activity-timeline-sub">{sub}</p>}
        {expanded &&
          (isExecute ? (
            <ExecuteCodeDetails argsObj={argsObj} rawResult={rawResult} />
          ) : (
            <GenericDetails argEntries={argEntries} rawResult={rawResult} />
          ))}
      </div>
    </div>
  )
}

const PRIMARY_ARG_KEYS = [
  'query',
  'path',
  'filePath',
  'command',
  'url',
  'text',
  'content',
  'message',
  'code',
  'input',
  'instruction',
  'topic',
  'value',
  'name'
]

function parseToolArgs(raw) {
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed
  } catch {
    // not JSON
  }
  return { input: raw }
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
        last.result = pair.result // keep latest result for details
        last.call = pair.call // keep latest call for latest args
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
