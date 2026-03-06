import { promisify } from 'util'
import { exec } from 'child_process'
import { resolveLocalPath } from '../../shared'
import { EXEC_TIMEOUT, writeTempScript, cleanupTemp, parseTabSeparated } from '../shared'

const execAsync = promisify(exec)

export const sendEmailMac = async ({ to, cc, bcc, subject, body, attachments }) => {
  const lines = [
    'tell application "Mail"',
    `  set msg to make new outgoing message with properties {subject:"${subject.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}", content:"${body.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}", visible:false}`,
    '  tell msg'
  ]

  for (const addr of to) {
    lines.push(`    make new to recipient with properties {address:"${addr.replace(/"/g, '\\"')}"}`)
  }
  for (const addr of cc) {
    lines.push(`    make new cc recipient with properties {address:"${addr.replace(/"/g, '\\"')}"}`)
  }
  for (const addr of bcc) {
    lines.push(
      `    make new bcc recipient with properties {address:"${addr.replace(/"/g, '\\"')}"}`
    )
  }
  for (const p of attachments) {
    const abs = resolveLocalPath(p)
    lines.push(
      `    make new attachment with properties {file name:(POSIX file "${abs.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")} at after the last paragraph`
    )
  }

  lines.push('  end tell', '  send msg', 'end tell')

  const scriptFile = await writeTempScript(lines.join('\n'), 'scpt')
  try {
    await execAsync(`osascript "${scriptFile}"`, { timeout: EXEC_TIMEOUT })
    return { status: 'sent', to, subject, platform: 'macOS Mail.app' }
  } finally {
    await cleanupTemp(scriptFile)
  }
}

export const searchContactsMac = async (query) => {
  const script = [
    `set Q to "${query.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`,
    'set output to ""',
    'tell application "Contacts"',
    '  set matched to every person whose name contains Q',
    '  repeat with p in matched',
    '    set pName to name of p',
    '    repeat with e in emails of p',
    '      set output to output & pName & "\\t" & (value of e) & "\\n"',
    '    end repeat',
    '  end repeat',
    'end tell',
    'return output'
  ].join('\n')

  const scriptFile = await writeTempScript(script, 'scpt')
  try {
    const { stdout } = await execAsync(`osascript "${scriptFile}"`, { timeout: EXEC_TIMEOUT })
    return parseTabSeparated(stdout)
  } finally {
    await cleanupTemp(scriptFile)
  }
}
