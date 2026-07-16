# Center AI — cài đặt cho máy nhân viên (Windows / PowerShell)
#
# Vá gap thật phát hiện lúc chuẩn bị pilot: `company-ai` để `private: true`, chưa publish npm —
# máy này chạy được chỉ vì đã `npm link` thủ công. Máy khác (VPS/laptop nhân viên) trước đây
# phải mò từng bước. Script này gom đúng các bước đó lại, kiểm tra điều kiện trước khi cài.
#
# Chạy:  powershell -ExecutionPolicy Bypass -File install.ps1

$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "=== Center AI — cai dat CLI cho nhan vien ===" -ForegroundColor Cyan
Write-Host ""

# --- 1. Node.js (bat buoc, khong tu cai ho — cai Node am tham la viec lon, phai de nguoi dung tu quyet)
try {
    $nodeVersion = (node --version) 2>$null
} catch {
    Write-Host "[X] Chua co Node.js." -ForegroundColor Red
    Write-Host "    Cai ban LTS tai https://nodejs.org roi chay lai script nay."
    exit 1
}
$major = [int](($nodeVersion -replace '^v','') -split '\.')[0]
if ($major -lt 18) {
    Write-Host "[X] Node.js $nodeVersion qua cu (can >= 18)." -ForegroundColor Red
    Write-Host "    Nang cap tai https://nodejs.org roi chay lai."
    exit 1
}
Write-Host "[OK] Node.js $nodeVersion" -ForegroundColor Green

# --- 2. Claude Code CLI that (company-ai chi la wrapper mo `claude` goc, khong thay the)
$claudeOk = $false
try { if (Get-Command claude -ErrorAction SilentlyContinue) { $claudeOk = $true } } catch {}
if ($claudeOk) {
    Write-Host "[OK] Claude Code CLI da co san" -ForegroundColor Green
} else {
    Write-Host "[..] Dang cai Claude Code CLI (npm install -g @anthropic-ai/claude-code)..."
    npm install -g @anthropic-ai/claude-code
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[X] Cai Claude Code CLI that bai." -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Da cai Claude Code CLI" -ForegroundColor Green
}

# --- 3. company-ai (tu thu muc nay)
Write-Host "[..] Dang cai phu thuoc cua company-ai..."
Push-Location $PSScriptRoot
try {
    npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install that bai" }

    Write-Host "[..] Dang cai lenh `company-ai` toan may..."
    npm install -g .
    if ($LASTEXITCODE -ne 0) { throw "npm install -g . that bai" }
} finally {
    Pop-Location
}

# --- 4. Xac nhan that su chay duoc (khong tin buoc cai la xong)
if (-not (Get-Command company-ai -ErrorAction SilentlyContinue)) {
    Write-Host ""
    Write-Host "[X] Cai xong nhung lenh 'company-ai' chua co trong PATH." -ForegroundColor Red
    Write-Host "    Thuong do thu muc npm global chua nam trong PATH. Kiem tra:"
    Write-Host "      npm config get prefix"
    Write-Host "    roi them duong dan do vao PATH, mo lai terminal."
    exit 1
}
Write-Host "[OK] Lenh 'company-ai' da san sang" -ForegroundColor Green

Write-Host ""
Write-Host "=== Cai dat xong. 3 buoc tiep theo ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. Dang nhap (chi 1 lan, can email cong ty + access code duoc cap rieng):"
Write-Host "       company-ai login" -ForegroundColor Yellow
Write-Host ""
Write-Host "  2. Vao thu muc repo du an, gan repo voi project (1 lan/repo):"
Write-Host "       cd <thu-muc-repo>"
Write-Host "       company-ai init" -ForegroundColor Yellow
Write-Host ""
Write-Host "  3. Bat dau lam viec:"
Write-Host "       company-ai claude" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Xem tien do/chi phi tren dashboard: https://ops.valeron.tech"
Write-Host ""
