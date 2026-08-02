#!/usr/bin/env bash
# Center AI — cài đặt cho máy nhân viên (Linux / macOS / VPS / Git Bash)
#
# Vá gap thật phát hiện lúc chuẩn bị pilot: `company-ai` để `private: true`, chưa publish npm —
# máy khác (VPS/laptop nhân viên) trước đây phải mò từng bước. Script này gom đúng các bước đó
# lại, kiểm tra điều kiện trước khi cài.
#
# Chạy:  bash install.sh

set -euo pipefail

echo ""
echo "=== Center AI — cai dat CLI cho nhan vien ==="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- 1. Node.js (bat buoc, khong tu cai ho — cai Node am tham la viec lon, de nguoi dung tu quyet)
if ! command -v node >/dev/null 2>&1; then
  echo "[X] Chua co Node.js."
  echo "    Cai ban LTS tai https://nodejs.org roi chay lai script nay."
  exit 1
fi
NODE_VERSION="$(node --version)"
NODE_MAJOR="$(echo "${NODE_VERSION#v}" | cut -d. -f1)"
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "[X] Node.js $NODE_VERSION qua cu (can >= 18)."
  echo "    Nang cap tai https://nodejs.org roi chay lai."
  exit 1
fi
echo "[OK] Node.js $NODE_VERSION"

# --- 2. Claude Code CLI that (company-ai chi la wrapper mo `claude` goc, khong thay the)
if command -v claude >/dev/null 2>&1; then
  echo "[OK] Claude Code CLI da co san"
else
  echo "[..] Dang cai Claude Code CLI (npm install -g @anthropic-ai/claude-code)..."
  npm install -g @anthropic-ai/claude-code
  echo "[OK] Da cai Claude Code CLI"
fi

# --- 3. company-ai (tu thu muc nay)
echo "[..] Dang cai phu thuoc cua company-ai..."
cd "$SCRIPT_DIR"
npm install

echo "[..] Dang cai lenh 'company-ai' toan may..."
npm install -g .

# --- 4. Xac nhan that su chay duoc (khong tin buoc cai la xong)
if ! command -v company-ai >/dev/null 2>&1; then
  echo ""
  echo "[X] Cai xong nhung lenh 'company-ai' chua co trong PATH."
  echo "    Thuong do thu muc npm global chua nam trong PATH. Kiem tra:"
  echo "      npm config get prefix"
  echo "    roi them <prefix>/bin vao PATH, mo lai terminal."
  exit 1
fi
echo "[OK] Lenh 'company-ai' da san sang"

cat <<'EOF'

=== Cai dat xong. 3 buoc tiep theo ===

  1. Dang nhap (chi 1 lan, can email cong ty + access code duoc cap rieng):
       company-ai login

  2. Vao thu muc repo du an, gan repo voi project (1 lan/repo):
       cd <thu-muc-repo>
       company-ai init

  3. Bat dau lam viec:
       company-ai claude

  Xem tien do/chi phi tren dashboard: https://ops.valeron.tech

EOF
