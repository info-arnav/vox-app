import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const CHAT_STATUS_CHANNEL = 'chat:status'
const CHAT_EVENT_CHANNEL = 'chat:event'
const TOOL_LOG_CHANNEL = 'chat:tool-log'
const VOICE_ACTIVATE_CHANNEL = 'voice:activate'
const VOICE_AUDIO_CHANNEL = 'voice:audio'
const AUTH_EXPIRED_CHANNEL = 'auth:expired'

const subscribeToRendererEvent = (channel, listener) => {
  if (typeof listener !== 'function') {
    return () => {}
  }

  const wrappedListener = (_event, payload) => listener(payload)
  electronAPI.ipcRenderer.on(channel, wrappedListener)
  return () => {
    electronAPI.ipcRenderer.removeListener(channel, wrappedListener)
  }
}

const api = {
  auth: {
    login: (email, password) => electronAPI.ipcRenderer.invoke('auth:login', { email, password }),
    register: (email, password) =>
      electronAPI.ipcRenderer.invoke('auth:register', { email, password }),
    logout: () => electronAPI.ipcRenderer.invoke('auth:logout'),
    getSession: () => electronAPI.ipcRenderer.invoke('auth:get-session'),
    resendVerification: () => electronAPI.ipcRenderer.invoke('auth:resend-verification'),
    refreshVerification: () => electronAPI.ipcRenderer.invoke('auth:refresh-verification'),
    getWorkspaceBootstrap: () => electronAPI.ipcRenderer.invoke('auth:get-workspace-bootstrap'),
    updateWorkspaceProfile: (payload) =>
      electronAPI.ipcRenderer.invoke('auth:update-workspace-profile', payload),
    onExpired: (listener) => subscribeToRendererEvent(AUTH_EXPIRED_CHANNEL, listener)
  },
  billing: {
    startCheckout: (credits) =>
      electronAPI.ipcRenderer.invoke('billing:start-checkout', { credits })
  },
  chat: {
    connect: () => electronAPI.ipcRenderer.invoke('chat:connect'),
    disconnect: () => electronAPI.ipcRenderer.invoke('chat:disconnect'),
    getStatus: () => electronAPI.ipcRenderer.invoke('chat:get-status'),
    sendMessage: (content) => electronAPI.ipcRenderer.invoke('chat:send-message', { content }),
    setMode: (mode) => electronAPI.ipcRenderer.invoke('chat:set-mode', { mode }),
    onStatus: (listener) => subscribeToRendererEvent(CHAT_STATUS_CHANNEL, listener),
    onEvent: (listener) => subscribeToRendererEvent(CHAT_EVENT_CHANNEL, listener),
    onToolLog: (listener) => subscribeToRendererEvent(TOOL_LOG_CHANNEL, listener)
  },
  tasks: {
    list: (params) => electronAPI.ipcRenderer.invoke('task:list', params || {}),
    get: (taskId) => electronAPI.ipcRenderer.invoke('task:get', { taskId }),
    abort: (taskId) => electronAPI.ipcRenderer.invoke('task:abort', { taskId }),
    resume: (taskId) => electronAPI.ipcRenderer.invoke('task:resume', { taskId })
  },
  indexing: {
    start: (folders) => electronAPI.ipcRenderer.invoke('indexing:start', { folders }),
    stop: () => electronAPI.ipcRenderer.invoke('indexing:stop'),
    resetState: () => electronAPI.ipcRenderer.invoke('indexing:reset-state'),
    getStatus: () => electronAPI.ipcRenderer.invoke('indexing:get-status'),
    getDefaultFolders: () => electronAPI.ipcRenderer.invoke('indexing:get-default-folders'),
    pickFolder: () => electronAPI.ipcRenderer.invoke('indexing:pick-folder'),
    removeFolderData: (folderPath) =>
      electronAPI.ipcRenderer.invoke('indexing:remove-folder-data', {
        folderPath
      }),
    getIndexedChildren: (folderPath, basePath) =>
      electronAPI.ipcRenderer.invoke('indexing:get-indexed-children', {
        folderPath,
        basePath
      })
  },
  voice: {
    sendAudio: (arrayBuffer) => electronAPI.ipcRenderer.invoke('voice:send-audio', arrayBuffer),
    sessionStart: () => electronAPI.ipcRenderer.invoke('voice:session-start'),
    sessionEnd: () => electronAPI.ipcRenderer.invoke('voice:session-end'),
    setIgnoreMouseEvents: (ignore) => electronAPI.ipcRenderer.send('voice:mouse-ignore', ignore),
    onActivate: (listener) => subscribeToRendererEvent(VOICE_ACTIVATE_CHANNEL, listener),
    onAudio: (listener) => {
      if (typeof listener !== 'function') return () => {}
      const wrapped = (_event, buf) => listener(buf)
      electronAPI.ipcRenderer.on(VOICE_AUDIO_CHANNEL, wrapped)
      return () => electronAPI.ipcRenderer.removeListener(VOICE_AUDIO_CHANNEL, wrapped)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}
