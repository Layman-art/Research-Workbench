$ErrorActionPreference = 'Stop'
$binary = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../src-tauri/target/release/research-workbench.exe')).Path
$database = Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'com.researchworkbench.desktop/research-workbench.db'
$process = Start-Process -FilePath $binary -ArgumentList '--hidden' -WindowStyle Hidden -PassThru
try {
  $deadline = (Get-Date).AddSeconds(45)
  while ((Get-Date) -lt $deadline) {
    if ($process.HasExited) { throw "Desktop exited unexpectedly: $($process.ExitCode)" }
    if (Test-Path -LiteralPath $database) {
      $env:WORKBENCH_SMOKE_DATABASE = $database
      node --input-type=module -e "import {DatabaseSync} from 'node:sqlite'; const db=new DatabaseSync(process.env.WORKBENCH_SMOKE_DATABASE,{readOnly:true}); const version=db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get().version; const count=db.prepare('SELECT COUNT(*) AS count FROM records').get().count; db.close(); if(version!==2||count<1)process.exit(1); console.log('Native startup: schema',version,'records',count);"
      if ($LASTEXITCODE -eq 0) { break }
    }
    Start-Sleep -Seconds 2
  }
  if ($LASTEXITCODE -ne 0 -or !(Test-Path -LiteralPath $database)) { throw 'Native app did not initialize its SQLite database' }
  $backupDir = Join-Path (Split-Path $database) 'backups'
  $deadline = (Get-Date).AddSeconds(20)
  while ((Get-Date) -lt $deadline -and !(Get-ChildItem -LiteralPath $backupDir -Filter '*.sqlite' -ErrorAction SilentlyContinue)) { Start-Sleep -Seconds 1 }
  if (!(Get-ChildItem -LiteralPath $backupDir -Filter '*.sqlite' -ErrorAction SilentlyContinue)) { throw 'Native automatic backup was not created' }
  Write-Output 'Native hidden startup, SQL permissions, schema migration and automatic backup passed.'
} finally {
  # CI-only, disposable profile. Production quit awaits pending drafts and writes.
  if (!$process.HasExited) { Stop-Process -Id $process.Id -Force }
}
