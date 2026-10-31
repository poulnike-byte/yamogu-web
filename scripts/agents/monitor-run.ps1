# Monitored run. Read-only developer or verified QA test, always in an isolated worktree.
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][ValidateSet('developer','qa')][string]$Role,
  [Parameter(Mandatory=$true)][ValidatePattern('^[A-Z]-[0-9]{2,3}$')][string]$TaskId
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$root=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$branch=(& git -C $root branch --show-current | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or !$branch -or $branch -in @('main','master')) {
  throw 'BLOCK: monitored run requires a feature branch'
}
$card=Join-Path $root ("docs\agents\tasks\"+$TaskId+".md")
if (!(Test-Path -LiteralPath $card -PathType Leaf)) {
  throw "BLOCK: no task card for $TaskId"
}
$eventScript=Join-Path $PSScriptRoot 'log-event.cjs'
$runner=Join-Path $PSScriptRoot $(if($Role -eq 'developer'){'run-developer.ps1'}else{'run-qa.ps1'})
$id=[guid]::NewGuid().ToString('N')
$exitCode=1
& node $eventScript $Role $TaskId 'running' $PID $id
if ($LASTEXITCODE -ne 0) { throw 'Cannot record start event' }
try {
  if ($Role -eq 'developer') {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $runner -TaskId $TaskId -Run -ReadOnly
  } else {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $runner -TaskId $TaskId
  }
  $exitCode=$LASTEXITCODE
} finally {
  $state=if($exitCode -eq 0){'finished'}else{'failed'}
  & node $eventScript $Role $TaskId $state $PID $id
  if ($LASTEXITCODE -ne 0) { Write-Warning 'Could not record finish event' }
}
exit $exitCode
