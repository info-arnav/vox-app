import { promisify } from 'util'
import { exec } from 'child_process'
import { resolveLocalPath } from '../../shared'
import { EXEC_TIMEOUT, writeTempScript, cleanupTemp, parseTabSeparated } from '../shared'

const execAsync = promisify(exec)

export const sendEmailWindows = async ({ to, cc, bcc, subject, body, attachments }) => {
  const toStr = to.join('; ')
  const ccStr = cc.join('; ')
  const bccStr = bcc.join('; ')

  const attachLines = attachments
    .map((p) => `$mail.Attachments.Add('${resolveLocalPath(p).replace(/'/g, "''")}')`)
    .join('\n')

  const script = [
    '$ErrorActionPreference = "Stop"',
    'try {',
    '  $ol = New-Object -ComObject Outlook.Application',
    '  $mail = $ol.CreateItem(0)',
    `  $mail.To = '${toStr.replace(/'/g, "''")}'`,
    `  $mail.Subject = '${subject.replace(/'/g, "''")}'`,
    `  $mail.Body = '${body.replace(/'/g, "''")}'`,
    ccStr ? `  $mail.CC = '${ccStr.replace(/'/g, "''")}'` : '',
    bccStr ? `  $mail.BCC = '${bccStr.replace(/'/g, "''")}'` : '',
    attachLines,
    '  $mail.Send()',
    "  Write-Output 'SENT_OUTLOOK'",
    '} catch {',
    '  Write-Output "FAILED:$($_.Exception.Message)"',
    '}'
  ]
    .filter((l) => l !== '')
    .join('\n')

  const scriptFile = await writeTempScript(script, 'ps1')
  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${scriptFile}"`,
      { timeout: EXEC_TIMEOUT }
    )
    if (stdout.trim().startsWith('SENT_OUTLOOK')) {
      return { status: 'sent', to, subject, platform: 'Windows Outlook' }
    }
  } finally {
    await cleanupTemp(scriptFile)
  }

  const params = new URLSearchParams()
  if (subject) params.set('subject', subject)
  if (body) params.set('body', body)
  if (ccStr) params.set('cc', ccStr)
  if (bccStr) params.set('bcc', bccStr)
  const mailtoUrl = `mailto:${to.join(',')}?${params.toString()}`
  await execAsync(`Start-Process "${mailtoUrl.replace(/"/g, '\\"')}"`, { timeout: 5_000 }).catch(
    () => {}
  )

  return {
    status: 'opened',
    to,
    subject,
    platform: 'Windows default mail client (draft opened — please click Send)'
  }
}

export const searchContactsWindows = async (query) => {
  const script = [
    '$results = @()',
    `$q = '${query.replace(/'/g, "''")}'`,
    'try {',
    '  $ol = New-Object -ComObject Outlook.Application',
    '  $ns = $ol.GetNamespace("MAPI")',
    '  $contacts = $ns.GetDefaultFolder(10).Items',
    '  foreach ($c in $contacts) {',
    '    if ($c.FullName -match $q -or $c.FirstName -match $q -or $c.LastName -match $q) {',
    '      if ($c.Email1Address) { $results += "$($c.FullName)`t$($c.Email1Address)`t$($c.BusinessTelephoneNumber)`t$($c.CompanyName)`t$($c.JobTitle)" }',
    '      if ($c.Email2Address) { $results += "$($c.FullName)`t$($c.Email2Address)`t$($c.BusinessTelephoneNumber)`t$($c.CompanyName)`t$($c.JobTitle)" }',
    '    }',
    '  }',
    '} catch {}',
    'try {',
    '  $cp = [IO.Path]::Combine($env:USERPROFILE, "Contacts")',
    '  if (Test-Path $cp) {',
    '    Get-ChildItem $cp -Filter "*.contact" | ForEach-Object {',
    '      [xml]$x = Get-Content $_.FullName',
    '      $nmgr = New-Object System.Xml.XmlNamespaceManager($x.NameTable)',
    '      $nmgr.AddNamespace("c","http://schemas.microsoft.com/Contact/Internal")',
    '      $name = $x.contact.c_contact.NameCollection.Name.FormattedName',
    '      if ($name -and ($name -match $q)) {',
    '        $emails = $x.contact.c_contact.EmailAddressCollection.EmailAddress',
    '        foreach ($e in $emails) { if ($e.Address) { $results += "$name`t$($e.Address)" } }',
    '      }',
    '    }',
    '  }',
    '} catch {}',
    '$results -join "`n"'
  ].join('\n')

  const scriptFile = await writeTempScript(script, 'ps1')
  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${scriptFile}"`,
      { timeout: EXEC_TIMEOUT }
    )
    return parseTabSeparated(stdout)
  } finally {
    await cleanupTemp(scriptFile)
  }
}
