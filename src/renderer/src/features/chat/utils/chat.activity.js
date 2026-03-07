import { summarizeValue, stringifyInspectValue, parseToolArgs, shortTaskId } from './chat.text'
import { getMessageId } from './chat.messages'

export const activityFromEvent = (event) => {
  const type = String(event?.type || '').trim()
  const data = event?.data || {}
  const timestamp = event?.timestamp || new Date().toISOString()
  const eventTaskId = String(data?.taskId || data?.result?.taskId || '').trim()
  const eventStepId = String(data?.stepId || '').trim()
  const eventStatus = String(data?.status || '')
    .trim()
    .toLowerCase()

  const base = {
    id: String(event?.id || `${type || 'event'}-${getMessageId()}`),
    at: timestamp,
    type,
    taskId: eventTaskId,
    stepId: eventStepId,
    status: eventStatus,
    inspectPayload: stringifyInspectValue(data),
    inspectInput: '',
    inspectOutput: ''
  }

  if (!type) return null

  if (type === 'session') {
    return {
      ...base,
      kind: 'status',
      title: 'Session initialized',
      detail: 'Loaded recent conversation history.'
    }
  }

  if (type === 'status') {
    return {
      ...base,
      kind: 'status',
      title: 'Status update',
      detail: summarizeValue(data?.message || data)
    }
  }

  if (type === 'tool_call') {
    const parsedArgs = parseToolArgs(data?.args)
    const toolName = String(data?.name || 'unknown')
    const args = parsedArgs || {}
    const keyParam = args.path || args.query || args.url || args.name || args.instructions || ''
    const shortParam = keyParam
      ? keyParam.length > 60
        ? '\u2026' + keyParam.slice(-55)
        : keyParam
      : ''
    return {
      ...base,
      kind: 'tool',
      title: `Tool call · ${toolName}`,
      detail: shortParam || summarizeValue(data?.args),
      inspectInput: stringifyInspectValue(parsedArgs)
    }
  }

  if (type === 'tool_result') {
    return {
      ...base,
      kind: 'tool',
      title: `Tool result · ${String(data?.name || 'unknown')}`,
      detail: summarizeValue(data?.result),
      inspectOutput: stringifyInspectValue(data?.result)
    }
  }

  if (type === 'task.request') {
    const toolName = String(data?.tool || 'tool')
    const payload = data?.payload && typeof data.payload === 'object' ? data.payload : {}
    const rawPayload =
      typeof data?.payload === 'string' ? data.payload : JSON.stringify(data?.payload || '')
    const keyParam = payload.path || payload.query || payload.url || payload.name || ''
    const shortParam = keyParam
      ? keyParam.length > 70
        ? '\u2026' + keyParam.slice(-65)
        : keyParam
      : ''
    return {
      ...base,
      kind: 'tool',
      title: `Desktop request · ${toolName}`,
      detail: shortParam || rawPayload,
      inspectInput: rawPayload
    }
  }

  if (type === 'task.progress') {
    const completedCount = Number(data?.completedCount || 0)
    const currentPlan = String(data?.currentPlan || '').trim()
    return {
      ...base,
      kind: 'task',
      title: currentPlan || `${completedCount} action${completedCount === 1 ? '' : 's'} done`,
      status: 'running',
      detail: `Task ${shortTaskId(data?.taskId)} · ${completedCount} completed`
    }
  }

  if (type === 'task.status') {
    const status = String(data?.status || 'updated').toLowerCase()
    const emoji = status === 'completed' ? '\u2713 ' : status === 'failed' ? '\u2717 ' : ''
    return {
      ...base,
      kind: status === 'failed' ? 'error' : 'task',
      title: `${emoji}Task ${status}`,
      status,
      detail: summarizeValue(data?.message || data?.result) || shortTaskId(data?.taskId)
    }
  }

  if (type === 'task.usage') {
    return {
      ...base,
      kind: 'usage',
      title: 'Model usage',
      detail: `input ${Number(data?.inputTokens || 0)} · output ${Number(data?.outputTokens || 0)}`
    }
  }

  if (type === 'code_execution') {
    return {
      ...base,
      kind: 'tool',
      title: 'Code execution',
      detail: summarizeValue(data?.commands)
    }
  }

  if (type === 'code_result') {
    return {
      ...base,
      kind: 'tool',
      title: 'Code result',
      detail: summarizeValue(data?.output || data?.outcome)
    }
  }

  if (type === 'tools_declared') {
    return {
      ...base,
      kind: 'status',
      title: 'Desktop tools ready',
      detail: `${Number(data?.count || 0)} declared`
    }
  }

  if (type === 'mode') {
    return { ...base, kind: 'status', title: 'Mode update', detail: String(data?.mode || 'text') }
  }

  if (type === 'error') {
    return {
      ...base,
      kind: 'error',
      title: 'Error',
      detail: summarizeValue(data?.message || 'Chat request failed.')
    }
  }

  return null
}
