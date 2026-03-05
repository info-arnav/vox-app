import { MAX_TASK_ITEMS, MAX_TASK_HISTORY_ITEMS, MAX_DETAIL_LENGTH } from './chat.constants'
import { clipText } from './chat.text'
import {
  applyPlanEvent,
  applyProgressEvent,
  applySpawnResultEvent,
  applyStatusEvent,
  applyToolEvent
} from './chat.task.handlers'

export const normalizePlanSteps = (steps = []) => {
  if (!Array.isArray(steps)) return []
  return steps
    .map((step, index) => {
      const fallbackId = String(index + 1)
      const stepId = String(step?.id || fallbackId).trim() || fallbackId
      const instruction = clipText(step?.instruction || '', MAX_DETAIL_LENGTH)
      return { id: stepId, instruction }
    })
    .filter((step) => step.id)
}

export const pushTaskHistory = (history, entry) => {
  const normalizedEntry = entry && typeof entry === 'object' ? entry : null
  if (!normalizedEntry) return Array.isArray(history) ? history : []
  const normalizedHistory = Array.isArray(history) ? history : []
  return [normalizedEntry, ...normalizedHistory].slice(0, MAX_TASK_HISTORY_ITEMS)
}

export const createEmptyTaskState = (taskId, timestamp) => ({
  taskId,
  status: 'spawned',
  totalSteps: 0,
  completedStepIds: [],
  currentStepId: '',
  message: '',
  resultPreview: '',
  spawnRequestedAt: '',
  spawnedAt: '',
  plannedAt: '',
  startedAt: '',
  completedAt: '',
  failedAt: '',
  spawnInstructions: '',
  spawnContext: '',
  spawnArgsPreview: '',
  planSteps: [],
  stepMeta: {},
  history: [],
  updatedAt: timestamp || new Date().toISOString()
})

export const upsertTaskState = (currentTasks, taskId, patch, timestamp) => {
  const normalizedTaskId = String(taskId || '').trim()
  if (!normalizedTaskId) return currentTasks

  const currentIndex = currentTasks.findIndex((task) => task.taskId === normalizedTaskId)
  const currentTask =
    currentIndex >= 0
      ? currentTasks[currentIndex]
      : createEmptyTaskState(normalizedTaskId, timestamp)

  const nextTask = { ...currentTask, ...patch, updatedAt: timestamp || new Date().toISOString() }

  const nextTasks =
    currentIndex >= 0
      ? currentTasks.map((task, index) => (index === currentIndex ? nextTask : task))
      : [nextTask, ...currentTasks]

  return nextTasks
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .slice(0, MAX_TASK_ITEMS)
}

export const getTaskIdFromEventData = (data) =>
  String(data?.taskId || data?.result?.taskId || '').trim()

export const getStepIdFromEventData = (data, fallbackTask = null) =>
  String(data?.stepId || data?.result?.stepId || fallbackTask?.currentStepId || '').trim()

export const applyTaskEvent = (event, setTasks, options = {}) => {
  const type = String(event?.type || '')
  const data = event?.data || {}
  const timestamp = event?.timestamp || new Date().toISOString()
  const dequeuePendingSpawn =
    typeof options?.dequeuePendingSpawn === 'function' ? options.dequeuePendingSpawn : null

  if (type === 'tool_result' && data?.name === 'spawn_task' && data?.result?.taskId) {
    applySpawnResultEvent(data, timestamp, setTasks, dequeuePendingSpawn)
    return
  }

  if (type === 'tool_call' || type === 'tool_result') {
    applyToolEvent(type, data, timestamp, setTasks)
    return
  }

  if (type === 'task.plan') {
    applyPlanEvent(data, timestamp, setTasks)
    return
  }

  if (type === 'task.progress') {
    applyProgressEvent(data, timestamp, setTasks)
    return
  }

  if (type === 'task.status') {
    applyStatusEvent(data, timestamp, setTasks)
  }
}
