$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir
$driveRoot = [System.IO.Path]::GetPathRoot($rootDir)
$dataDir = Join-Path $rootDir 'pipeline-energy-cloud\data\mysql-3307'
$junctionPath = Join-Path $driveRoot 'oil-mysql-3307'
$logFile = Join-Path $driveRoot 'oil-mysql-3307.err'
$pidFile = Join-Path $driveRoot 'oil-mysql-3307.pid'

$mysqlService = Get-CimInstance Win32_Service -Filter "Name='MySQL80'" | Select-Object -First 1
if (-not $mysqlService) {
  throw 'MySQL80 service not found. Cannot locate mysqld.exe for the local 3307 instance.'
}

if ($mysqlService.PathName -match '^"([^"]+mysqld\.exe)"') {
  $mysqldExe = $matches[1]
} elseif ($mysqlService.PathName -match '^(\S*mysqld\.exe)') {
  $mysqldExe = $matches[1]
} else {
  throw "Unable to parse mysqld.exe from service path: $($mysqlService.PathName)"
}

if (-not (Test-Path $mysqldExe)) {
  throw "mysqld.exe not found: $mysqldExe"
}
if (-not (Test-Path $dataDir)) {
  throw "MySQL 3307 data directory not found: $dataDir"
}

function Get-MySql3307Listener {
  Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -eq 3307 } |
    Select-Object -First 1
}

$listener = Get-MySql3307Listener
if ($listener) {
  $owner = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)" | Select-Object -First 1
  if ($owner -and $owner.Name -eq 'mysqld.exe') {
    exit 0
  }
  throw "Port 3307 is already in use by PID $($listener.OwningProcess), and it is not mysqld.exe."
}

if (-not (Test-Path $junctionPath)) {
  New-Item -ItemType Junction -Path $junctionPath -Target $dataDir | Out-Null
}

Start-Process -FilePath $mysqldExe -ArgumentList @(
  "--datadir=$($junctionPath -replace '\\','/')",
  '--port=3307',
  '--mysqlx=0',
  '--server-id=3307',
  '--lower_case_table_names=2',
  "--log-error=$logFile",
  "--pid-file=$pidFile",
  '--bind-address=127.0.0.1'
) -WindowStyle Hidden | Out-Null

$deadline = (Get-Date).AddSeconds(25)
while ((Get-Date) -lt $deadline) {
  if (Get-MySql3307Listener) {
    exit 0
  }
  Start-Sleep -Seconds 1
}

throw "MySQL 3307 did not become ready within 25 seconds. See $logFile"
