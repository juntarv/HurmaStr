# Відкриває порт 3000 у брандмауері Windows, щоб колеги в тій самій мережі
# могли зайти на HurmaStr. Запустіть ОДИН РАЗ від імені адміністратора:
#   ПКМ по файлу → "Запустити за допомогою PowerShell"  (або в адмін-консолі: .\open-firewall.ps1)

$rule = Get-NetFirewallRule -DisplayName "HurmaStr 3000" -ErrorAction SilentlyContinue
if ($rule) {
  Write-Host "Правило вже існує — нічого робити не треба." -ForegroundColor Green
} else {
  New-NetFirewallRule -DisplayName "HurmaStr 3000" -Direction Inbound -Action Allow `
    -Protocol TCP -LocalPort 3000 -Profile Private, Domain | Out-Null
  Write-Host "Готово: порт 3000 відкрито для локальної мережі." -ForegroundColor Green
}
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like '192.168.*' -or $_.IPAddress -like '10.*' } | Select-Object -First 1).IPAddress
Write-Host "Адреса для колег:  http://${ip}:3000"
Read-Host "Натисніть Enter, щоб закрити"
