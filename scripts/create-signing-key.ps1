# Cria a chave própria de assinatura do Aldus, fora do Git (pedido do dono em 19/11/2026: "Pode preparar").
# Rode no seu PowerShell:  powershell -ExecutionPolicy Bypass -File scripts\create-signing-key.ps1
# A senha é digitada aqui: não aparece na tela, não vai em argumento de comando e não é gravada em texto aberto.
# Uma chave existente nunca é substituída: quem troca a chave perde a capacidade de atualizar o app instalado.
param(
  [string]$Directory = (Join-Path $env:USERPROFILE '.aldus-signing'),
  [securestring]$Password
)
$ErrorActionPreference = 'Stop'
$keystore = Join-Path $Directory 'aldus-release.p12'
$secret = Join-Path $Directory 'password.dpapi'
$alias = 'aldus'

if (Test-Path -LiteralPath $keystore) { throw "Já existe uma chave em $keystore. Nada foi alterado." }
$keytool = Join-Path $env:ProgramFiles 'Java\jdk-17\bin\keytool.exe'
if ($env:JAVA_HOME -and (Test-Path -LiteralPath (Join-Path $env:JAVA_HOME 'bin\keytool.exe'))) { $keytool = Join-Path $env:JAVA_HOME 'bin\keytool.exe' }
if (-not (Test-Path -LiteralPath $keytool)) { throw 'keytool do JDK 17 não encontrado. Nada foi criado.' }

function ConvertTo-PlainText([securestring]$value) {
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($value)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

$confirm = $null
if (-not $Password) {
  $Password = Read-Host 'Senha da chave (12 caracteres ou mais; guarde no seu gerenciador de senhas)' -AsSecureString
  $confirm = Read-Host 'Repita a senha' -AsSecureString
}
$plain = ConvertTo-PlainText $Password
if ($confirm -and $plain -ne (ConvertTo-PlainText $confirm)) { throw 'As senhas não conferem. Nada foi criado.' }
if ($plain.Length -lt 12) { throw 'Use 12 caracteres ou mais. Nada foi criado.' }

New-Item -ItemType Directory -Force -Path $Directory | Out-Null
$env:ALDUS_NEW_KEY_PASSWORD = $plain
try {
  # O certificado é público (vai dentro de todo APK): leva o nome do app, não dados pessoais.
  & $keytool -genkeypair -storetype PKCS12 -keystore $keystore -alias $alias -keyalg RSA -keysize 4096 -validity 10000 `
    -dname 'CN=Aldus Reader, C=BR' -storepass:env ALDUS_NEW_KEY_PASSWORD -keypass:env ALDUS_NEW_KEY_PASSWORD
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $keystore)) { throw 'O keytool não criou a chave.' }
  # Só esta conta do Windows consegue abrir este arquivo (DPAPI). É o que deixa o build rodar sem você digitar a senha.
  ConvertFrom-SecureString -SecureString $Password | Set-Content -Encoding ascii -LiteralPath $secret
  $listing = & $keytool -list -v -keystore $keystore -alias $alias -storepass:env ALDUS_NEW_KEY_PASSWORD
  $fingerprint = (($listing | Select-String -Pattern 'SHA256:' | Select-Object -First 1).Line -replace '^\s*SHA256:\s*', '').Trim()
} finally {
  Remove-Item Env:ALDUS_NEW_KEY_PASSWORD -ErrorAction SilentlyContinue
  $plain = $null
}

Write-Host ''
Write-Host "Chave criada: $keystore"
Write-Host "Impressão digital do certificado (SHA-256): $fingerprint"
Write-Host 'Falta você: (1) guardar a senha no gerenciador de senhas; (2) copiar o arquivo .p12 para dois lugares fora deste PC.'
Write-Host "O arquivo $secret só abre nesta conta do Windows: ele não é cópia de segurança da senha."
