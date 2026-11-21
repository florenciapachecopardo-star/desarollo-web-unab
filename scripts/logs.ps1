# Muestra todas las lineas de log de una solicitud, en el orden en que ocurrieron.
# Uso (PowerShell):  .\scripts\logs.ps1 <request_id>
# Si Windows bloquea el script:  powershell -ExecutionPolicy Bypass -File .\scripts\logs.ps1 <request_id>
param([Parameter(Mandatory = $true)][string]$RequestId)

$servicios = @("frontend", "gateway", "auth", "clients", "inventory", "orders", "payments", "graphql-gateway")
$lineas = docker compose logs --no-color --no-log-prefix @servicios 2>$null |
    Select-String -Pattern ('"request_id": ?"' + [regex]::Escape($RequestId) + '"') |
    ForEach-Object { $_.Line }

# El frontend (nginx) escribe su linea al terminar la respuesta; va primero porque es la entrada.
$lineas | Where-Object { $_ -match '"service":"frontend"' }

# El resto, por hora (campo ts) y, a igual hora, en el orden en que se escribieron.
$i = 0
$lineas | Where-Object { $_ -notmatch '"service":"frontend"' } |
    ForEach-Object { [pscustomobject]@{ ts = ($_ -split '"')[3]; n = $i++; linea = $_ } } |
    Sort-Object ts, n |
    ForEach-Object { $_.linea }
