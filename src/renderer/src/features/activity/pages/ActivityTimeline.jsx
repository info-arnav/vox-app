import { memo, useState } from 'react'
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  Globe,
  Monitor,
  PenLine,
  Search,
  Terminal,
  Wrench,
  Zap
} from 'lucide-react'
import { STEP_STATUS_ICON } from '../utils/task.utils'
import { parseToolArgs } from '../../chat/utils/chat.text'

export function TimelineMarker({ icon: Icon, iconClass = '', label, sub, isLast = false }) {
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

export const ActionItem = memo(function ActionItem({ call, result, isLast, repeatCount = 1 }) {
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
})

export function StepItem({ step, isLast }) {
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
