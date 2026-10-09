param(
    [ValidateSet('preparar', 'backend', 'frontend', 'verificar')]
    [string]$Acao = 'verificar',
    [string]$Python = 'py',
    [string]$Node = 'node'
)

$ErrorActionPreference = 'Stop'
$raiz = $PSScriptRoot
$pythonVenv = Join-Path $raiz 'backend/.venv/Scripts/python.exe'

function Executar {
    param([string]$Programa, [string[]]$Argumentos)
    & $Programa @Argumentos
    if ($LASTEXITCODE -ne 0) { throw "Falha ao executar $Programa (codigo $LASTEXITCODE)." }
}

function VerificarNode {
    $versao = & $Node -p 'process.versions.node'
    if ($LASTEXITCODE -ne 0) { throw 'Node.js nao encontrado.' }
    $v = [version]$versao
    if (($v.Major -lt 20) -or ($v.Major -eq 20 -and $v.Minor -lt 19) -or
        ($v.Major -eq 21) -or ($v.Major -eq 22 -and $v.Minor -lt 12)) {
        throw "Node $versao incompativel com o Vite. Instale Node 22.12+ ou 24 LTS."
    }
    $nodeExe = (Get-Command $Node -ErrorAction Stop).Source
    $env:PATH = "$(Split-Path $nodeExe);$env:PATH"
}

function ExecutarNpm {
    param([string[]]$Argumentos)
    $npmPasta = Split-Path (Get-Command npm.cmd -ErrorAction Stop).Source
    $npmCli = Join-Path $npmPasta 'node_modules/npm/bin/npm-cli.js'
    if (!(Test-Path $npmCli)) { throw 'Instalacao do npm incompleta. Reinstale Node.js com npm.' }
    Executar $Node (@($npmCli) + $Argumentos)
}

Push-Location $raiz
try {
    switch ($Acao) {
        'preparar' {
            VerificarNode
            Executar $Python @('-c', 'import sys; assert sys.version_info >= (3,12), "Instale Python 3.12 ou superior"')
            if (!(Test-Path $pythonVenv)) {
                Executar $Python @('-m', 'venv', (Join-Path $raiz 'backend/.venv'))
            }
            Executar $pythonVenv @('-m', 'ensurepip', '--upgrade')
            Executar $pythonVenv @('-m', 'pip', 'install', '-r', 'backend/conf/requirements-lock.txt', '-r', 'backend/conf/requirements-dev.txt')
            if (!(Test-Path 'backend/.env')) {
                Copy-Item 'backend/.env.example' 'backend/.env'
            }
            Push-Location 'frontend'
            try {
                ExecutarNpm @('ci')
                if (!(Test-Path '.env')) { Copy-Item '.env.example' '.env' }
            } finally { Pop-Location }
            Write-Host 'Dependencias prontas. Configure backend/.env e o PostgreSQL conforme WINDOWS.md.'
        }
        'backend' {
            if (!(Test-Path $pythonVenv)) { throw 'Execute primeiro: .\windows.ps1 preparar' }
            Push-Location 'backend'
            try { Executar $pythonVenv @('-m', 'uvicorn', 'app.main:app', '--reload', '--host', '127.0.0.1', '--port', '8000') }
            finally { Pop-Location }
        }
        'frontend' {
            VerificarNode
            Push-Location 'frontend'
            try { ExecutarNpm @('run', 'dev', '--', '--host', 'localhost', '--port', '5173', '--strictPort') }
            finally { Pop-Location }
        }
        'verificar' {
            foreach ($url in @('http://127.0.0.1:8000/health', 'http://127.0.0.1:8000/health/db', 'http://localhost:5173')) {
                $resposta = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10
                Write-Host "$url : HTTP $($resposta.StatusCode)"
            }
        }
    }
} finally { Pop-Location }
