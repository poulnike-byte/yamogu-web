# QA gate for one task. Does not commit, push, merge, deploy or modify product code.
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)]
  [ValidatePattern('^[A-Z]-[0-9]{2,3}$')]
  [string]$TaskId,
  [switch]$ReviewWithCodex
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$branch = (& git -C $root branch --show-current | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or !$branch -or $branch -in @('main','master')) {
  throw 'BLOCK: QA requires a feature branch, not main.'
}
$card = Join-Path $root ("docs\agents\tasks\" + $TaskId + ".md")
if (!(Test-Path -LiteralPath $card -PathType Leaf)) {
  throw "BLOCK: Task card not found: $TaskId"
}
Write-Output "QA for $TaskId on $branch"
Push-Location $root
try {
  & npm.cmd run check:legal
  if ($LASTEXITCODE -ne 0) { throw 'QA FAIL: legal development gate.' }
  & npm.cmd test
  if ($LASTEXITCODE -ne 0) { throw 'QA FAIL: test suite.' }
  Write-Output 'QA PASS: legal development check and npm test.'
  & git status --short --branch
  if ($ReviewWithCodex) {
    if (!(Get-Command codex -ErrorAction SilentlyContinue)) {
      throw 'QA BLOCK: Codex CLI not installed.'
    }
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    $OutputEncoding = [Console]::OutputEncoding
    $report = Join-Path $env:TEMP ("yamogu-qa-" + $TaskId + "-" + [guid]::NewGuid().ToString('N') + '.txt')
    $prompt = @"
Act as an independent QA reviewer for Yamogu. Reply in Russian.
Read AGENTS.md, the task card docs/agents/tasks/$TaskId.md, and relevant
rules. Inspect git diff and git status. Do not modify files. Do not
approve a legal release. State PASS, FAIL, or BLOCKED with evidence,
test gaps, risks and concrete reproductions. Do not expose child data.
"@
    $prompt | & codex exec --cd $root --sandbox read-only --output-last-message $report -
    if ($LASTEXITCODE -ne 0) { throw 'QA BLOCK: Codex read-only review failed.' }
    Write-Output "QA review: $report"
  }
} finally {
  Pop-Location
}
