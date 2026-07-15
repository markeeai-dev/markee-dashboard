'use strict';
// MVP3 khởi động — Q13 (Secret Scan + PII Detection), module dùng chung (Gateway Adapter gọi
// cho traffic qua gateway; CLI/hook có thể gọi sau này cho file/context cục bộ — đúng bảng
// "nơi thực thi" ở Q13). Thuần regex, KHÔNG gọi AI/model ngoài nào — nhanh, không tốn chi phí,
// không thêm điểm phụ thuộc mạng vào đường xử lý request AI thật.
//
// Ghi rõ giới hạn thật, không hứa quá: đây là tập pattern ĐẠI DIỆN cho các loại rò rỉ phổ biến
// và nguy hiểm nhất (AWS key, GitHub token, private key, JWT, generic API key) — KHÔNG đầy đủ
// như gitleaks thật (~100+ pattern). Đủ để chặn phần lớn rủi ro rò rỉ thật của dev team, không
// phải giải pháp DLP toàn diện.

const SECRET_PATTERNS = [
  { type: 'aws_access_key', severity: 'high', re: /AKIA[0-9A-Z]{16}/g },
  { type: 'aws_secret_key', severity: 'high', re: /(?:aws_secret_access_key|secret_access_key)\s*[:=]\s*['"]?[A-Za-z0-9/+=]{40}['"]?/gi },
  { type: 'github_token', severity: 'high', re: /gh[pousr]_[A-Za-z0-9]{36,}/g },
  { type: 'private_key_block', severity: 'high', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g },
  { type: 'slack_token', severity: 'high', re: /xox[baprs]-[A-Za-z0-9-]{10,}/g },
  { type: 'jwt', severity: 'med', re: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  // Generic API key — cụm chữ "api_key"/"apikey"/"secret" đứng ngay trước 1 chuỗi dài random,
  // rủi ro báo nhầm cao hơn các pattern trên nên xếp severity thấp hơn (med, không phải high).
  { type: 'generic_api_key', severity: 'med', re: /(?:api[_-]?key|secret[_-]?key)\s*[:=]\s*['"]?[A-Za-z0-9_\-]{20,}['"]?/gi },
];

// CCCD Việt Nam: 12 số liền (không dùng \b vì số điện thoại/mã khác cũng có thể trùng độ dài —
// chấp nhận rủi ro báo nhầm ở mức PII, đúng tinh thần "cảnh báo không chặn" ở đợt này).
// Hộ chiếu VN: 1 chữ cái + 7 số.
const PII_PATTERNS = [
  { type: 'vn_national_id', severity: 'med', re: /\b\d{12}\b/g },
  { type: 'vn_passport', severity: 'med', re: /\b[A-Z]\d{7}\b/g },
];

// Số thẻ ngân hàng: PHẢI qua Luhn checksum, không chỉ đếm số chữ số — phát hiện thật khi test
// bằng traffic CLI thật (Bước 4d): pattern "13-19 số liền" thô báo nhầm hàng loạt vào timestamp
// (vd Unix ms 13 số) và ID khác vốn dĩ rất phổ biến trong payload JSON thật. Luhn loại gần hết
// các trường hợp báo nhầm này vì số ngẫu nhiên/tuần tự hiếm khi tình cờ qua được checksum.
function luhnValid(digits) {
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (shouldDouble) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

function scanForCardNumber(text) {
  const candidates = text.match(/\b(?:\d[ -]?){13,19}\b/g) || [];
  for (const c of candidates) {
    const digits = c.replace(/[ -]/g, '');
    if (digits.length >= 13 && digits.length <= 19 && luhnValid(digits)) {
      return [{ type: 'card_number', severity: 'med' }];
    }
  }
  return [];
}

function scan(text, patterns) {
  if (!text) return [];
  const found = [];
  for (const p of patterns) {
    p.re.lastIndex = 0;
    if (p.re.test(text)) found.push({ type: p.type, severity: p.severity });
  }
  return found;
}

function scanForSecrets(text) {
  return scan(text, SECRET_PATTERNS);
}

function scanForPii(text) {
  if (!text) return [];
  return [...scan(text, PII_PATTERNS), ...scanForCardNumber(text)];
}

module.exports = { scanForSecrets, scanForPii };
