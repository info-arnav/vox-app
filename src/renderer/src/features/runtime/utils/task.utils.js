import { CheckCircle, CircleAlert, Clock, Loader } from 'lucide-react'

export function relativeTime(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.round(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function elapsedLabel(startIso, endIso) {
  if (!startIso) return null
  const startMs = new Date(startIso).getTime()
  const endMs = endIso ? new Date(endIso).getTime() : Date.now()
  const s = Math.round((endMs - startMs) / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r > 0 ? `${m}m ${r}s` : `${m}m`
}

export function resultSnippet(raw, limit = 200) {
  if (!raw) return ''
  const cleaned = raw
    .replace(/```[\s\S]*?```/g, '[code]')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return cleaned.length > limit ? `${cleaned.slice(0, limit)}…` : cleaned
}

export function mergeSteps(dbSteps) {
  return (dbSteps || []).map((s) => ({
    step_id: s.step_id,
    instruction: s.instruction || '',
    status: s.status || 'completed'
  }))
}

const TERMINAL_DB_STATUSES = new Set(['completed', 'failed', 'aborted', 'incomplete'])

export function computeEffectiveStatus(rawStatus, dbTask) {
  const result = dbTask?.result || ''
  const isTerminalDb = TERMINAL_DB_STATUSES.has(dbTask?.status)
  if ((rawStatus === 'running' || rawStatus === 'spawned') && (result || isTerminalDb)) {
    return dbTask?.status || 'completed'
  }
  return rawStatus
}

export const TASK_STATUS_COLOR = {
  running: 'pink',
  completed: 'green',
  failed: 'red',
  aborted: 'muted',
  incomplete: 'red',
  spawned: 'pink',
  pending: 'muted'
}

export const TASK_STATUS_LABEL = {
  running: 'Running',
  completed: 'Done',
  failed: 'Failed',
  aborted: 'Stopped',
  incomplete: 'Needs work',
  spawned: 'Starting',
  pending: 'Pending'
}

export const STEP_STATUS_ICON = {
  completed: CheckCircle,
  failed: CircleAlert,
  aborted: CircleAlert,
  running: Loader,
  pending: Clock,
  skipped: Clock
}
