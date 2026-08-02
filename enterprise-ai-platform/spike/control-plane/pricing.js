'use strict';
// Bảng giá tĩnh, ƯỚC LƯỢNG — KHÔNG phải billing chuẩn (mục 15: đủ cho "cost_per_task thô"
// ở MVP2, cost_per_accepted_outcome chuẩn là Q22/MVP3). Đơn vị: USD / 1 triệu token.
// Giá tham khảo công khai của Anthropic tại thời điểm viết — cần cập nhật tay nếu đổi giá,
// không có API tự động lấy giá (9Router không cung cấp).
const PRICING_PER_MILLION_USD = {
  'claude-opus-4-8': { input: 15, output: 75 },
  'claude-opus-4-7': { input: 15, output: 75 },
  'claude-sonnet-5': { input: 3, output: 15 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4 },
  'claude-fable-5': { input: 3, output: 15 },
};

// model từ 9Router có dạng "cc/claude-sonnet-5" hoặc response trả về "claude-sonnet-5" —
// bỏ tiền tố "cc/" nếu có trước khi tra bảng giá.
function estimateCostUsd(model, inputTokens, outputTokens) {
  if (!model || (!inputTokens && !outputTokens)) return null;
  const key = model.startsWith('cc/') ? model.slice(3) : model;
  const price = PRICING_PER_MILLION_USD[key];
  if (!price) return null;
  const cost = ((inputTokens || 0) * price.input + (outputTokens || 0) * price.output) / 1_000_000;
  return Math.round(cost * 1e6) / 1e6;
}

module.exports = { estimateCostUsd, PRICING_PER_MILLION_USD };
