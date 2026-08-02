'use strict';
// Test harness cho Gateway Feasibility Spike (MVP0-SPIKE.md).
// Kiểm Nhóm A (cô lập seat) đầy đủ + phần Nhóm B mock được (streaming qua Adapter).
// KHÔNG kiểm được: OAuth refresh thật, tool-use thật, prompt caching thật —
// những cái đó cần 9Router thật + Claude Team account thật (ghi rõ ở cuối).
//
// Chạy sau khi đã bật: mock-router (Thanh :20128, Hoàng :20129) + adapter (:8080)
//   node run-test.js

const http = require('http');
const fs = require('fs');
const path = require('path');

const ADAPTER_HOST = 'localhost';
const ADAPTER_PORT = 8080;
const REGISTRY_PATH = path.join(__dirname, '..', 'gateway-adapter', 'registry.json');
const TOKENS_PATH = path.join(__dirname, '..', 'scripts', 'tokens.json');

const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'));

const results = []; // { name, pass, detail }
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
}

function request(token, body, { stream = false } = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      { hostname: ADAPTER_HOST, port: ADAPTER_PORT, path: '/v1/messages', method: 'POST', headers },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          resolve({ status: res.statusCode, text });
        });
      }
    );
    req.on('error', reject);
    req.end(payload);
  });
}

function parseSSE(text) {
  return text
    .split('\n\n')
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => b.replace(/^data: /, ''));
}

async function main() {
  console.log('=== Nhóm A — cô lập seat ===\n');

  // 1) Thanh luôn đi đúng seat_claude_thanh, chạy nhiều request liên tiếp
  {
    let allCorrect = true;
    for (let i = 0; i < 10; i++) {
      const r = await request(tokens.thanh, { model: 'claude-sonnet' });
      const json = JSON.parse(r.text);
      if (json.seat !== 'seat_claude_thanh') allCorrect = false;
    }
    record('Thanh luôn đi đúng instance router-thanh (10 request liên tiếp)', allCorrect);
  }

  // 2) Hoàng luôn đi đúng seat_claude_hoang
  {
    let allCorrect = true;
    for (let i = 0; i < 10; i++) {
      const r = await request(tokens.hoang, { model: 'claude-sonnet' });
      const json = JSON.parse(r.text);
      if (json.seat !== 'seat_claude_hoang') allCorrect = false;
    }
    record('Hoàng luôn đi đúng instance router-hoang (10 request liên tiếp)', allCorrect);
  }

  // 3) Chạy đồng thời — không lẫn credential
  {
    const calls = [];
    for (let i = 0; i < 15; i++) calls.push(request(tokens.thanh, { model: 'claude-sonnet', i }));
    for (let i = 0; i < 15; i++) calls.push(request(tokens.hoang, { model: 'claude-sonnet', i }));
    const responses = await Promise.all(calls);
    const thanhResponses = responses.slice(0, 15).map((r) => JSON.parse(r.text).seat);
    const hoangResponses = responses.slice(15).map((r) => JSON.parse(r.text).seat);
    const noCrossLeak =
      thanhResponses.every((s) => s === 'seat_claude_thanh') &&
      hoangResponses.every((s) => s === 'seat_claude_hoang');
    record('Chạy đồng thời 30 request (15 Thanh + 15 Hoàng) không lẫn seat', noCrossLeak);
  }

  // 4) Token seat_id không khớp employee_id (Hoàng claim seat Thanh) -> phải 403
  {
    const r = await request(tokens.hoang_claims_thanh_seat, { model: 'claude-sonnet' });
    record(
      'Token seat_id lệch employee_id bị từ chối (403)',
      r.status === 403,
      `HTTP ${r.status}`
    );
  }

  // 5) Không có token -> 401
  {
    const r = await request(null, { model: 'claude-sonnet' });
    record('Request không có token bị từ chối (401)', r.status === 401, `HTTP ${r.status}`);
  }

  // 6) Revoke: suspend seat Thanh giữa chừng, xác nhận từ chối ngay, không ảnh hưởng Hoàng
  {
    const original = fs.readFileSync(REGISTRY_PATH, 'utf8');
    const registry = JSON.parse(original);
    registry.seat_claude_thanh.status = 'suspended';
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));

    const thanhAfterSuspend = await request(tokens.thanh, { model: 'claude-sonnet' });
    const hoangUnaffected = await request(tokens.hoang, { model: 'claude-sonnet' });
    const hoangJson = JSON.parse(hoangUnaffected.text);

    fs.writeFileSync(REGISTRY_PATH, original); // khôi phục ngay

    record(
      'Suspend seat Thanh có hiệu lực ngay (403), không ảnh hưởng Hoàng',
      thanhAfterSuspend.status === 403 && hoangJson.seat === 'seat_claude_hoang',
      `Thanh HTTP ${thanhAfterSuspend.status}, Hoàng vẫn seat=${hoangJson.seat}`
    );
  }

  console.log('\n=== Nhóm B — phần bảo toàn protocol có thể mock được ===\n');

  // 7) Streaming qua Adapter — thứ tự chunk, không vỡ, không gộp sai
  {
    const streamResult = await new Promise((resolve, reject) => {
      const payload = JSON.stringify({ model: 'claude-sonnet', stream: true });
      const req = http.request(
        {
          hostname: ADAPTER_HOST,
          port: ADAPTER_PORT,
          path: '/v1/messages',
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokens.thanh}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        }
      );
      req.on('error', reject);
      req.end(payload);
    });
    const events = parseSSE(streamResult);
    const expectedOrder = ['message_start', 'content_block_delta', 'content_block_delta', 'message_stop', '[DONE]'];
    const gotOrder = events.map((e) => {
      if (e === '[DONE]') return e;
      try {
        return JSON.parse(e).type;
      } catch {
        return 'PARSE_ERROR';
      }
    });
    const orderMatches = JSON.stringify(gotOrder) === JSON.stringify(expectedOrder);
    record('Streaming qua Adapter giữ đúng thứ tự chunk, không vỡ', orderMatches, gotOrder.join(' -> '));
  }

  console.log('\n=== Chưa test được trong spike này (cần 9Router thật + Claude Team account thật) ===');
  console.log('  - Tool-use blocks thật (mock chỉ giả lập JSON, không phải agent loop thật của Claude Code)');
  console.log('  - Prompt caching headers thật');
  console.log('  - OAuth refresh thật khi token hết hạn giữa chừng');
  console.log('  - Model alias thật, error format thật từ Anthropic/OpenAI');
  console.log('  - Agent loop dài thật, cancel request thật giữa luồng tool-use nhiều bước');

  const passCount = results.filter((r) => r.pass).length;
  console.log(`\n=== KẾT QUẢ: ${passCount}/${results.length} PASS (Nhóm A + phần Nhóm B mock được) ===`);
  if (passCount !== results.length) {
    console.log('CÓ TIÊU CHÍ FAIL — xem chi tiết ở trên trước khi kết luận PASS/FAIL toàn spike.');
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Test harness lỗi:', err);
  process.exitCode = 1;
});
