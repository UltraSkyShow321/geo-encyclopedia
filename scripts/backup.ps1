# 备份脚本: 打包 content(内容源) + data(数据库/缓存) + .env(配置) 到 backups/
# 保留最近 14 份。可在绿联 NAS 定时任务中调用:
#   powershell -ExecutionPolicy Bypass -File D:\...\scripts\backup.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $root 'backups'
New-Item -ItemType Directory -Force -Path $dest | Out-Null

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$file = Join-Path $dest "geo-backup-$stamp.tar.gz"

# 停止容器避免数据库写入期间备份（如未运行 docker 则跳过）
try {
    docker compose -f (Join-Path $root 'docker-compose.yml') stop 2>$null | Out-Null
} catch { }

tar -czf $file -C $root content data .env 2>$null
if (-not (Test-Path $file)) {
    # 无 .env 时回退重打
    tar -czf $file -C $root content data 2>$null
}

try {
    docker compose -f (Join-Path $root 'docker-compose.yml') start 2>$null | Out-Null
} catch { }

# 保留最近 14 份
Get-ChildItem $dest -Filter 'geo-backup-*.tar.gz' |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip 14 |
    Remove-Item -Force -ErrorAction SilentlyContinue

Write-Host "备份完成: $file"
