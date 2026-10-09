<#
.SYNOPSIS
    Deploy do inAdmav no Cloud Run (backend + frontend).

.DESCRIPTION
    Resolve sozinho o no que o README deixa manual: o backend precisa da URL
    do frontend para o CORS, e o frontend precisa da URL do backend para a
    API - nenhuma das duas existe antes do primeiro deploy. O script quebra
    isso em tres passadas e le as URLs de volta do Cloud Run em vez de
    adivinhar o formato.

    O build acontece no Cloud Build, nao nesta maquina: `--source` manda um
    tarball do diretorio (filtrado pelo .gcloudignore) e o container e
    montado no Google. Nao precisa de Docker local.

.EXAMPLE
    .\infra\deploy.ps1 -Verificar      # so checa pre-requisitos
    .\infra\deploy.ps1                 # deploy completo
    .\infra\deploy.ps1 -SomenteBackend
#>
[CmdletBinding()]
param(
    [string]$ArquivoConfig = "",
    [switch]$SomenteBackend,
    [switch]$SomenteFrontend,
    [switch]$PularApis,
    [switch]$Verificar
)

$ErrorActionPreference = "Stop"

# $PSScriptRoot chega vazio dentro do bloco param() no PowerShell 5.1, entao
# a pasta do script so pode ser resolvida aqui no corpo. O fallback cobre o
# caso de o script ser executado por caminho relativo.
$aqui = $PSScriptRoot
if (-not $aqui) { $aqui = Split-Path -Parent $MyInvocation.MyCommand.Definition }
$raiz = Split-Path $aqui -Parent
if ($ArquivoConfig -eq "") { $ArquivoConfig = Join-Path $aqui "deploy.env" }

function Passo { param($m) Write-Host "`n==> $m" -ForegroundColor Cyan }
function Ok    { param($m) Write-Host "    OK  $m" -ForegroundColor Green }
function Aviso { param($m) Write-Host "    !   $m" -ForegroundColor Yellow }
function Falha { param($m) Write-Host "`n    X   $m`n" -ForegroundColor Red; exit 1 }

# --- Configuracao ---------------------------------------------------------

function Ler-Env {
    param([string]$Caminho)
    $mapa = @{}
    if (-not (Test-Path $Caminho)) { return $mapa }
    foreach ($linha in Get-Content $Caminho) {
        $t = $linha.Trim()
        if ($t -eq "" -or $t.StartsWith("#")) { continue }
        $i = $t.IndexOf("=")
        if ($i -lt 1) { continue }
        $mapa[$t.Substring(0, $i).Trim()] = $t.Substring($i + 1).Trim().Trim('"')
    }
    return $mapa
}

Passo "Lendo configuracao"
if (-not (Test-Path $ArquivoConfig)) {
    Falha "Falta $ArquivoConfig. Copie de infra\deploy.env.example e preencha."
}
$cfg = Ler-Env $ArquivoConfig
$envLocal = Ler-Env (Join-Path $raiz "frontend\.env.local")

# Ordem de precedencia: deploy.env vence, frontend\.env.local completa. As
# NEXT_PUBLIC_FIREBASE_* ja vivem la e sao as mesmas em local e producao,
# entao duplicar seria so mais um lugar para desatualizar.
function Valor {
    param([string]$Chave, [string]$Padrao = "")
    if ($cfg.ContainsKey($Chave) -and $cfg[$Chave] -ne "") { return $cfg[$Chave] }
    if ($envLocal.ContainsKey($Chave) -and $envLocal[$Chave] -ne "") { return $envLocal[$Chave] }
    return $Padrao
}

$projeto    = Valor "PROJETO"
$regiao     = Valor "REGIAO" "southamerica-east1"
$conta      = Valor "CONTA"
# Teto de instancias do Cloud Run. O padrao do Cloud Run e 100; para uma
# igreja isso e ordens de grandeza a mais do que o necessario e vira teto
# de gasto se o formulario publico for abusado. Vazio = deixa o padrao.
$maxInst    = Valor "MAX_INSTANCIAS" "5"
$servicoApi = Valor "SERVICO_API" "inadmav-api"
$servicoWeb = Valor "SERVICO_WEB" "inadmav-web"
$admins     = Valor "BOOTSTRAP_ADMIN_EMAILS"

if ($projeto -eq "") { Falha "PROJETO nao definido em $ArquivoConfig" }
if ($admins -eq "")  { Aviso "BOOTSTRAP_ADMIN_EMAILS vazio: ninguem vira admin no primeiro login." }
Ok "projeto=$projeto  regiao=$regiao"

# --- gcloud ---------------------------------------------------------------

Passo "Localizando o gcloud"
$sdk = Join-Path $env:LOCALAPPDATA "Google\Cloud SDK\google-cloud-sdk"
$gcloud = Join-Path $sdk "bin\gcloud.cmd"
if (-not (Test-Path $gcloud)) {
    $cmd = Get-Command gcloud -ErrorAction SilentlyContinue
    if (-not $cmd) { Falha "gcloud nao encontrado. Instale o Google Cloud CLI." }
    $gcloud = $cmd.Source
}

# O alias "python.exe" da Microsoft Store sequestra a chamada e o gcloud
# morre com "Python nao foi encontrado". Apontar para o Python embutido do
# proprio SDK contorna sem depender de mexer nas configuracoes do Windows.
$bundled = Join-Path $sdk "platform\bundledpython\python.exe"
if (Test-Path $bundled) { $env:CLOUDSDK_PYTHON = $bundled }
Ok $gcloud

# Roda o gcloud e aborta com a saida visivel se falhar.
function Gcloud {
    # Alguns comandos do gcloud escrevem o progresso da operação em stderr
    # mesmo retornando código zero. Com ErrorActionPreference=Stop, redirecionar
    # stderr diretamente faria o PowerShell encerrar um deploy bem-sucedido.
    $modoErroAnterior = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $saida = & $gcloud @args 2>&1
        $codigoSaida = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $modoErroAnterior
    }
    if ($codigoSaida -ne 0) {
        Write-Host (($saida | Out-String)) -ForegroundColor DarkGray
        Falha "gcloud $($args -join ' ')  (exit $codigoSaida)"
    }
    return (($saida | Out-String).Trim())
}

# --- Autenticacao ---------------------------------------------------------

Passo "Conferindo a conta do gcloud"
$contas = @(& $gcloud auth list --format="value(account)" 2>$null | Where-Object { $_ -and $_.Trim() -ne "" })
if ($contas.Count -eq 0) {
    Falha "Nenhuma conta no gcloud. Rode:  gcloud auth login $conta"
}
if ($conta -ne "" -and ($contas -notcontains $conta)) {
    Write-Host "    contas disponiveis: $($contas -join ', ')" -ForegroundColor DarkGray
    Falha "A conta $conta nao esta autenticada. Rode:  gcloud auth login $conta"
}
if ($conta -eq "") { $conta = $contas[0].Trim() }
$contaArg = "--account=$conta"
Ok $conta

Passo "Conferindo acesso ao projeto $projeto"
$numero = & $gcloud projects describe $projeto $contaArg --format="value(projectNumber)" 2>$null
if ($LASTEXITCODE -ne 0 -or -not $numero) {
    Falha "A conta $conta nao enxerga o projeto '$projeto'. Confirme o id e as permissoes (precisa de Editor ou superior)."
}
$numero = ($numero | Out-String).Trim()
Ok "numero do projeto: $numero"

Passo "Conferindo o faturamento do projeto"
# Cloud Run, Cloud Build e Artifact Registry nao ligam em projeto sem conta
# de faturamento. Sem esta checagem o deploy morre mais na frente, no
# `services enable`, com uma mensagem que fala de "API desativada" e nao diz
# a causa real.
$faturamento = & $gcloud billing projects describe $projeto $contaArg --format="value(billingEnabled)" 2>$null
if ($LASTEXITCODE -ne 0) {
    Aviso "Nao deu para conferir o faturamento (API cloudbilling desligada ou sem permissao). Seguindo."
} elseif (($faturamento | Out-String).Trim() -ne "True") {
    Write-Host "    Vincule uma conta em:" -ForegroundColor DarkGray
    Write-Host "    https://console.cloud.google.com/billing/linkedaccount?project=$projeto" -ForegroundColor DarkGray
    Falha "O projeto '$projeto' esta sem conta de faturamento. Cloud Run, Cloud Build e Artifact Registry exigem o plano Blaze."
} else {
    Ok "faturamento ativo"
}

if ($Verificar) {
    Write-Host "`nPre-requisitos OK. Rode sem -Verificar para publicar.`n" -ForegroundColor Green
    exit 0
}

# --- APIs -----------------------------------------------------------------

if (-not $PularApis) {
    Passo "Habilitando as APIs necessarias"
    # identitytoolkit entra porque o backend chama verify_id_token com
    # check_revoked=True - isso le o registro do usuario no Firebase Auth,
    # e sem a API ligada a primeira requisicao autenticada falha com 403.
    $apis = @(
        "run.googleapis.com",
        "cloudbuild.googleapis.com",
        "artifactregistry.googleapis.com",
        "firestore.googleapis.com",
        "identitytoolkit.googleapis.com"
    )
    Gcloud services enable @apis --project=$projeto $contaArg | Out-Null
    Ok "$($apis.Count) APIs ativas"
}

# --- IAM ------------------------------------------------------------------

Passo "Papeis da service account do Cloud Run"
$sa = "$numero-compute@developer.gserviceaccount.com"
foreach ($papel in @("roles/datastore.user", "roles/firebaseauth.viewer")) {
    # O gcloud usa stderr também para "Updated IAM policy" com exit code 0.
    # Não redirecione isso para o pipeline sob ErrorActionPreference=Stop.
    $modoErroAnterior = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & $gcloud projects add-iam-policy-binding $projeto `
            --member="serviceAccount:$sa" --role=$papel $contaArg --condition=None 2>$null | Out-Null
        $codigoSaida = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $modoErroAnterior
    }
    if ($codigoSaida -eq 0) { Ok $papel } else { Aviso "$papel nao aplicado (talvez ja exista)" }
}

$argsMax = @()
if ($maxInst -ne "") { $argsMax = @("--max-instances=$maxInst") }

# --- 1a passada: backend --------------------------------------------------

$urlApi = ""
if (-not $SomenteFrontend) {
    Passo "Deploy do backend ($servicoApi)"

    # CORS provisorio: a URL real do front so existe depois da 2a passada.
    # O formato previsivel do Cloud Run serve de chute inicial; a 3a passada
    # corrige com o valor lido de verdade.
    $corsProv = "https://$servicoWeb-$numero.$regiao.run.app"

    # O projeto usa um único administrador inicial; vírgula é o formato
    # nativo que o gcloud aceita de forma consistente no PowerShell.
    $envApi = @(
        "ENV=prod",
        "GCP_PROJECT_ID=$projeto",
        "CORS_ORIGINS=$corsProv",
        "BOOTSTRAP_ADMIN_EMAILS=$admins",
        "CADASTRO_PUBLICO_ATIVO=$(Valor 'CADASTRO_PUBLICO_ATIVO' 'true')",
        "CADASTRO_PUBLICO_RATE_LIMIT=$(Valor 'CADASTRO_PUBLICO_RATE_LIMIT' '20')"
    ) -join ","

    $fonteApi = Join-Path $raiz "backend"
    Gcloud run deploy $servicoApi `
        "--source=$fonteApi" `
        --region=$regiao --project=$projeto $contaArg `
        --allow-unauthenticated --port=8080 @argsMax `
        --set-env-vars=$envApi --quiet | Out-Null

    $urlApi = Gcloud run services describe $servicoApi --region=$regiao --project=$projeto $contaArg --format="value(status.url)"
    Ok $urlApi
}

# --- 2a passada: frontend -------------------------------------------------

$urlWeb = ""
if (-not $SomenteBackend) {
    if ($urlApi -eq "") {
        $urlApi = & $gcloud run services describe $servicoApi --region=$regiao --project=$projeto $contaArg --format="value(status.url)" 2>$null
        if ($LASTEXITCODE -ne 0 -or -not $urlApi) {
            Falha "O backend ainda nao existe. Rode uma vez sem -SomenteFrontend."
        }
        $urlApi = ($urlApi | Out-String).Trim()
    }

    Passo "Deploy do frontend ($servicoWeb)"
    # As NEXT_PUBLIC_* sao embutidas no bundle durante o build, nao lidas em
    # runtime. Por isso --set-build-env-vars: passar como env do servico nao
    # teria efeito nenhum no JavaScript que chega ao navegador.
    $buildEnv = @("NEXT_PUBLIC_API_URL=$urlApi")
    foreach ($k in @(
        "NEXT_PUBLIC_FIREBASE_API_KEY",
        "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
        "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
        "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
        "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
        "NEXT_PUBLIC_FIREBASE_APP_ID")) {
        $v = Valor $k
        if ($v -eq "") { Aviso "$k vazio - o login vai quebrar" } else { $buildEnv += "$k=$v" }
    }
    $buildEnv = $buildEnv -join ","

    $fonteWeb = Join-Path $raiz "frontend"
    Gcloud run deploy $servicoWeb `
        "--source=$fonteWeb" `
        --region=$regiao --project=$projeto $contaArg `
        --allow-unauthenticated --port=8080 @argsMax `
        --set-build-env-vars=$buildEnv --quiet | Out-Null

    $urlWeb = Gcloud run services describe $servicoWeb --region=$regiao --project=$projeto $contaArg --format="value(status.url)"
    Ok $urlWeb
}

# --- 3a passada: CORS real ------------------------------------------------

if ($urlApi -ne "" -and $urlWeb -ne "") {
    Passo "Fechando o CORS do backend na URL real do frontend"
    Gcloud run services update $servicoApi `
        --region=$regiao --project=$projeto $contaArg `
        --update-env-vars="CORS_ORIGINS=$urlWeb" --quiet | Out-Null
    Ok $urlWeb
}

# --- Resumo ---------------------------------------------------------------

Write-Host ""
Write-Host ("-" * 62)
Write-Host "Deploy completo." -ForegroundColor Green
if ($urlApi -ne "") { Write-Host "  API :  $urlApi" }
if ($urlWeb -ne "") { Write-Host "  Site:  $urlWeb" }
Write-Host ("-" * 62)

if ($urlWeb -ne "") {
    $host_web = ([Uri]$urlWeb).Host
    Write-Host @"

Falta fazer uma vez, no console do Firebase (projeto $projeto):
  1. Authentication > Sign-in method > E-mail/senha: ativar
  2. Authentication > Settings > Authorized domains: adicionar
     $host_web
  3. Entrar em $urlWeb/entrar com um e-mail de BOOTSTRAP_ADMIN_EMAILS

"@ -ForegroundColor DarkGray
}
