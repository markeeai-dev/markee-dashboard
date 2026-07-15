'use strict';
// Token nghiệp vụ Center AI — HMAC-SHA256, tự viết bằng Node crypto built-in
// (không cần npm install cho spike). Cấu trúc: base64url(header).base64url(payload).base64url(sig)
// Payload theo đúng schema Q18 (v16 — ai-operations-center-design.md):
//   employee_id, seat_id, provider, tool, team_id, project_id, task_id,
//   work_session_id, allowed_models, context_bundle_id, context_hash, expires_at

const crypto = require('crypto');

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString('utf8');
}

function signToken(payload, secret) {
  const header = { alg: 'HS256', typ: 'CENTERAI' };
  const headerPart = base64url(JSON.stringify(header));
  const payloadPart = base64url(JSON.stringify(payload));
  const signingInput = `${headerPart}.${payloadPart}`;
  const sig = crypto.createHmac('sha256', secret).update(signingInput).digest();
  const sigPart = base64url(sig);
  return `${signingInput}.${sigPart}`;
}

// Trả về { ok: true, payload } hoặc { ok: false, reason }
// reason: 'malformed' | 'bad_signature' | 'expired'
function verifyToken(token, secret) {
  if (typeof token !== 'string' || token.split('.').length !== 3) {
    return { ok: false, reason: 'malformed' };
  }
  const [headerPart, payloadPart, sigPart] = token.split('.');
  const signingInput = `${headerPart}.${payloadPart}`;
  const expectedSig = base64url(
    crypto.createHmac('sha256', secret).update(signingInput).digest()
  );

  const a = Buffer.from(sigPart);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad_signature' };
  }

  let payload;
  try {
    payload = JSON.parse(base64urlDecode(payloadPart));
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (payload.expires_at && Date.now() > Date.parse(payload.expires_at)) {
    return { ok: false, reason: 'expired' };
  }

  return { ok: true, payload };
}

module.exports = { signToken, verifyToken };
