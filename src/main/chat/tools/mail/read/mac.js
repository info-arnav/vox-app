import { promisify } from 'util'
import { exec } from 'child_process'
import { EXEC_TIMEOUT, writeTempScript, cleanupTemp } from '../shared'

const execAsync = promisify(exec)

const parseEmailRecords = (stdout, search) => {
  const lower = search.toLowerCase()
  return String(stdout || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [sender, subject, date, read] = line.split('\t')
      return { sender, subject, date, read }
    })
    .filter(({ sender = '', subject = '' }) =>
      lower ? sender.toLowerCase().includes(lower) || subject.toLowerCase().includes(lower) : true
    )
}

export const readEmailsMac = async ({ folder, limit, unreadOnly, search }) => {
  const folderSafe = folder.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const isInbox = folder.toLowerCase() === 'inbox'

  const script = isInbox
    ? [
        `set limitN to ${limit}`,
        `set unreadOnly to ${unreadOnly}`,
        'tell application "Mail"',
        '  set output to ""',
        '  set found to 0',
        '  set allBoxes to {}',
        '  try',
        '    set end of allBoxes to inbox',
        '  end try',
        '  repeat with acct in every account',
        '    try',
        '      set end of allBoxes to mailbox "INBOX" of acct',
        '    end try',
        '  end repeat',
        '  repeat with ib in allBoxes',
        '    repeat with m in messages of ib',
        '      if found >= limitN then exit repeat',
        '      set isRead to read status of m',
        '      if unreadOnly and isRead then',
        '      else',
        '        set sndr to sender of m',
        '        set subj to subject of m',
        '        set dtStr to (date received of m) as string',
        '        set readStr to "read"',
        '        if not isRead then set readStr to "unread"',
        '        set output to output & sndr & tab & subj & tab & dtStr & tab & readStr & return',
        '        set found to found + 1',
        '      end if',
        '    end repeat',
        '    if found >= limitN then exit repeat',
        '  end repeat',
        '  return output',
        'end tell'
      ].join('\n')
    : [
        `set targetName to "${folderSafe}"`,
        `set limitN to ${limit}`,
        `set unreadOnly to ${unreadOnly}`,
        'tell application "Mail"',
        '  set output to ""',
        '  set found to 0',
        '  set targetBox to missing value',
        '  repeat with acct in every account',
        '    repeat with mb in mailboxes of acct',
        '      if name of mb contains targetName then',
        '        set targetBox to mb',
        '        exit repeat',
        '      end if',
        '    end repeat',
        '    if targetBox is not missing value then exit repeat',
        '  end repeat',
        '  if targetBox is missing value then',
        '    repeat with mb in every mailbox',
        '      if name of mb contains targetName then',
        '        set targetBox to mb',
        '        exit repeat',
        '      end if',
        '    end repeat',
        '  end if',
        '  if targetBox is missing value then return "ERROR:no mailbox found"',
        '  repeat with m in messages of targetBox',
        '    if found >= limitN then exit repeat',
        '    set isRead to read status of m',
        '    if unreadOnly and isRead then',
        '    else',
        '      set sndr to sender of m',
        '      set subj to subject of m',
        '      set dtStr to (date received of m) as string',
        '      set readStr to "read"',
        '      if not isRead then set readStr to "unread"',
        '      set output to output & sndr & tab & subj & tab & dtStr & tab & readStr & return',
        '      set found to found + 1',
        '    end if',
        '  end repeat',
        '  return output',
        'end tell'
      ].join('\n')

  const scriptFile = await writeTempScript(script, 'scpt')
  try {
    const { stdout } = await execAsync(`osascript "${scriptFile}"`, { timeout: EXEC_TIMEOUT })
    if (stdout.trim().startsWith('ERROR:')) throw new Error(stdout.trim().slice(6))
    return parseEmailRecords(stdout, search)
  } finally {
    await cleanupTemp(scriptFile)
  }
}
