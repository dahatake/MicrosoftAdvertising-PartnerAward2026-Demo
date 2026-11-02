<#
.SYNOPSIS
  Campaign Flow をデモ用に Azure Container Apps へデプロイします（Entra ID の組み込み認証つき）。
.DESCRIPTION
  1) サインイン確認  2) Entra アプリ登録（単一テナント）  3) azd up（Bicep: ACR / Container Apps / Log Analytics / 予算アラート）
  4) リダイレクト URI の登録  5) /healthz と未認証アクセスの確認
  再実行しても安全です（既存のアプリ登録・環境を再利用）。
.EXAMPLE
  ./infra/deploy.ps1 -SubscriptionId 0e930937-43f5-484d-ba9e-1dd1151cf7ba -TenantId 16b3c013-d300-468d-ac64-7eda0820b6d3 -ContactEmail you@example.com
#>
param(
  [Parameter(Mandatory)] [string] $SubscriptionId,
  [Parameter(Mandatory)] [string] $TenantId,
  [Parameter(Mandatory)] [string] $ContactEmail,
  [string] $EnvName = 'campaignflow',
  [string[]] $Locations = @('japaneast', 'japanwest', 'eastasia', 'southeastasia'),
  [int] $MonthlyBudget = 100000
)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

function Step($m) { Write-Host "`n== $m" -ForegroundColor Cyan }

Step 'サインイン'
az account show --query id -o tsv 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { az login --tenant $TenantId | Out-Null }
az account set --subscription $SubscriptionId
azd auth login --tenant-id $TenantId --check-status 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { azd auth login --tenant-id $TenantId }

Step 'Entra アプリ登録（単一テナント）'
$name = "campaign-flow-$EnvName"
$appId = az ad app list --display-name $name --query '[0].appId' -o tsv
if (-not $appId) { $appId = az ad app create --display-name $name --sign-in-audience AzureADMyOrg --query appId -o tsv }
$secret = az ad app credential reset --id $appId --display-name azd --years 1 --query password -o tsv

Step 'azd 環境'
azd env new $EnvName --subscription $SubscriptionId 2>$null
azd env select $EnvName
azd env set AZURE_SUBSCRIPTION_ID $SubscriptionId
azd env set AZURE_TENANT_ID $TenantId
azd env set AUTH_CLIENT_ID $appId
azd env set AUTH_CLIENT_SECRET $secret
azd env set BUDGET_CONTACT_EMAIL $ContactEmail

Step "デプロイ（最初に使えるリージョンを採用: $($Locations -join ', ')）"
$ok = $false
foreach ($loc in $Locations) {
  azd env set AZURE_LOCATION $loc
  Write-Host "リージョン: $loc"
  azd up --no-prompt
  if ($LASTEXITCODE -eq 0) { $ok = $true; break }
  Write-Warning "$loc では失敗しました。次のリージョンを試します。"
}
if (-not $ok) { throw 'どのリージョンでもデプロイできませんでした。' }

Step 'リダイレクト URI の登録'
$redirect = azd env get-value SERVICE_WEB_REDIRECT_URI
az ad app update --id $appId --web-redirect-uris $redirect

Step '疎通確認'
$uri = azd env get-value SERVICE_WEB_URI
"URL: $uri"
"healthz: " + (Invoke-RestMethod "$uri/healthz" | ConvertTo-Json -Compress)
$r = Invoke-WebRequest "$uri/api/users" -MaximumRedirection 0 -SkipHttpErrorCheck
"未認証の /api/users → HTTP $($r.StatusCode)（302/401 なら認証が効いています）"
Write-Host "`n完了: $uri （月額予算 $MonthlyBudget、アラート送信先 $ContactEmail）" -ForegroundColor Green
