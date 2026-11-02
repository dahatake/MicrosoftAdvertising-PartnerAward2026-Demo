<#
.SYNOPSIS
  Campaign Flow をデモ用に Azure Container Apps へデプロイします（認証なし・架空データのみ）。
.DESCRIPTION
  azd up（Bicep: ACR / Container Apps / Log Analytics / 予算アラート）を実行し、/healthz とトップページの疎通を確認します。
  再実行しても安全です（既存の環境を再利用）。
  注意：認証機能はありません。URL を知っていれば誰でもアクセスでき、「ロール選択」は認証ではありません。架空データ専用です。
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
function Check($what) { if ($LASTEXITCODE -ne 0) { throw "失敗しました: $what" } }

Step 'サインイン'
az account show --query id -o tsv 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { az login --tenant $TenantId | Out-Null }
az account set --subscription $SubscriptionId; Check 'az account set'
azd auth login --tenant-id $TenantId --check-status 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { azd auth login --tenant-id $TenantId; Check 'azd auth login' }

Step 'azd 環境'
$exists = (azd env list 2>$null | Select-String -SimpleMatch $EnvName -Quiet)
if (-not $exists) { azd env new $EnvName --subscription $SubscriptionId; Check 'azd env new' }
azd env select $EnvName; Check 'azd env select'
azd env set AZURE_SUBSCRIPTION_ID $SubscriptionId
azd env set AZURE_TENANT_ID $TenantId
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

Step '以前のデプロイで有効だった組み込み認証の後始末（差分デプロイでは自動削除されないため）'
$app = az containerapp list -g "rg-$EnvName" --query "[0].name" -o tsv
if ($app) { az containerapp auth update -g "rg-$EnvName" -n $app --enabled false -o none 2>$null }

Step '疎通確認'
$uri = azd env get-value SERVICE_WEB_URI
"URL: $uri"
"healthz: " + (Invoke-RestMethod "$uri/healthz" | ConvertTo-Json -Compress)
"トップページ: HTTP " + (Invoke-WebRequest "$uri/" -SkipHttpErrorCheck).StatusCode
Write-Host "`n完了: $uri （認証なし。月額予算 $MonthlyBudget、アラート送信先 $ContactEmail）" -ForegroundColor Green