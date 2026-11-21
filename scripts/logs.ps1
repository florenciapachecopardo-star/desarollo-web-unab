# Muestra, ordenadas por hora, todas las lineas de log de una solicitud.
# Uso (PowerShell):  .\scripts\logs.ps1 <request_id>
# Si Windows bloquea el script:  powershell -ExecutionPolicy Bypass -File .\scripts\logs.ps1 <request_id>
param([Parameter(Mandatory = $true)][string]$RequestId)

$servicios = @("frontend", "gateway", "auth", "clients", "inventory", "orders", "payments", "graphql-gateway")
docker compose logs --no-color --no-log-prefix @servicios 2>$null |
    Select-String -Pattern ('"request_id": ?"' + [regex]::Escape($RequestId) + '"') |
    ForEach-Object { $_.Line } |
    Sort-Object
