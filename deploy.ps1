<#
.SYNOPSIS
Script de deploy para o InAdmav (Google Cloud Run e Firebase Hosting).
.DESCRIPTION
Este script faz o deploy do backend (FastAPI/Python) no Google Cloud Run e do frontend (Next.js) no Firebase Hosting.

Pré-requisitos:
1. Google Cloud CLI instalado (gcloud)
2. Firebase CLI instalado (firebase-tools)
3. Estar autenticado (rode: gcloud auth login e firebase login)
#>

$ErrorActionPreference = "Stop"
$PROJECT_ID = "inadmav"
$REGION = "us-central1"

Write-Host "Iniciando processo de deploy para o projeto: $PROJECT_ID" -ForegroundColor Cyan

# Define o projeto atual no gcloud
Write-Host "Configurando projeto no gcloud..."
gcloud config set project $PROJECT_ID

# 1. Deploy do Backend (Cloud Run)
Write-Host "========================================="
Write-Host "Iniciando deploy do Backend no Cloud Run..." -ForegroundColor Yellow
Write-Host "========================================="
Push-Location backend
try {
    # Usando gcloud run deploy com source build
    gcloud run deploy inadmav-backend --source . --region $REGION --allow-unauthenticated --project $PROJECT_ID
    Write-Host "Deploy do backend concluído!" -ForegroundColor Green
} finally {
    Pop-Location
}

# 2. Deploy do Frontend (Firebase Hosting)
Write-Host "========================================="
Write-Host "Iniciando deploy do Frontend no Firebase Hosting..." -ForegroundColor Yellow
Write-Host "========================================="
# Deploy pelo firebase CLI utilizando Web Frameworks (Next.js)
firebase deploy --only hosting --project $PROJECT_ID
Write-Host "Deploy do frontend concluído!" -ForegroundColor Green

Write-Host "========================================="
Write-Host "Deploy finalizado com sucesso! 🚀" -ForegroundColor Green
Write-Host "Se esta é a primeira vez, certifique-se de pegar a URL do backend gerada e adicionar em suas variáveis de ambiente do Frontend."
Write-Host "========================================="
