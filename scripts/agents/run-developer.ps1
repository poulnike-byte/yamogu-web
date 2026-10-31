# Runs Codex as the developer role for one approved task card.
# Default is a dry run; -Run performs a Codex invocation.
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)]
  [ValidatePattern('^[A-Z]-[0-9]{2,3}$')]
  [string]$TaskId,
  [switch]$Run,
  [switch]$ReadOnly
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$branch = (& git -C $root branch --show-current | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($branch)) {
  throw 'BLOCK: Git branch not detected (detached HEAD?).'
}
if ($branch -in @('main','master')) {
  throw 'BLOCK: Never execute the developer agent on main/master.'
}
$card = Join-Path $root ("docs\agents\tasks\" + $TaskId + ".md")
if (-not (Test-Path -LiteralPath $card -PathType Leaf)) {
  throw "BLOCK: Task card not found: $TaskId"
}
$task = Get-Content -LiteralPath $card -Raw -Encoding UTF8
if ($task -notmatch ('(?m)^Task-ID:\s*' + [regex]::Escape($TaskId) + '\s*$')) {
  throw 'BLOCK: Task-ID does not match the selected card.'
}
$changes = @(& git -C $root status --porcelain)
if ($Run -and -not $ReadOnly -and $changes.Count -gt 0) {
  throw 'BLOCK: Worktree has changes. Commit or isolate them before a write run.'
}
$mode = if ($ReadOnly) { 'read-only' } else { 'workspace-write' }
Write-Output "Task: $TaskId | Branch: $branch | Sandbox: $mode | Run: $Run"
if (-not $Run) {
  Write-Output 'DRY RUN OK: task and branch validated; Codex was not invoked.'
  exit 0
}
if (-not (Get-Command codex -ErrorAction SilentlyContinue)) {
  throw 'BLOCK: Codex CLI not installed.'
}
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding
$prompt = @"
You are the DEVELOPER agent for Yamogu. Respond in Russian. Read AGENTS.md,
docs/agents/COORDINATOR.md, docs/agents/DEVELOPER.md, and relevant regulations.
One task only. Do not touch main or other worktrees. Do not publish, deploy,
push, merge, change infrastructure, or claim LEGAL_APPROVED. Do not use real
child data, photos, passwords, access tokens, or unapproved third-party APIs.
If rules are unclear, report BLOCKED without making risky edits.
For read-only mode, inspect only, report a concise plan and verification.
For write mode, make the smallest allowed change, run relevant tests,
and report files changed, pass/fail, remaining risks, and QA handoff.
Do not commit automatically.
Never invoke Codex recursively or launch this runner with -Run from a Codex session.
TASK CARD:
$task
"@
$report = Join-Path $env:TEMP ("yamogu-" + $TaskId + "-" + [guid]::NewGuid().ToString('N') + ".txt")
$prompt | & codex exec --cd $root --sandbox $mode --output-last-message $report -
if ($LASTEXITCODE -ne 0) {
  throw "Codex failed. Exit code: $LASTEXITCODE"
}
Write-Output "Codex report: $report"
if (-not $ReadOnly) {
  Push-Location $root
  try {
    & npm.cmd run check:legal
    if ($LASTEXITCODE -ne 0) { throw 'Legal development check failed.' }
    & npm.cmd test
    if ($LASTEXITCODE -ne 0) { throw 'Test suite failed.' }
    & git diff --stat
    Write-Output 'HANDOFF TO QA: development checks passed; review diff and legal impact before any commit/PR.'
  } finally { Pop-Location }
}
