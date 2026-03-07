import { globalShortcut, systemPreferences, app } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { VOICE_ACTIVATE_CHANNEL, emitToWindows } from '../chat/chat.socket.state'

let porcupine = null
let recorder = null
let recorderRunning = false
let wakeWordPaused = false

const emitActivate = () => {
  emitToWindows(VOICE_ACTIVATE_CHANNEL, {})
}

const runPorcupineLoop = async () => {
  if (!recorderRunning || !porcupine || !recorder) return

  if (wakeWordPaused) {
    setTimeout(runPorcupineLoop, 200)
    return
  }

  try {
    const frame = await Promise.resolve(recorder.read())
    const index = porcupine.process(frame)
    if (index >= 0) {
      emitActivate()
      wakeWordPaused = true
    }
  } catch {
    if (!recorderRunning) return
  }

  if (recorderRunning) setImmediate(runPorcupineLoop)
}

const getPorcupineUnpackedBase = () => {
  if (is.dev) return join(app.getAppPath(), 'node_modules/@picovoice/porcupine-node')
  return join(process.resourcesPath, 'app.asar.unpacked/node_modules/@picovoice/porcupine-node')
}

const getPorcupinePlatformPaths = () => {
  const base = getPorcupineUnpackedBase()
  const plt =
    process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'windows' : 'linux'
  const archMap = {
    darwin: { arm64: 'arm64', x64: 'x86_64' },
    win32: { x64: 'amd64', arm64: 'arm64' },
    linux: { x64: 'x86_64', arm64: 'cortex-a76-aarch64' }
  }
  const arch = (archMap[process.platform] || {})[process.arch] || process.arch
  return {
    keywordPath: join(base, `resources/keyword_files/${plt}/computer_${plt}.ppn`),
    modelPath: join(base, 'lib/common/porcupine_params.pv'),
    libraryPath: join(base, `lib/${plt}/${arch}/pv_porcupine.node`)
  }
}

const startPorcupine = (accessKey) => {
  try {
    const { Porcupine } = require('@picovoice/porcupine-node')
    const { PvRecorder } = require('@picovoice/pvrecorder-node')
    const { keywordPath, modelPath, libraryPath } = getPorcupinePlatformPaths()

    porcupine = new Porcupine(accessKey, [keywordPath], [0.5], { modelPath, libraryPath })
    recorder = new PvRecorder(porcupine.frameLength)
    recorder.start()
    recorderRunning = true
    setImmediate(runPorcupineLoop)
  } catch (err) {
    console.error('[voice] Porcupine init failed — shortcut-only mode:', err)
  }
}

const initPorcupine = async () => {
  const accessKey = import.meta.env.PORCUPINE_ACCESS_KEY || process.env.PORCUPINE_ACCESS_KEY
  if (!accessKey) {
    console.warn('[voice] PORCUPINE_ACCESS_KEY not set — wake word disabled')
    return
  }

  if (process.platform === 'darwin') {
    const status = systemPreferences.getMediaAccessStatus('microphone')
    if (status !== 'granted') {
      const granted = await systemPreferences.askForMediaAccess('microphone')
      if (!granted) {
        console.warn('[voice] Microphone permission denied — wake word disabled')
        return
      }
    }
  } else if (process.platform === 'win32') {
    const status = systemPreferences.getMediaAccessStatus('microphone')
    if (status !== 'granted') {
      console.warn(
        '[voice] Microphone access denied in Windows privacy settings — wake word disabled'
      )
      return
    }
  }

  startPorcupine(accessKey)
}

export const pauseWakeWord = () => {
  wakeWordPaused = true
}

export const resumeWakeWord = () => {
  wakeWordPaused = false
  if (recorderRunning) {
    setImmediate(runPorcupineLoop)
  }
}

export const initVoiceService = () => {
  const registered = globalShortcut.register('CommandOrControl+Alt+V', emitActivate)
  if (!registered) {
    globalShortcut.register('CommandOrControl+Shift+Space', emitActivate)
  }
  initPorcupine().catch((err) => console.error('[voice] initPorcupine error:', err))
}

export const destroyVoiceService = () => {
  globalShortcut.unregisterAll()
  recorderRunning = false
  if (recorder) {
    try {
      recorder.stop()
      recorder.release()
    } catch (error) {
      void error
    }
    recorder = null
  }
  if (porcupine) {
    try {
      porcupine.release()
    } catch (error) {
      void error
    }
    porcupine = null
  }
}
