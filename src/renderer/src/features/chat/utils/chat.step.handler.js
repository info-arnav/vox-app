import { MAX_DETAIL_LENGTH } from './chat.constants'
import { clipText, summarizeValue } from './chat.text'
import {
  createEmptyTaskState,
  normalizePlanSteps,
  pushTaskHistory,
  upsertTaskState
} from './chat.tasks'

export const applyPlanEvent = (data, timestamp, setTasks) => {
  const normalizedTaskId = String(data?.taskId || '').trim()
  if (!normalizedTaskId) return

  setTasks((current) => {
    const existing =
      current.find((task) => String(task?.taskId || '') === normalizedTaskId) ||
      createEmptyTaskState(normalizedTaskId, timestamp)
    const planSteps = normalizePlanSteps(data?.steps)
    const stepMeta = {
      ...(existing.stepMeta && typeof existing.stepMeta === 'object' ? existing.stepMeta : {})
    }

    planSteps.forEach((step, index) => {
      const existingStep = stepMeta[step.id] || {}
      stepMeta[step.id] = {
        ...existingStep,
        id: step.id,
        order: existingStep.order || index + 1,
        instruction: step.instruction || existingStep.instruction || '',
        status: existingStep.status || 'pending'
      }
    })

    const history = pushTaskHistory(existing.history, {
      at: timestamp,
      type: 'plan',
      detail: `${planSteps.length} step${planSteps.length === 1 ? '' : 's'} planned`
    })

    const mergedPlanSteps =
      planSteps.length >= (existing.planSteps || []).length ? planSteps : existing.planSteps

    return upsertTaskState(
      current,
      normalizedTaskId,
      {
        status: 'running',
        totalSteps: Math.max(existing.totalSteps || 0, planSteps.length),
        planSteps: mergedPlanSteps,
        stepMeta,
        plannedAt: existing.plannedAt || timestamp,
        startedAt: existing.startedAt || timestamp,
        history
      },
      timestamp
    )
  })
}

export const applyProgressEvent = (data, timestamp, setTasks) => {
  const stepId = String(data?.stepId || '').trim()
  const progressStatus = String(data?.status || '')
    .trim()
    .toLowerCase()
  const total = Number(data?.total || 0)

  setTasks((current) => {
    const taskId = String(data?.taskId || '').trim()
    if (!taskId) return current

    const existing =
      current.find((task) => String(task?.taskId || '') === taskId) ||
      createEmptyTaskState(taskId, timestamp)
    const planSteps = Array.isArray(existing.planSteps) ? existing.planSteps : []
    const stepMeta = {
      ...(existing.stepMeta && typeof existing.stepMeta === 'object' ? existing.stepMeta : {})
    }
    const currentStep = stepId ? stepMeta[stepId] || {} : {}
    const planStepInstruction =
      stepId && planSteps.length > 0
        ? planSteps.find((step) => String(step?.id || '') === stepId)?.instruction || ''
        : ''

    if (stepId) {
      stepMeta[stepId] = {
        ...currentStep,
        id: stepId,
        instruction: currentStep.instruction || planStepInstruction || '',
        status: progressStatus || currentStep.status || 'running',
        startedAt:
          currentStep.startedAt ||
          (progressStatus === 'running' || progressStatus === 'completed' ? timestamp : ''),
        completedAt:
          progressStatus === 'completed'
            ? currentStep.completedAt || timestamp
            : currentStep.completedAt || '',
        updatedAt: timestamp,
        updates: Number(currentStep.updates || 0) + 1
      }
    }

    const completedStepIds =
      progressStatus === 'completed' && stepId && !existing.completedStepIds.includes(stepId)
        ? [...existing.completedStepIds, stepId]
        : existing.completedStepIds

    const nextCurrentStepId =
      progressStatus === 'running'
        ? stepId
        : existing.currentStepId === stepId
          ? ''
          : existing.currentStepId

    const history = pushTaskHistory(existing.history, {
      at: timestamp,
      type: progressStatus || 'progress',
      detail: stepId
        ? `Step ${stepId}${total > 0 ? ` of ${total}` : ''} ${progressStatus || 'updated'}`
        : 'Step updated'
    })

    return upsertTaskState(
      current,
      taskId,
      {
        status: progressStatus === 'failed' ? 'failed' : 'running',
        totalSteps: total > 0 ? Math.max(existing.totalSteps, total) : existing.totalSteps,
        currentStepId: nextCurrentStepId,
        completedStepIds,
        stepMeta,
        startedAt: existing.startedAt || timestamp,
        completedAt: existing.completedAt || '',
        history
      },
      timestamp
    )
  })
}

export const applyStatusEvent = (data, timestamp, setTasks) => {
  setTasks((current) => {
    const taskId = String(data?.taskId || '').trim()
    if (!taskId) return current

    const existing =
      current.find((task) => String(task?.taskId || '') === taskId) ||
      createEmptyTaskState(taskId, timestamp)
    const status = String(data?.status || 'updated')
    const normalizedStatus = status.trim().toLowerCase()
    const message = clipText(data?.message, MAX_DETAIL_LENGTH)
    const resultPreview = clipText(summarizeValue(data?.result), MAX_DETAIL_LENGTH)
    const history = pushTaskHistory(existing.history, {
      at: timestamp,
      type: normalizedStatus || 'status',
      detail: clipText(message || resultPreview || `Task ${normalizedStatus || 'updated'}`, 160)
    })

    return upsertTaskState(
      current,
      taskId,
      {
        status,
        message,
        resultPreview,
        currentStepId:
          normalizedStatus === 'completed' ||
          normalizedStatus === 'failed' ||
          normalizedStatus === 'aborted'
            ? ''
            : existing.currentStepId,
        completedAt:
          normalizedStatus === 'completed' || normalizedStatus === 'aborted'
            ? existing.completedAt || timestamp
            : existing.completedAt || '',
        failedAt:
          normalizedStatus === 'failed' ? existing.failedAt || timestamp : existing.failedAt || '',
        history
      },
      timestamp
    )
  })
}
