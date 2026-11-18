param(
  [string]$ServerHost = "39.96.195.158",
  [string]$ServerUser = "root",
  [string]$KeyPath = "D:\Jixiang\.runtime\server-keys\jixiang_aliyun_ecs_20261114",
  [string]$KnownHostsPath = "$env:USERPROFILE\.ssh\known_hosts",
  [string]$RemoteWebDir = "/var/www/jixiang-web",
  [string]$SshExe = "E:\Git\usr\bin\ssh.exe",
  [string]$ScpExe = "E:\Git\usr\bin\scp.exe"
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$MobileDir = Join-Path $RepoRoot "apps\mobile"
$DistDir = Join-Path $MobileDir "dist"
$ArchivePath = Join-Path ([System.IO.Path]::GetTempPath()) ("jixiang-web-dist-" + [Guid]::NewGuid().ToString("N") + ".tar.gz")

if (-not (Test-Path $KeyPath)) {
  throw "SSH private key not found at: $KeyPath"
}

Write-Host "[1/4] Building apps/mobile production dist..."
npm --prefix $MobileDir run build
if ($LASTEXITCODE -ne 0) {
  throw "Frontend build failed with exit code $LASTEXITCODE"
}

Write-Host "[2/4] Packing dist/ archive..."
tar -czf $ArchivePath -C $DistDir .
if ($LASTEXITCODE -ne 0) {
  throw "tar failed with exit code $LASTEXITCODE"
}

try {
  $RemoteTmp = "/tmp/jixiang-web-dist-" + [Guid]::NewGuid().ToString("N") + ".tar.gz"
  Write-Host "[3/4] Uploading archive to ${ServerUser}@${ServerHost}:$RemoteTmp ..."
  & $ScpExe -i $KeyPath -o "UserKnownHostsFile=$KnownHostsPath" -o "StrictHostKeyChecking=yes" $ArchivePath "${ServerUser}@${ServerHost}:$RemoteTmp"
  if ($LASTEXITCODE -ne 0) {
    throw "scp failed with exit code $LASTEXITCODE"
  }

  Write-Host "[4/4] Extracting atomically to $RemoteWebDir ..."
  $RemoteCmd = "set -e; stage=${RemoteWebDir}.new; rm -rf `$stage; mkdir -p `$stage; tar -xzf $RemoteTmp -C `$stage; rm -f $RemoteTmp; chmod -R a+rX `$stage; rm -rf ${RemoteWebDir}.prev; if [ -d $RemoteWebDir ]; then mv $RemoteWebDir ${RemoteWebDir}.prev; fi; mv `$stage $RemoteWebDir; rm -rf ${RemoteWebDir}.prev"
  & $SshExe -i $KeyPath -o "UserKnownHostsFile=$KnownHostsPath" -o "StrictHostKeyChecking=yes" "${ServerUser}@${ServerHost}" $RemoteCmd
  if ($LASTEXITCODE -ne 0) {
    throw "Remote deploy failed with exit code $LASTEXITCODE"
  }

  Write-Host "Verifying https://$ServerHost/ ..."
  curl.exe -fsS -I "https://$ServerHost/"
} finally {
  if (Test-Path $ArchivePath) {
    Remove-Item $ArchivePath -Force
  }
}
