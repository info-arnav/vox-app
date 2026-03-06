import { promisify } from 'util'
import { exec } from 'child_process'
import { EXEC_TIMEOUT, writeTempScript, cleanupTemp } from '../shared'

const execAsync = promisify(exec)

export const readEmailsWindows = async ({ folder, limit, unreadOnly, search }) => {
  const folderSafe = folder.replace(/'/g, "''")
  const script = [
    '$ErrorActionPreference = "Stop"',
    'try {',
    '  $ol = New-Object -ComObject Outlook.Application',
    '  $ns = $ol.GetNamespace("MAPI")',
    `  $inbox = $ns.Folders | ForEach-Object { $_.Folders | Where-Object { $_.Name -like '*${folderSafe}*' } } | Select-Object -First 1`,
    '  if (-not $inbox) { $inbox = $ns.GetDefaultFolder(6) }',
    '  $items = $inbox.Items',
    '  $items.Sort("[ReceivedTime]", $true)',
    `  $limit = ${limit}`,
    `  $unreadOnly = $${unreadOnly}`,
    `  $search = '${search.replace(/'/g, "''")}'.ToLower()`,
    '  $found = 0',
    '  $output = ""',
    '  foreach ($m in $items) {',
    '    if ($found -ge $limit) { break }',
    '    if ($unreadOnly -and $m.UnRead -eq $false) { continue }',
    '    $sndr = $m.SenderEmailAddress',
    '    $subj = $m.Subject',
    '    $dt = $m.ReceivedTime.ToString("yyyy-MM-dd HH:mm")',
    '    $readStr = if ($m.UnRead) { "unread" } else { "read" }',
    '    if ($search -and -not ($sndr.ToLower().Contains($search) -or $subj.ToLower().Contains($search))) { continue }',
    '    $output += "$sndr`t$subj`t$dt`t$readStr`n"',
    '    $found++',
    '  }',
    '  Write-Output $output',
    '} catch {',
    '  Write-Output "ERROR:$($_.Exception.Message)"',
    '}'
  ].join('\n')

  const scriptFile = await writeTempScript(script, 'ps1')
  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${scriptFile}"`,
      { timeout: EXEC_TIMEOUT }
    )
    if (stdout.trim().startsWith('ERROR:')) throw new Error(stdout.trim().slice(6))
    return parseEmailRecords(stdout)
  } finally {
    await cleanupTemp(scriptFile)
  }
}

const parseEmailRecords = (stdout) =>
  String(stdout || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [sender, subject, date, read] = line.split('\t')
      return { sender, subject, date, read }
    })

export const getEmailBodyWindows = async ({ sender = '', subject = '' } = {}) => {
  const sQ = sender.replace(/'/g, "''")
  const subQ = subject.replace(/'/g, "''")

  const script = [
    '$ErrorActionPreference = "Stop"',
    'try {',
    '  $ol = New-Object -ComObject Outlook.Application',
    '  $ns = $ol.GetNamespace("MAPI")',
    '  function Search-Folder($folder) {',
    '    foreach ($item in $folder.Items) {',
    `      $ms = '${sQ}'; $msub = '${subQ}'`,
    '      $okS = ($ms -eq "" -or ($item.SenderEmailAddress -like "*$ms*") -or ($item.SenderName -like "*$ms*"))',
    '      $okT = ($msub -eq "" -or ($item.Subject -like "*$msub*"))',
    '      if ($okS -and $okT) { Write-Output $item.Body; return }',
    '    }',
    '    foreach ($sub in $folder.Folders) { Search-Folder $sub }',
    '  }',
    '  foreach ($store in $ns.Stores) { Search-Folder $store.GetRootFolder() }',
    '} catch {}'
  ].join('\n')

  const scriptFile = await writeTempScript(script, 'ps1')
  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -File "${scriptFile}"`,
      { timeout: EXEC_TIMEOUT }
    )
    const body = stdout.trim()
    if (!body) return { found: false, body: null }
    return { found: true, body: body.slice(0, 8000) }
  } finally {
    await cleanupTemp(scriptFile)
  }
}
