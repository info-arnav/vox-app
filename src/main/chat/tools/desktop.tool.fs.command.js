import { exec } from 'child_process'
import os from 'os'
import { resolveLocalPath } from './desktop.tool.shared'

export const runLocalCommand = async (payload) => {
  const command = String(payload?.command || '').trim()
  if (!command) {
    throw new Error('Command is required.')
  }

  const cwd = payload?.cwd ? resolveLocalPath(payload.cwd) : os.homedir()
  const timeoutMs = Math.min(Math.max(Number(payload?.timeoutMs) || 120000, 1000), 600000)
  const maxOutputChars = Math.min(Math.max(Number(payload?.maxOutputChars) || 50000, 1000), 200000)
  const startedAt = Date.now()

  return new Promise((resolve) => {
    exec(
      command,
      {
        cwd,
        timeout: timeoutMs,
        maxBuffer: 8 * 1024 * 1024
      },
      (error, stdout, stderr) => {
        const durationMs = Date.now() - startedAt
        const safeStdout = String(stdout || '').slice(0, maxOutputChars)
        const safeStderr = String(stderr || '').slice(0, maxOutputChars)

        if (!error) {
          resolve({
            command,
            cwd,
            exitCode: 0,
            timedOut: false,
            durationMs,
            stdout: safeStdout,
            stderr: safeStderr
          })
          return
        }

        const timedOut = Boolean(
          error?.killed && (error?.signal === 'SIGTERM' || /timeout/i.test(String(error?.message)))
        )

        resolve({
          command,
          cwd,
          exitCode: Number.isInteger(error?.code) ? error.code : 1,
          timedOut,
          durationMs,
          stdout: safeStdout,
          stderr: safeStderr || String(error?.message || 'Command failed')
        })
      }
    )
  })
}
